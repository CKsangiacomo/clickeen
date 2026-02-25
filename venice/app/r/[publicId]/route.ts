import { NextResponse } from 'next/server';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { INSTANCE_PUBLISH_STATUS, isCuratedOrMainWidgetPublicId } from '@clickeen/ck-contracts';
import { parisJson } from '@venice/lib/paris';
import { tokyoFetch } from '@venice/lib/tokyo';
import { loadRenderSnapshot } from '@venice/lib/render-snapshot';
import { generateExcerptHtml, generateSchemaJsonLd } from '@venice/lib/schema';
import { applyTokyoInstanceOverlayWithMeta } from '@venice/lib/l10n';
import { resolveSnapshotBypass } from '@venice/lib/internal-bypass';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface InstanceResponse {
  publicId: string;
  status: typeof INSTANCE_PUBLISH_STATUS.PUBLISHED | typeof INSTANCE_PUBLISH_STATUS.UNPUBLISHED;
  widgetType?: string | null;
  config: Record<string, unknown>;
  updatedAt?: string;
  policy?: { flags?: Record<string, boolean> } | null;
}

const CACHE_PUBLISHED = 'no-store';
type RenderLocaleSource = 'current_locale' | 'current_revision_en_fallback' | 'unavailable';

function extractBodyHtml(widgetHtml: string): string {
  const match = widgetHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match) return match[1]?.trim() || '';
  return widgetHtml;
}

function extractStylesheetHrefs(widgetHtml: string, widgetType: string): string[] {
  const hrefs: string[] = [];
  const re = /<link\b[^>]*\brel=(?:"stylesheet"|'stylesheet')[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(widgetHtml))) {
    const tag = match[0] || '';
    const hrefMatch = tag.match(/\bhref=(?:"([^"]+)"|'([^']+)')/i);
    const href = (hrefMatch?.[1] || hrefMatch?.[2] || '').trim();
    if (!href) continue;
    const resolved = resolveWidgetAssetPath(widgetType, href);
    if (resolved === '/dieter/tokens/tokens.css' || resolved === '/dieter/tokens.css') {
      hrefs.push('/dieter/tokens/tokens.shadow.css');
      continue;
    }
    hrefs.push(resolved);
  }
  return hrefs;
}

function extractScriptSrcs(bodyHtml: string, widgetType: string): string[] {
  const srcs: string[] = [];
  const re = /<script\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>\s*<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(bodyHtml))) {
    const src = (match[1] || match[2] || '').trim();
    if (!src) continue;
    srcs.push(resolveWidgetAssetPath(widgetType, src));
  }
  return srcs;
}

function stripScriptTags(bodyHtml: string): string {
  return bodyHtml.replace(/<script\b[\s\S]*?<\/script>/gi, '').trim();
}

function resolveWidgetAssetPath(widgetType: string, raw: string): string {
  const href = String(raw || '').trim();
  if (!href) return '';
  if (href.startsWith('/')) return href;
  const base = `https://venice.local/widgets/${encodeURIComponent(widgetType)}/`;
  return new URL(href, base).pathname;
}

function injectPublicId(bodyHtml: string, widgetType: string, publicId: string): string {
  if (!publicId) return bodyHtml;
  const re = new RegExp(`(<[^>]+\\bdata-ck-widget=(?:"${widgetType}"|'${widgetType}')[^>]*)(>)`, 'i');
  return bodyHtml.replace(re, `$1 data-ck-public-id="${publicId}"$2`);
}

async function loadWidgetHtml(widgetType: string): Promise<string> {
  const res = await tokyoFetch(`/widgets/${encodeURIComponent(widgetType)}/widget.html`, { method: 'GET' });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`Failed to load widget.html (${res.status}) ${details}`.trim());
  }
  return await res.text();
}

function toWeakEtag(value: string) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const hash = btoa(binary);
  return `W/"${hash}"`;
}

function resolveRenderLocaleSource(args: {
  requestedLocale: string;
  effectiveLocale: string;
  fallbackToEn?: boolean;
}): RenderLocaleSource {
  if (args.fallbackToEn) return 'current_revision_en_fallback';
  if (args.requestedLocale !== 'en' && args.effectiveLocale === 'en') {
    return 'current_revision_en_fallback';
  }
  return 'current_locale';
}

export async function GET(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId: rawPublicId } = await ctx.params;
  const publicId = String(rawPublicId || '').trim();
  const isCurated = isCuratedOrMainWidgetPublicId(publicId);
  const url = new URL(req.url);
  const theme = 'light';
  const device = 'desktop';
  const ts = url.searchParams.get('ts');
  const metaOnly = url.searchParams.get('meta') === '1' || url.searchParams.get('meta') === 'true';
  const country = req.headers.get('cf-ipcountry') ?? req.headers.get('CF-IPCountry');
  const rawLocale = (url.searchParams.get('locale') || '').trim();
  const locale = normalizeLocaleToken(rawLocale) ?? 'en';
  const bypass = resolveSnapshotBypass(req);
  const bypassSnapshot = bypass.enabled;
  const enforcement = (url.searchParams.get('enforcement') || '').trim().toLowerCase();
  const frozenAt = (url.searchParams.get('frozenAt') || '').trim();
  const resetAt = (url.searchParams.get('resetAt') || '').trim();
  const isFrozenRequest = bypassSnapshot && enforcement === 'frozen' && frozenAt && resetAt;
  const enforcementPayload = isFrozenRequest
    ? {
        mode: 'frozen' as const,
        frozenAt,
        resetAt,
        upgradeUrl: 'https://clickeen.com/upgrade',
      }
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  };

  if (bypass.requested && !bypass.enabled) {
    headers['Cache-Control'] = 'no-store';
    headers['X-Ck-Render-Locale-Source'] = 'unavailable';
    return new NextResponse(JSON.stringify({ error: 'FORBIDDEN_BYPASS' }), { status: 403, headers });
  }

  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const embedToken = req.headers.get('x-embed-token') ?? req.headers.get('X-Embed-Token');
  const forwardHeaders: HeadersInit = {
    'X-Request-ID': req.headers.get('x-request-id') ?? crypto.randomUUID(),
    'Cache-Control': 'no-store',
  };

  if (auth) forwardHeaders['Authorization'] = auth;
  if (embedToken) forwardHeaders['X-Embed-Token'] = embedToken;

  let snapshotReason: string | null = null;

  const snapshotCacheControl = ts ? 'no-store' : CACHE_PUBLISHED;
  if (!bypassSnapshot) {
    const snapshot = await loadRenderSnapshot({
      publicId,
      locale,
      variant: metaOnly ? 'meta' : 'r',
    });
    if (snapshot.ok) {
      const etag = `W/"${snapshot.fingerprint}"`;
      if (snapshot.contentType) headers['Content-Type'] = snapshot.contentType;
      if (snapshot.pointerUpdatedAt) {
        headers['X-Ck-Render-Pointer-Updated-At'] = snapshot.pointerUpdatedAt;
      }
      const ifNoneMatch = req.headers.get('if-none-match') ?? req.headers.get('If-None-Match');
      if (ifNoneMatch && ifNoneMatch === etag) {
        headers['ETag'] = etag;
        headers['Cache-Control'] = snapshotCacheControl;
        headers['Vary'] = 'Authorization, X-Embed-Token';
        headers['X-Venice-Render-Mode'] = 'snapshot';
        headers['X-Ck-Render-Locale-Source'] = 'current_locale';
        return new NextResponse(null, { status: 304, headers });
      }

      headers['X-Ck-L10n-Requested-Locale'] = locale;
      headers['X-Ck-L10n-Resolved-Locale'] = locale;
      headers['X-Ck-L10n-Effective-Locale'] = locale;
      headers['X-Ck-L10n-Status'] = locale === 'en' ? 'base' : 'fresh';
      headers['X-Ck-Render-Locale-Source'] = 'current_locale';
      headers['ETag'] = etag;
      headers['Cache-Control'] = snapshotCacheControl;
      headers['Vary'] = 'Authorization, X-Embed-Token';
      headers['X-Venice-Render-Mode'] = 'snapshot';
      return new NextResponse(snapshot.bytes, { status: 200, headers });
    } else {
      snapshotReason = snapshot.reason;
    }

    if (snapshotReason === 'NEVER_PUBLISHED') {
      headers['Cache-Control'] = 'no-store';
      headers['Vary'] = 'Authorization, X-Embed-Token';
      headers['X-Venice-Render-Mode'] = 'snapshot';
      headers['X-Venice-Snapshot-Reason'] = snapshotReason;
      headers['X-Ck-Render-Locale-Source'] = 'unavailable';
      return new NextResponse(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers });
    }

    headers['Cache-Control'] = 'no-store';
    headers['Vary'] = 'Authorization, X-Embed-Token';
    headers['X-Venice-Render-Mode'] = 'snapshot';
    headers['X-Venice-Snapshot-Reason'] = snapshotReason ?? 'SNAPSHOT_UNAVAILABLE';
    headers['X-Ck-Render-Locale-Source'] = 'unavailable';
    return new NextResponse(
      JSON.stringify({ error: 'SNAPSHOT_UNAVAILABLE', reason: snapshotReason ?? 'SNAPSHOT_UNAVAILABLE' }),
      { status: 503, headers },
    );
  }

  snapshotReason = 'BYPASS_DYNAMIC';

  const { res, body } = await parisJson<InstanceResponse | { error?: string }>(
    `/api/instance/${encodeURIComponent(publicId)}?subject=venice`,
    {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    const status = res.status === 401 || res.status === 403 ? 403 : res.status;
    headers['Cache-Control'] = 'no-store';
    headers['X-Venice-Render-Mode'] = 'dynamic';
    headers['X-Ck-Render-Locale-Source'] = 'unavailable';
    if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
    return new NextResponse(JSON.stringify(body), { status, headers });
  }

  const instance = body as InstanceResponse;
  if (instance.status !== INSTANCE_PUBLISH_STATUS.PUBLISHED && !isCurated) {
    headers['Cache-Control'] = 'no-store';
    headers['Vary'] = 'Authorization, X-Embed-Token';
    headers['X-Venice-Render-Mode'] = 'dynamic';
    headers['X-Ck-Render-Locale-Source'] = 'unavailable';
    if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
    return new NextResponse(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers });
  }

  let etag: string | undefined;
  if (instance.updatedAt) {
    headers['Last-Modified'] = new Date(instance.updatedAt).toUTCString();
    etag = toWeakEtag(instance.updatedAt);
    headers['ETag'] = etag;
  }

  const ifNoneMatch = req.headers.get('if-none-match') ?? req.headers.get('If-None-Match');
  const ifModifiedSince = req.headers.get('if-modified-since') ?? req.headers.get('If-Modified-Since');
  if (!ts && bypassSnapshot) {
    if (ifNoneMatch && etag && ifNoneMatch === etag) {
      headers['Vary'] = 'Authorization, X-Embed-Token';
      headers['X-Venice-Render-Mode'] = 'dynamic';
      if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
      return new NextResponse(null, { status: 304, headers });
    }
    if (ifModifiedSince && instance.updatedAt) {
      const since = Date.parse(ifModifiedSince);
      const updated = Date.parse(instance.updatedAt);
      if (!Number.isNaN(since) && !Number.isNaN(updated) && updated <= since) {
        headers['Vary'] = 'Authorization, X-Embed-Token';
        headers['X-Venice-Render-Mode'] = 'dynamic';
        if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
        return new NextResponse(null, { status: 304, headers });
      }
    }
  }

  const widgetType = instance.widgetType ? String(instance.widgetType) : '';
  if (!widgetType) {
    headers['Cache-Control'] = 'no-store';
    return new NextResponse(JSON.stringify({ error: 'MISSING_WIDGET_TYPE' }), { status: 500, headers });
  }

  const overlayResult = isFrozenRequest
    ? {
        config: instance.config,
        meta: { requestedLocale: locale, resolvedLocale: locale, effectiveLocale: 'en', status: 'base' as const },
      }
    : await applyTokyoInstanceOverlayWithMeta({
        publicId: instance.publicId,
        locale,
        country,
        baseUpdatedAt: instance.updatedAt ?? null,
        widgetType,
        config: instance.config,
      });

  headers['X-Ck-L10n-Requested-Locale'] = overlayResult.meta.requestedLocale;
  headers['X-Ck-L10n-Resolved-Locale'] = overlayResult.meta.resolvedLocale;
  headers['X-Ck-L10n-Effective-Locale'] = overlayResult.meta.effectiveLocale;
  headers['X-Ck-L10n-Status'] = overlayResult.meta.status;
  headers['X-Ck-Render-Locale-Source'] = resolveRenderLocaleSource({
    requestedLocale: overlayResult.meta.requestedLocale,
    effectiveLocale: overlayResult.meta.effectiveLocale,
  });

  const localizedState = overlayResult.config;
  const effectiveLocale = overlayResult.meta.effectiveLocale;

  const canRemoveBranding = instance.policy?.flags?.['branding.remove'] === true;
  if (!canRemoveBranding) {
    const behavior = (localizedState as any)?.behavior;
    if (behavior && typeof behavior === 'object' && !Array.isArray(behavior)) {
      if (behavior.showBacklink === false) behavior.showBacklink = true;
    }
  }
  if (isFrozenRequest) {
    const behavior = (localizedState as any)?.behavior;
    if (behavior && typeof behavior === 'object' && !Array.isArray(behavior)) {
      behavior.showBacklink = true;
    }
  }

  const schemaJsonLd = generateSchemaJsonLd({
    widgetType,
    state: localizedState,
    locale: effectiveLocale,
  });

  const excerptHtml = generateExcerptHtml({
    widgetType,
    state: localizedState,
    locale: effectiveLocale,
  });

  if (metaOnly) {
    const payload = {
      publicId: instance.publicId,
      status: instance.status,
      widgetType,
      locale: effectiveLocale,
      enforcement: enforcementPayload,
      schemaJsonLd,
      excerptHtml,
    };

    headers['Cache-Control'] = 'no-store';

    headers['Vary'] = 'Authorization, X-Embed-Token';
    headers['X-Venice-Render-Mode'] = 'dynamic';
    if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
    return new NextResponse(JSON.stringify(payload), { status: 200, headers });
  }

  let widgetHtml: string;
  try {
    widgetHtml = await loadWidgetHtml(widgetType);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    headers['Cache-Control'] = 'no-store';
    return new NextResponse(JSON.stringify({ error: 'WIDGET_LOAD_FAILED', message }), { status: 502, headers });
  }

  const bodyHtml = extractBodyHtml(widgetHtml);
  const styles = extractStylesheetHrefs(widgetHtml, widgetType).filter(Boolean);
  const scripts = extractScriptSrcs(bodyHtml, widgetType).filter(Boolean);
  const renderHtml = injectPublicId(stripScriptTags(bodyHtml), widgetType, instance.publicId);
  const frozenOverlay = isFrozenRequest ? renderFrozenShadowBillboardHtml({ frozenAt, resetAt }) : '';
  const frozenStyle = isFrozenRequest ? renderFrozenShadowBillboardCss() : '';
  const frozenRenderHtml = isFrozenRequest ? `${renderHtml}\n${frozenStyle}\n${frozenOverlay}` : renderHtml;

  const payload = {
    publicId: instance.publicId,
    status: instance.status,
    widgetType,
    theme,
    device,
    locale: effectiveLocale,
    state: localizedState,
    enforcement: enforcementPayload,
    schemaJsonLd,
    excerptHtml,
    renderHtml: frozenRenderHtml,
    assets: { styles, scripts },
  };

  headers['Cache-Control'] = 'no-store';

  headers['Vary'] = 'Authorization, X-Embed-Token';
  headers['X-Venice-Render-Mode'] = 'dynamic';
  if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;

  return new NextResponse(JSON.stringify(payload), { status: 200, headers });
}

function renderFrozenShadowBillboardCss(): string {
  return `<style>
    :host { position: relative; display: block; }
    .ck-frozen {
      position: absolute;
      inset: auto 0 0 0;
      z-index: 999;
      display: flex;
      justify-content: center;
      padding: 16px;
      pointer-events: none;
    }
    .ck-frozen__card {
      pointer-events: auto;
      width: min(560px, calc(100% - 32px));
      border-radius: 20px;
      border: 1px solid color-mix(in oklab, var(--color-system-black), transparent 88%);
      background: color-mix(in oklab, var(--color-system-white), transparent 6%);
      box-shadow: 0 24px 60px color-mix(in oklab, var(--color-system-black), transparent 88%);
      backdrop-filter: blur(10px);
      padding: 18px 18px 16px;
    }
    .ck-frozen__title {
      margin: 0 0 6px;
      font: 600 var(--fs-14, 14px) / 1.2 var(--font-ui, system-ui, sans-serif);
      color: var(--color-text);
    }
    .ck-frozen__meta {
      margin: 0 0 10px;
      font: 500 var(--fs-12, 12px) / 1.3 var(--font-ui, system-ui, sans-serif);
      color: color-mix(in oklab, var(--color-text), transparent 28%);
    }
    .ck-frozen__actions {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .ck-frozen__link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 8px 12px;
      border-radius: var(--control-radius-sm, 0.5rem);
      background: var(--color-primary);
      color: var(--color-on-primary);
      text-decoration: none;
      font: 600 var(--fs-12, 12px) / 1.1 var(--font-ui, system-ui, sans-serif);
      box-shadow: 0 10px 24px color-mix(in oklab, var(--color-primary), transparent 65%);
    }
    .ck-frozen__link:hover { filter: brightness(1.03); }
    .ck-frozen__badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font: 500 var(--fs-12, 12px) / 1.1 var(--font-ui, system-ui, sans-serif);
      color: color-mix(in oklab, var(--color-text), transparent 35%);
      white-space: nowrap;
    }
    /* Make the widget a billboard: visible, but non-interactive. */
    [data-ck-widget], [data-role="root"] { pointer-events: none !important; }
  </style>`;
}

function renderFrozenShadowBillboardHtml(args: { frozenAt: string; resetAt: string }): string {
  const frozenText = args.frozenAt
    ? new Date(args.frozenAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    : '';
  const resetText = args.resetAt
    ? new Date(args.resetAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    : '';
  const metaParts = [
    frozenText ? `Data frozen on ${frozenText}` : null,
    resetText ? `Resets on ${resetText}` : null,
  ].filter(Boolean);
  const meta = metaParts.join(' • ');

  return `<div class="ck-frozen" role="alert" aria-live="polite">
    <div class="ck-frozen__card">
      <p class="ck-frozen__title">Upgrade for live updates</p>
      <p class="ck-frozen__meta">${meta || 'This widget is frozen.'}</p>
      <div class="ck-frozen__actions">
        <a class="ck-frozen__link" href="https://clickeen.com/upgrade" target="_blank" rel="noreferrer">Upgrade</a>
        <span class="ck-frozen__badge">Powered by Clickeen</span>
      </div>
    </div>
  </div>`;
}

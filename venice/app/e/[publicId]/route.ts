import { NextResponse } from 'next/server';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { INSTANCE_PUBLISH_STATUS, isCuratedOrMainWidgetPublicId } from '@clickeen/ck-contracts';
import { parisJson, getParisBase } from '@venice/lib/paris';
import { tokyoFetch, getTokyoBase } from '@venice/lib/tokyo';
import { loadRenderSnapshot } from '@venice/lib/render-snapshot';
import { escapeHtml } from '@venice/lib/html';
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
  policy?: { profile?: string; flags?: Record<string, boolean> } | null;
}

const CACHE_PUBLISHED = 'no-store';

function extractCkWidgetJson(html: string): { json: Record<string, unknown>; re: RegExp } | null {
  const re = /window\.CK_WIDGET=([^;]+);/;
  const match = html.match(re);
  if (!match) return null;
  const rawJson = match[1] || '';
  const json = JSON.parse(rawJson) as Record<string, unknown>;
  return { json, re };
}

function isFrozenCkWidgetPayload(json: Record<string, unknown>): boolean {
  const enforcement = (json as any)?.enforcement;
  const mode = enforcement && typeof enforcement === 'object' ? (enforcement as any).mode : null;
  return mode === 'frozen';
}

function patchSnapshotHtml(
  html: string,
  updates: { theme: string; device: string; requestedLocale: string },
): { html: string; effectiveLocale: string } | null {
  const extracted = extractCkWidgetJson(html);
  if (!extracted) return null;
  const { json, re } = extracted;

  const effectiveLocale = isFrozenCkWidgetPayload(json) ? 'en' : updates.requestedLocale;
  (json as any).theme = updates.theme;
  (json as any).device = updates.device;
  (json as any).locale = effectiveLocale;

  const nextJson = JSON.stringify(json).replace(/</g, '\\u003c');
  let patched = html.replace(re, `window.CK_WIDGET=${nextJson};`);

  const htmlTagRe = /<html\b[^>]*>/i;
  if (!htmlTagRe.test(patched)) return null;
  const tag = `<html lang="${escapeHtml(effectiveLocale)}" data-theme="${escapeHtml(updates.theme)}" data-device="${escapeHtml(
    updates.device,
  )}" data-locale="${escapeHtml(effectiveLocale)}">`;
  patched = patched.replace(htmlTagRe, tag);

  return { html: patched, effectiveLocale };
}

function extractNonce(html: string): string | null {
  const match = html.match(/\bnonce="([^"]+)"/i);
  const nonce = match?.[1]?.trim() || '';
  return nonce ? nonce : null;
}

export async function GET(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId: rawPublicId } = await ctx.params;
  const publicId = String(rawPublicId || '').trim();
  const isCurated = isCuratedOrMainWidgetPublicId(publicId);
  const url = new URL(req.url);
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const device = url.searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop';
  const country = req.headers.get('cf-ipcountry') ?? req.headers.get('CF-IPCountry');
  const rawLocale = (url.searchParams.get('locale') || '').trim();
  const locale = normalizeLocaleToken(rawLocale) ?? 'en';
  const bypass = resolveSnapshotBypass(req);
  const bypassSnapshot = bypass.enabled;
  const enforcement = (url.searchParams.get('enforcement') || '').trim().toLowerCase();
  const frozenAt = (url.searchParams.get('frozenAt') || '').trim();
  const resetAt = (url.searchParams.get('resetAt') || '').trim();
  const isFrozenRequest = bypassSnapshot && enforcement === 'frozen';
  const ts = url.searchParams.get('ts');
  const enforcementContext =
    isFrozenRequest && frozenAt && resetAt ? { mode: 'frozen' as const, frozenAt, resetAt } : null;

  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
  };

  if (bypass.requested && !bypass.enabled) {
    const tokyoBase = getTokyoBase();
    const html = renderErrorPage({
      publicId,
      status: 403,
      message: 'Internal bypass forbidden',
      tokyoBase,
    });
    headers['Cache-Control'] = 'no-store';
    return new NextResponse(html, { status: 403, headers });
  }

  const forwardHeaders: HeadersInit = {
    'X-Request-ID': req.headers.get('x-request-id') ?? crypto.randomUUID(),
    'Cache-Control': 'no-store',
  };

  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (auth) forwardHeaders['Authorization'] = auth;
  const embedToken = req.headers.get('x-embed-token') ?? req.headers.get('X-Embed-Token');
  if (embedToken) forwardHeaders['X-Embed-Token'] = embedToken;

  let snapshotReason: string | null = null;
  const snapshotCacheControl = ts ? 'no-store' : CACHE_PUBLISHED;
  if (!bypassSnapshot) {
    const snapshot = await loadRenderSnapshot({ publicId, locale, variant: 'e' });
    if (snapshot.ok) {
      const etag = `W/"${snapshot.fingerprint}"`;
      if (snapshot.pointerUpdatedAt) {
        headers['X-Ck-Render-Pointer-Updated-At'] = snapshot.pointerUpdatedAt;
      }
      const ifNoneMatch = req.headers.get('if-none-match') ?? req.headers.get('If-None-Match');
      if (ifNoneMatch && ifNoneMatch === etag) {
        headers['ETag'] = etag;
        headers['Cache-Control'] = snapshotCacheControl;
        headers['Vary'] = 'Authorization, X-Embed-Token';
        headers['X-Venice-Render-Mode'] = 'snapshot';
        return new NextResponse(null, { status: 304, headers });
      }

      let html = new TextDecoder().decode(snapshot.bytes);
      try {
        const patched = patchSnapshotHtml(html, { theme, device, requestedLocale: locale });
        if (!patched) throw new Error('SNAPSHOT_PATCH_FAILED');
        html = patched.html;
        html = rewriteWidgetCdnUrls(html, getTokyoBase());
        headers['X-Ck-L10n-Requested-Locale'] = locale;
        headers['X-Ck-L10n-Resolved-Locale'] = locale;
        headers['X-Ck-L10n-Effective-Locale'] = patched.effectiveLocale;
        headers['X-Ck-L10n-Status'] = patched.effectiveLocale === 'en' ? 'base' : 'fresh';
      } catch {
        snapshotReason = 'SNAPSHOT_INVALID';
      }

      const nonce = extractNonce(html);
      if (!nonce) snapshotReason = snapshotReason ?? 'SNAPSHOT_NONCE_MISSING';

      if (!snapshotReason && nonce) {
        headers['ETag'] = etag;
        headers['Cache-Control'] = snapshotCacheControl;
        headers['Vary'] = 'Authorization, X-Embed-Token';
        headers['X-Venice-Render-Mode'] = 'snapshot';
        const parisOrigin = new URL(getParisBase()).origin;
        const tokyoOrigin = new URL(getTokyoBase()).origin;
        headers['Content-Security-Policy'] = buildCsp(nonce, { parisOrigin, tokyoOrigin });
        return new NextResponse(html, { status: 200, headers });
      }
    } else {
      snapshotReason = snapshot.reason;
    }

    if (snapshotReason && locale !== 'en') {
      const fallbackSnapshot = await loadRenderSnapshot({ publicId, locale: 'en', variant: 'e' });
      if (fallbackSnapshot.ok) {
        const etag = `W/"${fallbackSnapshot.fingerprint}"`;
        if (fallbackSnapshot.pointerUpdatedAt) {
          headers['X-Ck-Render-Pointer-Updated-At'] = fallbackSnapshot.pointerUpdatedAt;
        }
        const ifNoneMatch = req.headers.get('if-none-match') ?? req.headers.get('If-None-Match');
        if (ifNoneMatch && ifNoneMatch === etag) {
          headers['ETag'] = etag;
          headers['Cache-Control'] = snapshotCacheControl;
          headers['Vary'] = 'Authorization, X-Embed-Token';
          headers['X-Venice-Render-Mode'] = 'snapshot';
          headers['X-Venice-Snapshot-Fallback'] = 'en';
          headers['X-Ck-L10n-Requested-Locale'] = locale;
          headers['X-Ck-L10n-Resolved-Locale'] = 'en';
          headers['X-Ck-L10n-Effective-Locale'] = 'en';
          headers['X-Ck-L10n-Status'] = 'base';
          if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
          return new NextResponse(null, { status: 304, headers });
        }

        let html = new TextDecoder().decode(fallbackSnapshot.bytes);
        try {
          const patched = patchSnapshotHtml(html, { theme, device, requestedLocale: 'en' });
          if (!patched) throw new Error('SNAPSHOT_PATCH_FAILED');
          html = patched.html;
          html = rewriteWidgetCdnUrls(html, getTokyoBase());
        } catch {
          html = '';
        }

        const nonce = html ? extractNonce(html) : null;
        if (html && nonce) {
          headers['ETag'] = etag;
          headers['Cache-Control'] = snapshotCacheControl;
          headers['Vary'] = 'Authorization, X-Embed-Token';
          headers['X-Venice-Render-Mode'] = 'snapshot';
          headers['X-Venice-Snapshot-Fallback'] = 'en';
          headers['X-Ck-L10n-Requested-Locale'] = locale;
          headers['X-Ck-L10n-Resolved-Locale'] = 'en';
          headers['X-Ck-L10n-Effective-Locale'] = 'en';
          headers['X-Ck-L10n-Status'] = 'base';
          if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
          const parisOrigin = new URL(getParisBase()).origin;
          const tokyoOrigin = new URL(getTokyoBase()).origin;
          headers['Content-Security-Policy'] = buildCsp(nonce, { parisOrigin, tokyoOrigin });
          return new NextResponse(html, { status: 200, headers });
        }
      }
    }

    if (snapshotReason === 'NEVER_PUBLISHED') {
      const tokyoBase = getTokyoBase();
      const html = renderErrorPage({
        publicId,
        status: 404,
        message: 'Widget unavailable',
        tokyoBase,
      });
      headers['Cache-Control'] = 'no-store';
      headers['Vary'] = 'Authorization, X-Embed-Token';
      headers['X-Venice-Render-Mode'] = 'snapshot';
      if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
      return new NextResponse(html, { status: 404, headers });
    }
    {
      const tokyoBase = getTokyoBase();
      const html = renderErrorPage({
        publicId,
        status: 503,
        message: `Published snapshot unavailable (${snapshotReason ?? 'unknown'})`,
        tokyoBase,
      });
      headers['Cache-Control'] = 'no-store';
      headers['Vary'] = 'Authorization, X-Embed-Token';
      headers['X-Venice-Render-Mode'] = 'snapshot';
      headers['X-Venice-Snapshot-Reason'] = snapshotReason ?? 'SNAPSHOT_UNAVAILABLE';
      return new NextResponse(html, { status: 503, headers });
    }
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
    const tokyoBase = getTokyoBase();
    const html = renderErrorPage({
      publicId,
      status,
      message: typeof body === 'string' ? body : JSON.stringify(body),
      tokyoBase,
    });
    headers['Cache-Control'] = 'no-store';
    headers['X-Venice-Render-Mode'] = 'dynamic';
    if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
    return new NextResponse(html, { status, headers });
  }

  const instance = body as InstanceResponse;
  // Venice is the public embed runtime. It must never serve unpublished instances.
  // (Dev/auth preview belongs to Bob; Prague and third-party sites only iframe Venice.)
  if (instance.status !== INSTANCE_PUBLISH_STATUS.PUBLISHED && !isCurated) {
    const tokyoBase = getTokyoBase();
    const html = renderErrorPage({
      publicId,
      status: 404,
      message: 'Widget unavailable',
      tokyoBase,
    });
    headers['Cache-Control'] = 'no-store';
    headers['Vary'] = 'Authorization, X-Embed-Token';
    headers['X-Venice-Render-Mode'] = 'dynamic';
    if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
    return new NextResponse(html, { status: 404, headers });
  }
  const nonce = crypto.randomUUID();
  const isFrozenRender = ts == null && Boolean(enforcementContext && enforcementContext.mode === 'frozen');
  const widgetType = instance.widgetType ? String(instance.widgetType) : '';
  const overlayResult =
    isFrozenRender || !widgetType
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

  const responseHtml = await renderInstancePage({
    instance,
    theme,
    device,
    localizedState: overlayResult.config,
    effectiveLocale: overlayResult.meta.effectiveLocale,
    nonce,
    ts,
    enforcement: enforcementContext,
  });

  // Conditional request handling
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

  headers['Cache-Control'] = 'no-store';

  headers['Vary'] = 'Authorization, X-Embed-Token';
  headers['X-Venice-Render-Mode'] = 'dynamic';
  if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;

  const parisOrigin = new URL(getParisBase()).origin;
  const tokyoOrigin = new URL(getTokyoBase()).origin;
  headers['Content-Security-Policy'] = buildCsp(nonce, { parisOrigin, tokyoOrigin });

  return new NextResponse(responseHtml, { status: 200, headers });
}

function extractBodyHtml(widgetHtml: string): string {
  const match = widgetHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match) return match[1]?.trim() || '';
  return widgetHtml;
}

function extractTitle(widgetHtml: string): string | null {
  const match = widgetHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match?.[1]?.trim() || '';
  return title ? title : null;
}

function extractStylesheetLinks(widgetHtml: string): string {
  const links: string[] = [];
  const re = /<link\b[^>]*\brel=(?:"stylesheet"|'stylesheet')[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(widgetHtml))) {
    const tag = match[0]?.trim();
    if (tag) links.push(tag);
  }
  return links.join('\n    ');
}

async function loadWidgetHtml(widgetType: string): Promise<string> {
  const res = await tokyoFetch(`/widgets/${encodeURIComponent(widgetType)}/widget.html`, { method: 'GET' });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`Failed to load widget.html (${res.status}) ${details}`.trim());
  }
  return await res.text();
}

async function renderInstancePage({
  instance,
  theme,
  device,
  localizedState,
  effectiveLocale,
  nonce,
  ts,
  enforcement,
}: {
  instance: InstanceResponse;
  theme: string;
  device: string;
  localizedState: Record<string, unknown>;
  effectiveLocale: string;
  nonce: string;
  ts: string | null;
  enforcement: null | { mode: 'frozen'; frozenAt: string; resetAt: string };
}) {
  const tokyoBase = getTokyoBase();
  const widgetType = instance.widgetType ? String(instance.widgetType) : '';
  if (!widgetType) {
    return renderErrorPage({ publicId: instance.publicId, status: 500, message: 'Missing widgetType', tokyoBase });
  }

  let widgetHtml: string;
  try {
    widgetHtml = await loadWidgetHtml(widgetType);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return renderErrorPage({ publicId: instance.publicId, status: 502, message, tokyoBase });
  }

  if (ts) {
    widgetHtml = appendCacheBustParam(widgetHtml, ts);
  }
  widgetHtml = rewriteWidgetCdnUrls(widgetHtml, tokyoBase);

  const bodyHtml = extractBodyHtml(widgetHtml);
  const title = extractTitle(widgetHtml) ?? `${widgetType} widget`;
  const stylesheetLinks = extractStylesheetLinks(widgetHtml);

  const isFrozenRequest = ts == null && Boolean(enforcement && enforcement.mode === 'frozen');

  const behavior = (localizedState as any)?.behavior;
  if (behavior && typeof behavior === 'object' && !Array.isArray(behavior)) {
    const canRemoveBranding = instance.policy?.flags?.['branding.remove'] === true;
    if (isFrozenRequest) behavior.showBacklink = true;
    else if (!canRemoveBranding && behavior.showBacklink === false) behavior.showBacklink = true;
  }

  const enforcementPayload = isFrozenRequest
    ? {
        mode: 'frozen' as const,
        frozenAt: enforcement?.frozenAt,
        resetAt: enforcement?.resetAt,
        upgradeUrl: 'https://clickeen.com/upgrade',
      }
    : null;

  const usageTier = String(instance.policy?.profile || '').trim().toLowerCase();
  const shouldCountView = !isFrozenRequest && (usageTier === 'free' || usageTier === 'tier1');
  const usagePixel =
    shouldCountView
      ? `<img alt="" width="1" height="1" style="display:none" src="/embed/pixel?event=view&widget=${encodeURIComponent(
          instance.publicId,
        )}&tier=${encodeURIComponent(usageTier)}" />`
      : '';

  const enforcementOverlay = isFrozenRequest ? renderFrozenOverlayHtml(enforcement) : '';
  const enforcementStyle = isFrozenRequest ? renderFrozenOverlayCss(nonce) : '';

  const ckWidgetJson = JSON.stringify({
    widgetname: widgetType,
    publicId: instance.publicId,
    status: instance.status,
    theme,
    device,
    locale: effectiveLocale,
    state: localizedState,
    enforcement: enforcementPayload,
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${escapeHtml(effectiveLocale)}" data-theme="${escapeHtml(theme)}" data-device="${escapeHtml(
    device,
  )}" data-locale="${escapeHtml(
    effectiveLocale,
  )}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <base href="${escapeHtml(tokyoBase)}/widgets/${escapeHtml(widgetType)}/" />
    ${stylesheetLinks}
    <style nonce="${escapeHtml(nonce)}">html,body{margin:0;padding:0;background:transparent}</style>
    ${enforcementStyle}
    <script nonce="${escapeHtml(nonce)}">window.CK_CSP_NONCE=${JSON.stringify(nonce)};window.CK_WIDGET=${ckWidgetJson};</script>
  </head>
  <body>
    ${bodyHtml}
    ${usagePixel}
    ${enforcementOverlay}
  </body>
</html>`;
}

function renderFrozenOverlayCss(nonce: string): string {
  return `<style nonce="${escapeHtml(nonce)}">
    .ck-frozen {
      position: fixed;
      inset: 0;
      z-index: 999;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: var(--space-6);
      pointer-events: none;
    }
    .ck-frozen__card {
      pointer-events: auto;
      width: min(560px, calc(100vw - 48px));
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

function renderFrozenOverlayHtml(args: { mode: 'frozen'; frozenAt: string; resetAt: string } | null): string {
  if (!args) return '';
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
      <p class="ck-frozen__meta">${escapeHtml(meta || 'This widget is frozen.')}</p>
      <div class="ck-frozen__actions">
        <a class="ck-frozen__link" href="https://clickeen.com/upgrade" target="_blank" rel="noreferrer">Upgrade</a>
        <span class="ck-frozen__badge">Powered by Clickeen</span>
      </div>
    </div>
  </div>`;
}

function appendCacheBustParam(widgetHtml: string, ts: string): string {
  const encodedTs = encodeURIComponent(ts);
  const re = /\b(href|src)=(["'])(\.\.?\/[^"']+)\2/g;
  return widgetHtml.replace(re, (_match, attr: string, quote: string, url: string) => {
    const joiner = url.includes('?') ? '&' : '?';
    return `${attr}=${quote}${url}${joiner}ts=${encodedTs}${quote}`;
  });
}

function rewriteWidgetCdnUrls(widgetHtml: string, tokyoBase: string): string {
  const base = tokyoBase.replace(/\/$/, '');
  return (
    widgetHtml
      // Move asset fetches to Tokyo (CDN), not Venice origin.
      .replace(/\b(href|src)=(["'])\/(dieter|widgets)\/([^"'?#]+(?:\?[^"']*)?)\2/g, (_match, attr, quote, kind, rest) => {
        return `${attr}=${quote}${base}/${kind}/${rest}${quote}`;
      })
      .replace(/url\(\s*(["']?)\/dieter\/([^"'?#)]+(?:\?[^"')]+)?)\1\s*\)/g, (_match, quote, rest) => {
        const q = quote || '';
        return `url(${q}${base}/dieter/${rest}${q})`;
      })
      .replace(/<base\b([^>]*?)\bhref=(["'])\/widgets\/([^"']*)\2([^>]*)>/gi, (_match, before, quote, rest, after) => {
        return `<base${before}href=${quote}${base}/widgets/${rest}${quote}${after}>`;
      })
  );
}

function renderErrorPage({
  publicId,
  status,
  message,
  tokyoBase,
}: {
  publicId: string;
  status: number;
  message: string;
  tokyoBase: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Clickeen widget error</title>
    <link rel="stylesheet" href="${escapeHtml(tokyoBase)}/dieter/tokens/tokens.css">
    <style>
      body { font-family: var(--font-ui, system-ui, sans-serif); background:var(--color-system-gray-6-step5); color:var(--color-text); margin:0; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:var(--space-6); }
      .card { background:var(--color-system-white); padding:32px; border-radius:20px; border:1px solid color-mix(in oklab, var(--color-system-black), transparent 88%); box-shadow:0 24px 60px color-mix(in oklab, var(--color-system-black), transparent 88%); max-width:480px; text-align:center; }
      h1 { margin:0 0 12px; font-size:18px; }
      p { margin:6px 0; font-size:14px; opacity:0.78; }
    </style>
  </head>
  <body>
    <div class="card" role="alert">
      <h1>Widget unavailable</h1>
      <p>Status code: ${status}</p>
      <p>Widget: ${escapeHtml(publicId)}</p>
      <p>${escapeHtml(message)}</p>
    </div>
  </body>
</html>`;
}

function buildCsp(nonce: string, { parisOrigin, tokyoOrigin }: { parisOrigin: string; tokyoOrigin: string }) {
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' ${escapeHtml(tokyoOrigin)}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com ${escapeHtml(tokyoOrigin)}`,
    `img-src 'self' data: https: ${escapeHtml(tokyoOrigin)}`,
    `font-src https://fonts.gstatic.com data: ${escapeHtml(tokyoOrigin)}`,
    `connect-src 'self' ${escapeHtml(parisOrigin)} ${escapeHtml(tokyoOrigin)}`,
    "frame-ancestors *",
    "form-action 'self'",
  ].join('; ');
}

function toWeakEtag(value: string) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in edge runtime environments
  const hash = btoa(binary);
  return `W/"${hash}"`;
}

import { NextResponse } from 'next/server';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { parisJson } from '@venice/lib/paris';
import { tokyoFetch } from '@venice/lib/tokyo';
import { loadRenderSnapshot } from '@venice/lib/render-snapshot';
import { generateExcerptHtml, generateSchemaJsonLd } from '@venice/lib/schema';
import { applyTokyoInstanceOverlay } from '@venice/lib/l10n';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface InstanceResponse {
  publicId: string;
  status: 'published' | 'unpublished';
  widgetType?: string | null;
  config: Record<string, unknown>;
  updatedAt?: string;
}

const CACHE_PUBLISHED = 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800';
const CACHE_DRAFT = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300';

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

export async function GET(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId: rawPublicId } = await ctx.params;
  const publicId = String(rawPublicId || '').trim();
  const url = new URL(req.url);
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const device = url.searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop';
  const ts = url.searchParams.get('ts');
  const metaOnly = url.searchParams.get('meta') === '1' || url.searchParams.get('meta') === 'true';
  const country = req.headers.get('cf-ipcountry') ?? req.headers.get('CF-IPCountry');
  const rawLocale = (url.searchParams.get('locale') || '').trim();
  const locale = normalizeLocaleToken(rawLocale) ?? 'en';
  const bypassSnapshot = req.headers.get('x-ck-snapshot-bypass') === '1';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  };

  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const embedToken = req.headers.get('x-embed-token') ?? req.headers.get('X-Embed-Token');
  let snapshotReason: string | null = null;

  if (!ts && !auth && !embedToken && !bypassSnapshot) {
    const snapshot = await loadRenderSnapshot({
      publicId,
      locale,
      variant: metaOnly ? 'meta' : 'r',
    });
    if (snapshot.ok) {
      const etag = `W/"${snapshot.fingerprint}"`;
      const ifNoneMatch = req.headers.get('if-none-match') ?? req.headers.get('If-None-Match');
      if (ifNoneMatch && ifNoneMatch === etag) {
        headers['ETag'] = etag;
        headers['Cache-Control'] = CACHE_PUBLISHED;
        headers['Vary'] = 'Authorization, X-Embed-Token';
        headers['X-Venice-Render-Mode'] = 'snapshot';
        return new NextResponse(null, { status: 304, headers });
      }

      const raw = new TextDecoder().decode(snapshot.bytes);
      if (!metaOnly) {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          parsed.theme = theme;
          parsed.device = device;
          const body = JSON.stringify(parsed);
          headers['ETag'] = etag;
          headers['Cache-Control'] = CACHE_PUBLISHED;
          headers['Vary'] = 'Authorization, X-Embed-Token';
          headers['X-Venice-Render-Mode'] = 'snapshot';
          return new NextResponse(body, { status: 200, headers });
        } catch {
          snapshotReason = 'SNAPSHOT_INVALID';
        }
      } else {
        headers['ETag'] = etag;
        headers['Cache-Control'] = CACHE_PUBLISHED;
        headers['Vary'] = 'Authorization, X-Embed-Token';
        headers['X-Venice-Render-Mode'] = 'snapshot';
        return new NextResponse(raw, { status: 200, headers });
      }

      // Fall through to dynamic rendering if snapshot payload is invalid.
    }
    if (!snapshot.ok && !snapshotReason) snapshotReason = snapshot.reason;
  } else if (ts) {
    snapshotReason = 'SKIP_TS';
  } else if (auth || embedToken) {
    snapshotReason = 'SKIP_AUTH';
  } else if (bypassSnapshot) {
    snapshotReason = 'SKIP_BYPASS';
  }

  const forwardHeaders: HeadersInit = {
    'X-Request-ID': req.headers.get('x-request-id') ?? crypto.randomUUID(),
    'Cache-Control': 'no-store',
  };

  if (auth) forwardHeaders['Authorization'] = auth;
  if (embedToken) forwardHeaders['X-Embed-Token'] = embedToken;

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
    if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;
    return new NextResponse(JSON.stringify(body), { status, headers });
  }

  const instance = body as InstanceResponse;

  let etag: string | undefined;
  if (instance.updatedAt) {
    headers['Last-Modified'] = new Date(instance.updatedAt).toUTCString();
    etag = toWeakEtag(instance.updatedAt);
    headers['ETag'] = etag;
  }

  const ifNoneMatch = req.headers.get('if-none-match') ?? req.headers.get('If-None-Match');
  const ifModifiedSince = req.headers.get('if-modified-since') ?? req.headers.get('If-Modified-Since');
  if (!ts && !bypassSnapshot) {
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

  const localizedState = await applyTokyoInstanceOverlay({
    publicId: instance.publicId,
    locale,
    country,
    baseUpdatedAt: instance.updatedAt ?? null,
    widgetType,
    config: instance.config,
    explicitLocale: true,
  });

  const schemaJsonLd = generateSchemaJsonLd({
    widgetType,
    state: localizedState,
    locale,
  });

  const excerptHtml = generateExcerptHtml({
    widgetType,
    state: localizedState,
    locale,
  });

  if (metaOnly) {
    const payload = {
      publicId: instance.publicId,
      status: instance.status,
      widgetType,
      locale,
      schemaJsonLd,
      excerptHtml,
    };

    if (ts || bypassSnapshot) {
      headers['Cache-Control'] = 'no-store';
    } else if (instance.status === 'published') {
      headers['Cache-Control'] = CACHE_PUBLISHED;
    } else {
      headers['Cache-Control'] = CACHE_DRAFT;
    }

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

  const payload = {
    publicId: instance.publicId,
    status: instance.status,
    widgetType,
    theme,
    device,
    locale,
    state: localizedState,
    schemaJsonLd,
    excerptHtml,
    renderHtml,
    assets: { styles, scripts },
  };

  if (ts || bypassSnapshot) {
    headers['Cache-Control'] = 'no-store';
  } else if (instance.status === 'published') {
    headers['Cache-Control'] = CACHE_PUBLISHED;
  } else {
    headers['Cache-Control'] = CACHE_DRAFT;
  }

  headers['Vary'] = 'Authorization, X-Embed-Token';
  headers['X-Venice-Render-Mode'] = 'dynamic';
  if (snapshotReason) headers['X-Venice-Snapshot-Reason'] = snapshotReason;

  return new NextResponse(JSON.stringify(payload), { status: 200, headers });
}

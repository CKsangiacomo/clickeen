import { NextResponse } from 'next/server';
import { parisJson, getParisBase } from '@venice/lib/paris';
import { tokyoFetch } from '@venice/lib/tokyo';
import { escapeHtml } from '@venice/lib/html';

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

export async function GET(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const url = new URL(req.url);
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const device = url.searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop';
  const ts = url.searchParams.get('ts');

  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
  };

  const forwardHeaders: HeadersInit = {
    'X-Request-ID': req.headers.get('x-request-id') ?? crypto.randomUUID(),
    'Cache-Control': 'no-store',
  };

  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (auth) forwardHeaders['Authorization'] = auth;
  const embedToken = req.headers.get('x-embed-token') ?? req.headers.get('X-Embed-Token');
  if (embedToken) forwardHeaders['X-Embed-Token'] = embedToken;

  const { res, body } = await parisJson<InstanceResponse | { error?: string }>(
    `/api/instance/${encodeURIComponent(publicId)}`,
    {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    const status = res.status === 401 || res.status === 403 ? 403 : res.status;
    const html = renderErrorPage({
      publicId,
      status,
      message: typeof body === 'string' ? body : JSON.stringify(body),
    });
    headers['Cache-Control'] = 'no-store';
    return new NextResponse(html, { status, headers });
  }

  const instance = body as InstanceResponse;
  const nonce = crypto.randomUUID();
  const responseHtml = await renderInstancePage({ instance, theme, device, nonce });

  // Conditional request handling
  let etag: string | undefined;
  if (instance.updatedAt) {
    headers['Last-Modified'] = new Date(instance.updatedAt).toUTCString();
    etag = toWeakEtag(instance.updatedAt);
    headers['ETag'] = etag;
  }

  const ifNoneMatch = req.headers.get('if-none-match') ?? req.headers.get('If-None-Match');
  const ifModifiedSince = req.headers.get('if-modified-since') ?? req.headers.get('If-Modified-Since');
  if (!ts) {
    if (ifNoneMatch && etag && ifNoneMatch === etag) {
      headers['Vary'] = 'Authorization, X-Embed-Token';
      return new NextResponse(null, { status: 304, headers });
    }
    if (ifModifiedSince && instance.updatedAt) {
      const since = Date.parse(ifModifiedSince);
      const updated = Date.parse(instance.updatedAt);
      if (!Number.isNaN(since) && !Number.isNaN(updated) && updated <= since) {
        headers['Vary'] = 'Authorization, X-Embed-Token';
        return new NextResponse(null, { status: 304, headers });
      }
    }
  }

  if (ts) {
    headers['Cache-Control'] = 'no-store';
  } else if (instance.status === 'published') {
    headers['Cache-Control'] = CACHE_PUBLISHED;
  } else {
    headers['Cache-Control'] = CACHE_DRAFT;
  }

  headers['Vary'] = 'Authorization, X-Embed-Token';

  const parisOrigin = new URL(getParisBase()).origin;
  headers['Content-Security-Policy'] = buildCsp(nonce, parisOrigin);

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
  nonce,
}: {
  instance: InstanceResponse;
  theme: string;
  device: string;
  nonce: string;
}) {
  const widgetType = instance.widgetType ? String(instance.widgetType) : '';
  if (!widgetType) {
    return renderErrorPage({ publicId: instance.publicId, status: 500, message: 'Missing widgetType' });
  }

  let widgetHtml: string;
  try {
    widgetHtml = await loadWidgetHtml(widgetType);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return renderErrorPage({ publicId: instance.publicId, status: 502, message });
  }

  const bodyHtml = extractBodyHtml(widgetHtml);
  const title = extractTitle(widgetHtml) ?? `${widgetType} widget`;
  const stylesheetLinks = extractStylesheetLinks(widgetHtml);
  const ckWidgetJson = JSON.stringify({
    widgetname: widgetType,
    publicId: instance.publicId,
    status: instance.status,
    theme,
    device,
    state: instance.config,
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(theme)}" data-device="${escapeHtml(device)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <base href="/widgets/${escapeHtml(widgetType)}/" />
    ${stylesheetLinks}
    <style nonce="${escapeHtml(nonce)}">html,body{margin:0;padding:0}</style>
    <script nonce="${escapeHtml(nonce)}">window.CK_WIDGET=${ckWidgetJson};</script>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;
}

function renderErrorPage({ publicId, status, message }: { publicId: string; status: number; message: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Clickeen widget error</title>
    <style>
      body { font-family: system-ui, sans-serif; background:#f1f5f9; color:#0f172a; margin:0; display:flex; align-items:center; justify-content:center; min-height:100vh; }
      .card { background:#fff; padding:32px; border-radius:20px; box-shadow:0 24px 60px rgba(15,23,42,0.12); max-width:480px; text-align:center; }
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

function buildCsp(nonce: string, parisOrigin: string) {
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "img-src 'self' data: https:",
    "font-src https://fonts.gstatic.com data:",
    `connect-src 'self' ${escapeHtml(parisOrigin)}`,
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

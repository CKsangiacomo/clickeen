import { NextResponse } from 'next/server';
import { parisJson, getParisBase } from '@venice/lib/paris';
import { escapeHtml, stringify } from '@venice/lib/html';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface InstanceResponse {
  publicId: string;
  status: 'draft' | 'published' | 'inactive';
  widgetType?: string | null;
  config: Record<string, unknown>;
  branding?: { hide?: boolean; enforced?: boolean };
  updatedAt?: string;
}

const CACHE_PUBLISHED = 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800';
const CACHE_DRAFT = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300';

export async function GET(req: Request, { params }: { params: { publicId: string } }) {
  const url = new URL(req.url);
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const device = url.searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop';
  const ts = url.searchParams.get('ts');
  const preview = url.searchParams.get('preview') === '1' || url.searchParams.get('preview') === 'true';

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
    `/api/instance/${encodeURIComponent(params.publicId)}`,
    {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    const status = res.status === 401 || res.status === 403 ? 403 : res.status;
    const html = renderErrorPage({
      publicId: params.publicId,
      status,
      message: stringify(body),
    });
    headers['Cache-Control'] = 'no-store';
    return new NextResponse(html, { status, headers });
  }

  const instance = body as InstanceResponse;
  const branding = instance.branding ?? { hide: false, enforced: instance.status !== 'published' };
  const nonce = crypto.randomUUID();
  const backlink = (!branding.hide) || Boolean(branding.enforced);
  let responseHtml = renderInstancePage({ instance, theme, device, branding, nonce });

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

  // Inject a tiny preview-only patch script (nonce'd) that lets the builder update
  // safe fields instantly via postMessage while typing. Never inject for production embeds.
  if (preview) {
    const allowed = (process.env.PREVIEW_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const script = `\n<script nonce="${escapeHtml(nonce)}">\n(() => {\n  const ALLOWED = ${JSON.stringify(allowed)};\n  function clamp(v, min, max){ v = Number(v); if(!Number.isFinite(v)) return min; return Math.max(min, Math.min(max, Math.round(v))); }\n  function mapColor(c){ return c === 'red' ? '#ef4444' : '#22c55e'; }\n  window.addEventListener('message', (event) => {\n    try {\n      if (!ALLOWED.includes(event.origin)) return;\n      const data = event.data || {};\n      if (data.type !== 'patch' || !data.widget || !data.fields) return;\n      // Only support testbutton in Phase-1 preview patching\n      if (String(data.widget) !== 'testbutton') return;\n      const fields = data.fields || {};\n      const btn = document.querySelector('[data-widget-element="button"]');\n      const label = document.querySelector('[data-widget-element="label"]');\n      if (!btn) return;\n      if (Object.prototype.hasOwnProperty.call(fields, 'text') && label) {\n        const t = String(fields.text ?? '');\n        label.textContent = t;\n      }\n      if (Object.prototype.hasOwnProperty.call(fields, 'color')) {\n        const col = String(fields.color) === 'red' ? 'red' : 'green';\n        btn.style.setProperty('--btn-bg', mapColor(col));\n      }\n      if (Object.prototype.hasOwnProperty.call(fields, 'radiusPx')) {\n        const px = clamp(fields.radiusPx, 0, 32);\n        btn.style.setProperty('--btn-radius', px + 'px');\n      }\n    } catch { /* ignore */ }\n  });\n})();\n</script>`;
    // Best-effort injection before </body>
    const idx = responseHtml.lastIndexOf('</body>');
    if (idx !== -1) {
      responseHtml = responseHtml.slice(0, idx) + script + responseHtml.slice(idx);
    } else {
      responseHtml += script;
    }
  }

  return new NextResponse(responseHtml, { status: 200, headers });
}

function renderInstancePage({
  instance,
  theme,
  device,
  branding,
  nonce,
}: {
  instance: InstanceResponse;
  theme: string;
  device: string;
  branding: { hide?: boolean; enforced?: boolean };
  nonce: string;
}) {
  const backlink = !branding.hide || branding.enforced;
  const updated = instance.updatedAt ? new Date(instance.updatedAt).toLocaleString() : 'unknown';

  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(theme)}" data-device="${escapeHtml(device)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(instance.widgetType ?? 'Clickeen widget')}</title>
    <style nonce="${escapeHtml(nonce)}">
      :root { color-scheme: ${theme === 'dark' ? 'dark' : 'light'}; }
      body {
        margin: 0;
        font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
        background: ${theme === 'dark' ? '#0b1120' : '#f1f5f9'};
        color: ${theme === 'dark' ? '#f8fafc' : '#0f172a'};
      }
      .widget-shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      }
      .widget {
        width: ${device === 'mobile' ? '360px' : '720px'};
        max-width: 100%;
        border-radius: 24px;
        background: ${theme === 'dark' ? '#111c2c' : '#ffffff'};
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
        padding: 32px;
        display: grid;
        gap: 24px;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 16px;
      }
      .meta h1 {
        font-size: 18px;
        margin: 0;
      }
      .meta span {
        font-size: 13px;
        opacity: 0.72;
      }
      .config pre {
        margin: 0;
        padding: 16px;
        border-radius: 16px;
        background: ${theme === 'dark' ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc'};
        overflow-x: auto;
        font-size: 13px;
        line-height: 1.45;
      }
      footer {
        font-size: 12px;
        border-top: 1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.06)'};
        padding-top: 16px;
        display: flex;
        justify-content: flex-end;
      }
      footer a {
        color: ${theme === 'dark' ? '#38bdf8' : '#0ea5e9'};
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="widget-shell">
      <article class="widget" role="region" aria-label="Clickeen widget">
        <header class="meta">
          <h1>${escapeHtml(instance.widgetType ?? 'Widget')}</h1>
          <span>Updated: ${escapeHtml(updated)}</span>
        </header>
        <section class="config">
          <pre>${stringify(instance.config)}</pre>
        </section>
        ${backlink ? `<footer><a href="https://clickeen.com/?ref=widget&id=${escapeHtml(instance.publicId)}" target="_blank" rel="noopener">Made with Clickeen</a></footer>` : ''}
      </article>
    </div>
    <img src="/embed/pixel?widget=${encodeURIComponent(instance.publicId)}&event=load&ts=${Date.now()}" alt="" hidden>
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
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

function buildCsp(nonce: string, parisOrigin: string) {
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
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

import { NextResponse } from 'next/server';
import { tokyoFetch } from '@venice/lib/tokyo';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const META_FP_RE = /^[a-f0-9]{64}\.json$/i;
const LOCALE_JSON_RE = /^[A-Za-z0-9_-]+\.json$/;

function isAllowedRenderPath(parts: string[]): boolean {
  if (parts[0] !== 'widgets') return false;
  const instanceId = parts[1] || '';
  if (!instanceId) return false;

  if (parts.length === 3) {
    return parts[2] === 'config.json';
  }
  if (parts.length === 4) {
    return parts[2] === 'live' && parts[3] === 'r.json';
  }
  if (parts.length === 5 && parts[2] === 'meta') {
    if (parts[3] === 'live') return LOCALE_JSON_RE.test(parts[4] || '');
    return parts[3] !== 'live' && META_FP_RE.test(parts[4] || '');
  }

  return false;
}

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const parts = Array.isArray(path) ? path.map((p) => String(p || '').replace(/^\/+|\/+$/g, '')).filter(Boolean) : [];
  if (parts.length === 0 || !isAllowedRenderPath(parts)) return new NextResponse('NOT_FOUND', { status: 404 });

  const pathname = `/renders/${parts.join('/')}`;
  const res = await tokyoFetch(pathname, { method: 'GET' });

  const headers = new Headers();
  const contentType = res.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const cacheControl = res.headers.get('cache-control');
  headers.set('Cache-Control', cacheControl || 'no-store');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-Content-Type-Options', 'nosniff');

  // Stream through (avoid buffering) so Edge runtime can proxy large assets safely.
  return new NextResponse(res.body, { status: res.status, headers });
}

export async function HEAD(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const res = await GET(req, ctx);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}

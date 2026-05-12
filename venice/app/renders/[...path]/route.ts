import { normalizeTokyoPathParts, proxyTokyoPath } from '@venice/lib/tokyo-proxy';

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
  return proxyTokyoPath({
    prefix: 'renders',
    parts: normalizeTokyoPathParts(path),
    allowed: isAllowedRenderPath,
    defaultCache: 'no-store',
    method: 'GET',
  });
}

export async function HEAD(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyTokyoPath({
    prefix: 'renders',
    parts: normalizeTokyoPathParts(path),
    allowed: isAllowedRenderPath,
    defaultCache: 'no-store',
    method: 'HEAD',
  });
}

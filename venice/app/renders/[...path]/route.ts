import {
  isCompactAccountPublicId,
  isCompactInstanceId,
} from '@clickeen/ck-contracts/overlay-identity';
import { normalizeTokyoPathParts, proxyTokyoPath } from '@venice/lib/tokyo-proxy';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const META_FP_RE = /^[a-f0-9]{64}\.json$/i;
const LOCALE_JSON_RE = /^[A-Za-z0-9_-]+\.json$/;
const OVERLAY_ID_JSON_RE = /^[0-9A-Z]{35}\.json$/;

function isAllowedRenderPath(parts: string[]): boolean {
  if (parts[0] !== 'accounts') return false;
  const accountPublicId = parts[1] || '';
  if (!isCompactAccountPublicId(accountPublicId)) return false;
  if (parts[2] !== 'instances') return false;
  const instanceId = parts[3] || '';
  if (!isCompactInstanceId(instanceId)) return false;
  const tail = parts.slice(4);

  if (tail.length === 1) {
    return tail[0] === 'config.json';
  }
  if (tail.length === 2) {
    if (tail[0] === 'overlays') return OVERLAY_ID_JSON_RE.test(tail[1] || '');
    return tail[0] === 'live' && tail[1] === 'r.json';
  }
  if (tail.length === 3 && tail[0] === 'meta') {
    if (tail[1] === 'live') return LOCALE_JSON_RE.test(tail[2] || '');
    return tail[1] !== 'live' && META_FP_RE.test(tail[2] || '');
  }

  return false;
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyTokyoPath({
    request: req,
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
    request: req,
  });
}

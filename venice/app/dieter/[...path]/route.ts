import { normalizeTokyoPathParts, proxyTokyoPath } from '@venice/lib/tokyo-proxy';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const SIMPLE_FILE_RE = /^[A-Za-z0-9._-]+$/;
const COMPONENT_RE = /^[a-z0-9-]+$/;
const ICON_RE = /^[A-Za-z0-9._-]+\.svg$/;

function isAllowedDieterPath(parts: string[]): boolean {
  if (parts.length === 1) return parts[0] === 'manifest.json';
  if (parts[0] === 'tokens' && parts.length === 2) return SIMPLE_FILE_RE.test(parts[1] || '') && parts[1].endsWith('.css');
  if (parts[0] === 'icons' && parts.length === 2) return parts[1] === 'icons.json';
  if (parts[0] === 'icons' && parts[1] === 'svg' && parts.length === 3) return ICON_RE.test(parts[2] || '');
  if (parts[0] === 'components' && parts.length === 3) {
    const component = parts[1] || '';
    const filename = parts[2] || '';
    return COMPONENT_RE.test(component) && filename.startsWith(`${component}.`) && /\.(css|html|js|json)$/.test(filename);
  }
  return false;
}

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyTokyoPath({
    prefix: 'dieter',
    parts: normalizeTokyoPathParts(path),
    allowed: isAllowedDieterPath,
    defaultCache: 'public, max-age=3600, s-maxage=86400',
    method: 'GET',
  });
}

export async function HEAD(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyTokyoPath({
    prefix: 'dieter',
    parts: normalizeTokyoPathParts(path),
    allowed: isAllowedDieterPath,
    defaultCache: 'public, max-age=3600, s-maxage=86400',
    method: 'HEAD',
  });
}

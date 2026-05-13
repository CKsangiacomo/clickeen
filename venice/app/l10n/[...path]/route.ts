import { normalizeTokyoPathParts, proxyTokyoPath } from '@venice/lib/tokyo-proxy';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function isAllowedL10nPath(parts: string[]): boolean {
  if (parts[0] !== 'widgets') return false;
  const instanceId = parts[1] || '';
  if (!instanceId) return false;

  if (parts.length === 3) {
    return parts[2] === 'index.json';
  }
  if (parts.length === 4) {
    const locale = parts[2] || '';
    return Boolean(locale) && parts[3] === 'overlay.json';
  }

  return false;
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyTokyoPath({
    request: req,
    prefix: 'l10n',
    parts: normalizeTokyoPathParts(path),
    allowed: isAllowedL10nPath,
    defaultCache: 'no-store',
    method: 'GET',
  });
}

export async function HEAD(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyTokyoPath({
    prefix: 'l10n',
    parts: normalizeTokyoPathParts(path),
    allowed: isAllowedL10nPath,
    defaultCache: 'no-store',
    method: 'HEAD',
    request: req,
  });
}

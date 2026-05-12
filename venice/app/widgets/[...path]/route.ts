import { normalizeTokyoPathParts, proxyTokyoPath } from '@venice/lib/tokyo-proxy';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const WIDGET_RE = /^[a-z0-9-]+$/;
const SIMPLE_FILE_RE = /^[A-Za-z0-9._-]+$/;

function isAllowedWidgetPath(parts: string[]): boolean {
  const widget = parts[0] || '';
  if (!WIDGET_RE.test(widget)) return false;
  if (widget === 'shared') return parts.length === 2 && SIMPLE_FILE_RE.test(parts[1] || '') && /\.(css|js)$/.test(parts[1] || '');
  if (parts.length === 2) {
    const file = parts[1] || '';
    return file === 'agent.md' || file === 'limits.json' || file === 'localization.json' || file === 'spec.json' || /^widget\.(css|html|client\.js|dom\.js)$/.test(file);
  }
  if (parts.length === 3 && parts[1] === 'layers') return parts[2] === 'user.allowlist.json';
  if (parts.length >= 3 && parts[1] === 'base-assets') return parts.slice(2).every((part) => SIMPLE_FILE_RE.test(part));
  return false;
}

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyTokyoPath({
    prefix: 'widgets',
    parts: normalizeTokyoPathParts(path),
    allowed: isAllowedWidgetPath,
    defaultCache: 'public, max-age=3600, s-maxage=86400',
    method: 'GET',
  });
}

export async function HEAD(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyTokyoPath({
    prefix: 'widgets',
    parts: normalizeTokyoPathParts(path),
    allowed: isAllowedWidgetPath,
    defaultCache: 'public, max-age=3600, s-maxage=86400',
    method: 'HEAD',
  });
}

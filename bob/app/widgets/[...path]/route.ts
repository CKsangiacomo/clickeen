import { NextRequest } from 'next/server';
import { proxyTokyoStaticPath } from '../../../lib/tokyo-static-proxy';

export const runtime = 'edge';

export async function GET(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const segments = Array.isArray(params.path) ? params.path : [];
  return proxyTokyoStaticPath(request, 'widgets', segments, 'GET');
}

export async function HEAD(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const segments = Array.isArray(params.path) ? params.path : [];
  return proxyTokyoStaticPath(request, 'widgets', segments, 'HEAD');
}

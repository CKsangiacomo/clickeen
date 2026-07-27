import { NextRequest } from 'next/server';
import { proxyTokyoStaticPath } from '../../../../../lib/tokyo-static-proxy';

export const runtime = 'edge';

export async function GET(request: NextRequest, ctx: { params: Promise<{ icon: string }> }) {
  const { icon } = await ctx.params;
  return proxyTokyoStaticPath(request, 'dieter', ['icons', 'svg', icon], 'GET');
}

export async function HEAD(request: NextRequest, ctx: { params: Promise<{ icon: string }> }) {
  const { icon } = await ctx.params;
  return proxyTokyoStaticPath(request, 'dieter', ['icons', 'svg', icon], 'HEAD');
}

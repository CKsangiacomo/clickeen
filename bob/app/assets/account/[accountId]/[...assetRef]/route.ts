import { NextRequest } from 'next/server';
import { proxyTokyoAccountAsset } from '../../../../../lib/tokyo-static-proxy';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ accountId: string; assetRef: string[] }> },
) {
  return proxyTokyoAccountAsset(request, await ctx.params, 'GET');
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ accountId: string; assetRef: string[] }> },
) {
  return proxyTokyoAccountAsset(request, await ctx.params, 'HEAD');
}

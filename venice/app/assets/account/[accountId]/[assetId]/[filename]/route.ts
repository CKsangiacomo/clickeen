import { NextRequest } from 'next/server';
import { proxyTokyoAccountAsset } from '../../../../../../lib/tokyo-proxy';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ accountId: string; assetId: string; filename: string }> },
) {
  return proxyTokyoAccountAsset(request, await context.params, 'GET');
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ accountId: string; assetId: string; filename: string }> },
) {
  return proxyTokyoAccountAsset(request, await context.params, 'HEAD');
}

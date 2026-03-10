import { NextRequest } from 'next/server';
import { proxyToParis } from '../../../../../../../lib/api/paris-proxy';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { accountId, publicId } = await context.params;
  return proxyToParis(request, {
    method: 'GET',
    path: `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/localization`,
  });
}

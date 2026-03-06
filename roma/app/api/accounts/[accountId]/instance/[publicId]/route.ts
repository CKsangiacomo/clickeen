import { NextRequest } from 'next/server';
import { proxyToParis } from '../../../../../../lib/api/paris-proxy';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { accountId, publicId } = await context.params;
  return proxyToParis(request, {
    method: 'GET',
    path: `/api/accounts/${encodeURIComponent(String(accountId || '').trim())}/instance/${encodeURIComponent(
      String(publicId || '').trim(),
    )}`,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { accountId, publicId } = await context.params;
  return proxyToParis(request, {
    method: 'PUT',
    path: `/api/accounts/${encodeURIComponent(String(accountId || '').trim())}/instance/${encodeURIComponent(
      String(publicId || '').trim(),
    )}`,
  });
}

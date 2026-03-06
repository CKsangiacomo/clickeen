import { NextRequest } from 'next/server';
import { proxyToParis } from '../../../../../../lib/api/paris-proxy';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { accountId } = await context.params;
  return proxyToParis(request, {
    method: 'POST',
    path: `/api/accounts/${encodeURIComponent(String(accountId || '').trim())}/instances/unpublish`,
  });
}


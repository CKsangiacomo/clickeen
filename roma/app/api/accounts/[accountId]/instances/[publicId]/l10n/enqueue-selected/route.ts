import { NextRequest } from 'next/server';
import { proxyToParis } from '../../../../../../../../lib/api/paris-proxy';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { accountId, publicId } = await context.params;
  return proxyToParis(request, {
    method: 'POST',
    path: `/api/accounts/${encodeURIComponent(String(accountId || '').trim())}/instances/${encodeURIComponent(
      String(publicId || '').trim(),
    )}/l10n/enqueue-selected`,
  });
}

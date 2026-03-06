import { NextRequest } from 'next/server';
import { proxyToParis } from '../../../../../../../../../lib/api/paris-proxy';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string; locale: string }> };

function resolvePath(accountId: string, publicId: string, locale: string): string {
  return `/api/accounts/${encodeURIComponent(String(accountId || '').trim())}/instances/${encodeURIComponent(
    String(publicId || '').trim(),
  )}/layers/user/${encodeURIComponent(String(locale || '').trim())}`;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { accountId, publicId, locale } = await context.params;
  return proxyToParis(request, {
    method: 'PUT',
    path: resolvePath(accountId, publicId, locale),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { accountId, publicId, locale } = await context.params;
  return proxyToParis(request, {
    method: 'DELETE',
    path: resolvePath(accountId, publicId, locale),
  });
}

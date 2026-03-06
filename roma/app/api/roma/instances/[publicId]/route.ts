import { NextRequest } from 'next/server';
import { proxyToParis } from '../../../../../lib/api/paris-proxy';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { publicId } = await context.params;
  return proxyToParis(request, {
    method: 'DELETE',
    path: `/api/roma/instances/${encodeURIComponent(String(publicId || '').trim())}`,
  });
}


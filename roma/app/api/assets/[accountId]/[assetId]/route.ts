import { NextRequest } from 'next/server';
import {
  DELETE as bobDelete,
  GET as bobGet,
  OPTIONS as bobOptions,
} from '../../../../../../bob/app/api/assets/[accountId]/[assetId]/route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; assetId: string }> };

export function OPTIONS() {
  return bobOptions();
}

export function GET(request: NextRequest, context: RouteContext) {
  return bobGet(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  const headers = new Headers(request.headers);
  headers.set('x-clickeen-surface', 'roma-assets');
  const delegated = new NextRequest(request, { headers });
  return bobDelete(delegated, context);
}

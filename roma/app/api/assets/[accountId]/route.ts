import type { NextRequest } from 'next/server';
import { GET as bobGet, OPTIONS as bobOptions } from '../../../../../bob/app/api/assets/[accountId]/route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

export function OPTIONS() {
  return bobOptions();
}

export function GET(request: NextRequest, context: RouteContext) {
  return bobGet(request, context);
}

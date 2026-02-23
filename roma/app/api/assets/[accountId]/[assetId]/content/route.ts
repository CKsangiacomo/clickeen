import type { NextRequest } from 'next/server';
import {
  OPTIONS as bobOptions,
  PUT as bobPut,
} from '../../../../../../../bob/app/api/assets/[accountId]/[assetId]/content/route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; assetId: string }> };

export function OPTIONS() {
  return bobOptions();
}

export function PUT(request: NextRequest, context: RouteContext) {
  return bobPut(request, context);
}

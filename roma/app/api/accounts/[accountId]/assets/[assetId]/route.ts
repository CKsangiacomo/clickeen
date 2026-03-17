import { NextRequest, NextResponse } from 'next/server';
import {
  finalizeAccountAssetResponse,
  isUuid,
  proxyAccountAssetJson,
  resolveAccountAssetGatewayContext,
} from '../../../../../../lib/account-assets-gateway';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; assetId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { accountId, assetId } = await context.params;
  const normalizedAccountId = String(accountId || '').trim();
  const normalizedAssetId = String(assetId || '').trim();
  if (!isUuid(normalizedAccountId)) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
    });
  }
  if (!isUuid(normalizedAssetId)) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetId.invalid' } },
        { status: 422 },
      ),
    });
  }

  const gateway = await resolveAccountAssetGatewayContext({
    request,
    accountId: normalizedAccountId,
    minRole: 'editor',
  });
  if (!gateway.ok) return gateway.response;

  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'DELETE',
    path: `/__internal/assets/${encodeURIComponent(normalizedAccountId)}/${encodeURIComponent(normalizedAssetId)}`,
    passthroughSearchParams: request.nextUrl.searchParams,
  });
}

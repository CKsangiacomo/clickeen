import { NextRequest, NextResponse } from 'next/server';
import {
  finalizeAccountAssetResponse,
  isUuid,
  proxyAccountAssetJson,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ assetId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { assetId } = await context.params;
  const normalizedAssetId = String(assetId || '').trim();
  if (!isUuid(normalizedAssetId)) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetId.invalid' } },
        { status: 422 },
      ),
    });
  }

  const gateway = await resolveCurrentAccountAssetGatewayContext({
    request,
    minRole: 'editor',
  });
  if (!gateway.ok) return gateway.response;

  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'DELETE',
    path: `/__internal/assets/${encodeURIComponent(gateway.value.accountId)}/${encodeURIComponent(normalizedAssetId)}`,
    passthroughSearchParams: request.nextUrl.searchParams,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { normalizeAccountAssetRef } from '@clickeen/ck-contracts';
import {
  finalizeAccountAssetResponse,
  proxyAccountAssetJson,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ assetRef: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { assetRef: rawAssetRef } = await context.params;
  const assetRef = normalizeAccountAssetRef(rawAssetRef);
  if (!assetRef || assetRef.includes('/')) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetRef.invalid' } },
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
    path: `/__internal/assets/account/${encodeURIComponent(gateway.value.accountId)}/asset/${encodeURIComponent(assetRef)}`,
    passthroughSearchParams: request.nextUrl.searchParams,
  });
}

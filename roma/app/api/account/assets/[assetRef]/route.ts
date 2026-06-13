import { NextRequest, NextResponse } from 'next/server';
import {
  finalizeAccountAssetResponse,
  proxyAccountAssetJson,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ assetRef: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { assetRef: rawAssetRef } = await context.params;
  if (
    typeof rawAssetRef !== 'string' ||
    !rawAssetRef ||
    rawAssetRef.trim() !== rawAssetRef ||
    rawAssetRef.includes('/') ||
    rawAssetRef.includes('\\') ||
    rawAssetRef.includes('..') ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(rawAssetRef)
  ) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetRef.invalid' } },
        { status: 422 },
      ),
    });
  }
  const assetRef = rawAssetRef;

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

import { NextRequest, NextResponse } from 'next/server';
import { isAccountAssetRef } from '@roma/lib/account-asset-record';
import {
  finalizeAccountAssetResponse,
  parseJsonOrNull,
  proxyAccountAssetJson,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const gateway = await resolveCurrentAccountAssetGatewayContext({
    request,
    minRole: 'viewer',
  });
  if (!gateway.ok) return gateway.response;

  const body = await request.text().catch(() => '');
  const requestPayload = parseJsonOrNull(body) as { assetRefs?: unknown } | null;
  const assetRefs = Array.isArray(requestPayload?.assetRefs) ? requestPayload.assetRefs : null;
  if (!assetRefs || assetRefs.some((assetRef) => !isAccountAssetRef(assetRef)) || new Set(assetRefs).size !== assetRefs.length) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.resolve.invalidAssetRefs' } },
        { status: 422 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }

  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'POST',
    path: `/__internal/assets/account/${encodeURIComponent(gateway.value.accountId)}/resolve`,
    contentType: 'application/json',
    body,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { isAccountAssetRef, parseResolvedAccountAsset } from '@roma/lib/account-asset-record';
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

  const requestedAssetRefs = assetRefs as string[];
  const requested = new Set(requestedAssetRefs);
  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'POST',
    path: `/__internal/assets/account/${encodeURIComponent(gateway.value.accountId)}/resolve`,
    contentType: 'application/json',
    body,
    validateSuccessPayload: (payload) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length !== 1 || !Object.prototype.hasOwnProperty.call(payload, 'assets')) return false;
      const assets = payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray((payload as { assets?: unknown }).assets) ? (payload as { assets: unknown[] }).assets : null;
      if (!assets || assets.length !== requestedAssetRefs.length) return false;
      const returned = new Set<string>();
      return assets.every((raw) => {
        const asset = parseResolvedAccountAsset(raw);
        return Boolean(asset && requested.has(asset.assetRef) && !returned.has(asset.assetRef) && returned.add(asset.assetRef));
      });
    },
  });
}

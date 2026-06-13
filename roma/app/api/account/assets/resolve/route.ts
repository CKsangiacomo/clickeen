import { NextRequest } from 'next/server';
import {
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

  const body = await request.text().catch(() => ''), requestPayload = parseJsonOrNull(body) as { assetRefs?: unknown } | null;
  const assetRefs = Array.isArray(requestPayload?.assetRefs) ? requestPayload.assetRefs : null;
  const requested = new Set(assetRefs?.filter((assetRef): assetRef is string => typeof assetRef === 'string') ?? []);
  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'POST',
    path: `/__internal/assets/account/${encodeURIComponent(gateway.value.accountId)}/resolve`,
    contentType: 'application/json',
    body,
    validateSuccessPayload: (payload) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).join(',') !== 'assets') return false;
      const assets = payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray((payload as { assets?: unknown }).assets) ? (payload as { assets: unknown[] }).assets : null;
      const returned = new Set<string>();
      return Boolean(assetRefs) && requested.size === assetRefs!.length && Boolean(assets) && assets!.length === assetRefs!.length && assets!.every((raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
        const asset = raw as { assetRef?: unknown; url?: unknown }, keys = Object.keys(raw);
        return keys.length === 2 && keys.includes('assetRef') && keys.includes('url') && typeof asset.assetRef === 'string' && typeof asset.url === 'string' && Boolean(asset.url) && requested.has(asset.assetRef) && !returned.has(asset.assetRef) && Boolean(returned.add(asset.assetRef));
      });
    },
  });
}

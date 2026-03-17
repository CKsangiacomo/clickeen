import { NextRequest } from 'next/server';
import {
  proxyAccountAssetJson,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const gateway = await resolveCurrentAccountAssetGatewayContext({
    request,
    minRole: 'viewer',
  });
  if (!gateway.ok) return gateway.response;

  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'GET',
    path: `/__internal/assets/account/${encodeURIComponent(gateway.value.accountId)}`,
    passthroughSearchParams: request.nextUrl.searchParams,
  });
}

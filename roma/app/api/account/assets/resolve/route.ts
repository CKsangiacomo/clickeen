import { NextRequest } from 'next/server';
import {
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

  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'POST',
    path: `/__internal/assets/account/${encodeURIComponent(gateway.value.accountId)}/resolve`,
    contentType: 'application/json',
    body: await request.text().catch(() => ''),
  });
}

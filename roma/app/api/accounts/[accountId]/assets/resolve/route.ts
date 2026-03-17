import { NextRequest, NextResponse } from 'next/server';
import {
  finalizeAccountAssetResponse,
  isUuid,
  proxyAccountAssetJson,
  resolveAccountAssetGatewayContext,
} from '../../../../../../lib/account-assets-gateway';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { accountId } = await context.params;
  const normalizedAccountId = String(accountId || '').trim();
  if (!isUuid(normalizedAccountId)) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
    });
  }

  const gateway = await resolveAccountAssetGatewayContext({
    request,
    accountId: normalizedAccountId,
    minRole: 'viewer',
  });
  if (!gateway.ok) return gateway.response;

  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'POST',
    path: `/__internal/assets/account/${encodeURIComponent(normalizedAccountId)}/resolve`,
    contentType: 'application/json',
    body: await request.text().catch(() => ''),
  });
}

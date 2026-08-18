import { NextRequest, NextResponse } from 'next/server';
import {
  finalizeAccountAssetResponse,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';
import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from '@roma/lib/tokyo-asset-control';

export const runtime = 'edge';

type TokyoAccountAssetsPayload = {
  accountId: string;
  storageBytesUsed: number;
  assets: import('@clickeen/ck-contracts').AccountAssetRecord[];
};

export async function GET(request: NextRequest) {
  const gateway = await resolveCurrentAccountAssetGatewayContext({
    request,
    minRole: 'viewer',
  });
  if (!gateway.ok) return gateway.response;

  try {
    const upstream = await fetchTokyoAssetControl({
      path: `/__internal/assets/account/${encodeURIComponent(gateway.value.accountId)}${request.nextUrl.search}`,
      method: 'GET',
      headers: buildTokyoAssetControlHeaders({
        accountId: gateway.value.accountId,
        accountCapsule: gateway.value.accountCapsule,
        requestId: gateway.value.requestId,
      }),
    });

    const body = (await upstream.json()) as TokyoAccountAssetsPayload;
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(body, { status: upstream.status }),
      setCookies: gateway.value.sessionSetCookies,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'roma.errors.proxy.tokyo_unavailable', detail } },
        { status: 502 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }
}

import { normalizeAccountAssetRecord } from '@clickeen/ck-contracts';
import { NextRequest, NextResponse } from 'next/server';
import {
  finalizeAccountAssetResponse,
  parseJsonOrNull,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';
import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from '@roma/lib/tokyo-asset-control';

export const runtime = 'edge';

type TokyoAccountAssetsPayload = {
  accountId?: unknown;
  storageBytesUsed?: unknown;
  assets?: unknown;
  error?: { kind?: unknown; reasonKey?: unknown; detail?: unknown };
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
      }),
    });

    const text = await upstream.text().catch(() => '');
    const payload = parseJsonOrNull(text) as TokyoAccountAssetsPayload | null;
    if (!upstream.ok) {
      const body =
        payload && typeof payload === 'object'
          ? payload
          : {
              error: {
                kind: 'INTERNAL',
                reasonKey: `HTTP_${upstream.status}`,
                ...(text ? { detail: text } : {}),
              },
            };
      return finalizeAccountAssetResponse({
        request,
        response: NextResponse.json(body, { status: upstream.status }),
        setCookies: gateway.value.sessionSetCookies,
      });
    }

    const assets = Array.isArray(payload?.assets)
      ? payload.assets
          .map(normalizeAccountAssetRecord)
          .filter((asset) => Boolean(asset))
      : [];
    const body = {
      accountId:
        typeof payload?.accountId === 'string' && payload.accountId.trim()
          ? payload.accountId.trim()
          : gateway.value.accountId,
      ...(typeof payload?.storageBytesUsed === 'number' && Number.isFinite(payload.storageBytesUsed)
        ? { storageBytesUsed: Math.max(0, Math.trunc(payload.storageBytesUsed)) }
        : {}),
      assets,
    };
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(body, { status: 200 }),
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

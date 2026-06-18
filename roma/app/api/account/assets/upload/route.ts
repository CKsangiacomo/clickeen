import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import { parseAccountAssetRecord } from '@roma/lib/account-asset-record';
import {
  accountAssetUploadOptionsResponse,
  finalizeAccountAssetResponse,
  parseJsonOrNull,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';
import { isTokyoAssetUsageError, readAccountStorageBytesUsed } from '@roma/lib/account-storage-usage';
import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from '@roma/lib/tokyo-asset-control';

export const runtime = 'edge';

export function OPTIONS() {
  return accountAssetUploadOptionsResponse();
}

function resolvePositiveLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function accountLimitResponse(args: {
  request: NextRequest;
  setCookies: Parameters<typeof finalizeAccountAssetResponse>[0]['setCookies'];
  detail: string;
}) {
  return finalizeAccountAssetResponse({
    request: args.request,
    response: NextResponse.json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.limitReached',
          detail: args.detail,
        },
      },
      { status: 403 },
    ),
    setCookies: args.setCookies,
  });
}

export async function POST(request: NextRequest) {
  const gateway = await resolveCurrentAccountAssetGatewayContext({
    request,
    minRole: 'editor',
  });
  if (!gateway.ok) return gateway.response;

  const filename = request.headers.get('x-filename');
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength <= 0) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }

  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: gateway.value.authzPayload.profile,
    role: gateway.value.authzPayload.role,
    entitlements: gateway.value.authzPayload.entitlements ?? null,
  });
  const uploadSizeLimit = resolvePositiveLimit(policy.limits['uploads.size.max']);
  const storageLimit = resolvePositiveLimit(policy.limits['storage.bytes.max']);
  const uploadBytes = contentLength !== null && Number.isFinite(contentLength) ? Math.trunc(contentLength) : null;

  if ((uploadSizeLimit !== null || storageLimit !== null) && uploadBytes === null) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: 'content_length_required_for_account_asset_limits',
          },
        },
        { status: 411 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }

  if (uploadBytes !== null && uploadSizeLimit !== null && uploadBytes > uploadSizeLimit) {
    return accountLimitResponse({
      request,
      setCookies: gateway.value.sessionSetCookies,
      detail: 'uploads.size.max',
    });
  }

  if (uploadBytes !== null && storageLimit !== null) {
    try {
      const storageBytesUsed = await readAccountStorageBytesUsed({
        accountId: gateway.value.accountId,
        accountCapsule: gateway.value.accountCapsule,
        requestId: gateway.value.requestId,
      });
      if (storageBytesUsed + uploadBytes > storageLimit) {
        return accountLimitResponse({
          request,
          setCookies: gateway.value.sessionSetCookies,
          detail: 'storage.bytes.max',
        });
      }
    } catch (error) {
      if (isTokyoAssetUsageError(error)) {
        return finalizeAccountAssetResponse({
          request,
          response: NextResponse.json(
            {
              error: {
                kind: error.kind,
                reasonKey: error.reasonKey,
                ...(error.detail ? { detail: error.detail } : {}),
              },
            },
            { status: error.status },
          ),
          setCookies: gateway.value.sessionSetCookies,
        });
      }
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

  const bodyStream = request.body;
  if (!bodyStream) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }

  const headerAccountId = (request.headers.get('x-account-id') || '').trim();
  if (headerAccountId) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }

  let headers: Headers;
  try {
    headers = buildTokyoAssetControlHeaders({
      accountId: gateway.value.accountId,
      accountCapsule: gateway.value.accountCapsule,
      requestId: gateway.value.requestId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail } },
        { status: 500 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }

  const contentType = request.headers.get('content-type');
  const source = request.headers.get('x-source');
  if (contentType) headers.set('content-type', contentType);
  if (filename) headers.set('x-filename', filename);
  if (source) headers.set('x-source', source);
  headers.set('x-upload-size-max', uploadSizeLimit === null ? 'unlimited' : String(uploadSizeLimit));
  headers.set('x-storage-bytes-max', storageLimit === null ? 'unlimited' : String(storageLimit));

  try {
    const upstream = await fetchTokyoAssetControl({
      path: '/__internal/assets/upload',
      method: 'POST',
      headers,
      body: bodyStream,
    });

    const text = await upstream.text().catch(() => '');
    const payload = parseJsonOrNull(text);
    const assetRecord = upstream.ok ? parseAccountAssetRecord(payload) : null;
    const body = upstream.ok
      ? assetRecord
      : payload && typeof payload === 'object'
        ? payload
        : {
            error: {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.assets.uploadFailed',
              detail: text || `tokyo upload failed (HTTP ${upstream.status})`,
            },
          };

    if (upstream.ok && !body) {
      return finalizeAccountAssetResponse({
        request,
        response: NextResponse.json(
          { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.assets.uploadFailed' } },
          { status: 502 },
        ),
        setCookies: gateway.value.sessionSetCookies,
      });
    }

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

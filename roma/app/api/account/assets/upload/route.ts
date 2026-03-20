import { NextRequest, NextResponse } from 'next/server';
import { normalizeAccountAssetRecord } from '@clickeen/ck-contracts';
import {
  accountAssetUploadOptionsResponse,
  finalizeAccountAssetResponse,
  parseJsonOrNull,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';
import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from '@roma/lib/tokyo-asset-control';

export const runtime = 'edge';

export function OPTIONS() {
  return accountAssetUploadOptionsResponse();
}

export async function POST(request: NextRequest) {
  const gateway = await resolveCurrentAccountAssetGatewayContext({
    request,
    minRole: 'editor',
  });
  if (!gateway.ok) return gateway.response;

  const filename = (request.headers.get('x-filename') || '').trim() || 'upload.bin';
  const contentLength = Number(request.headers.get('content-length') || '');
  if (Number.isFinite(contentLength) && contentLength <= 0) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
        { status: 422 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
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

  const source = (request.headers.get('x-source') || '').trim();
  if (source) headers.set('x-source', source);

  const contentType = (request.headers.get('content-type') || '').trim() || 'application/octet-stream';
  headers.set('content-type', contentType);
  headers.set('x-filename', filename);

  try {
    const upstream = await fetchTokyoAssetControl({
      path: '/__internal/assets/upload',
      method: 'POST',
      headers,
      body: bodyStream,
    });

    const text = await upstream.text().catch(() => '');
    const payload = parseJsonOrNull(text);
    const body = upstream.ok
      ? normalizeAccountAssetRecord(payload)
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

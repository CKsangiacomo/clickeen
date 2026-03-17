import { NextRequest, NextResponse } from 'next/server';
import {
  ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
  accountAssetUploadOptionsResponse,
  finalizeAccountAssetResponse,
  isWidgetPublicId,
  isWidgetType,
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
    extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
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
      extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
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
      extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
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
      extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
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
      extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
    });
  }

  const publicId = (request.headers.get('x-public-id') || '').trim();
  if (publicId) {
    if (!isWidgetPublicId(publicId)) {
      return finalizeAccountAssetResponse({
        request,
        response: NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
          { status: 422 },
        ),
        setCookies: gateway.value.sessionSetCookies,
        extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
      });
    }
    headers.set('x-public-id', publicId);
  }

  const widgetType = (request.headers.get('x-widget-type') || '').trim().toLowerCase();
  if (widgetType) {
    if (!isWidgetType(widgetType)) {
      return finalizeAccountAssetResponse({
        request,
        response: NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } },
          { status: 422 },
        ),
        setCookies: gateway.value.sessionSetCookies,
        extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
      });
    }
    headers.set('x-widget-type', widgetType);
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
    const body =
      payload && typeof payload === 'object'
        ? payload
        : {
            error: {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.assets.uploadFailed',
              detail: text || `tokyo upload failed (HTTP ${upstream.status})`,
            },
          };

    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(body, { status: upstream.status }),
      setCookies: gateway.value.sessionSetCookies,
      extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
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
      extraHeaders: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS,
    });
  }
}

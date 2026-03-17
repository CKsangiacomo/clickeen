import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../lib/account-authz-capsule';
import { resolveSessionBearer, type SessionCookieSpec, applySessionCookies } from '../../../../lib/auth/session';
import { resolveTokyoBaseUrl } from '../../../../lib/env/tokyo';
import { buildTokyoProductHeaders } from '../../../../lib/tokyo-product-auth';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-account-id, x-public-id, x-widget-type, x-filename, x-source, x-request-id',
} as const;

function withCorsAndSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  const next = applySessionCookies(response, request, setCookies);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => next.headers.set(key, value));
  return next;
}

function safeJsonParse(text: string): unknown | null {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isWidgetPublicId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

function isWidgetType(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) {
    return withCorsAndSession(request, session.response);
  }

  const accountId = (request.headers.get('x-account-id') || '').trim();
  if (!isUuid(accountId)) {
    return withCorsAndSession(
      request,
      NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 }),
      session.setCookies,
    );
  }
  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withCorsAndSession(request, NextResponse.json({ error: authz.error }, { status: authz.status }), session.setCookies);
  }

  const legacyVariant = (request.headers.get('x-variant') || '').trim();
  if (legacyVariant) {
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.variantUnsupported' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const filename = (request.headers.get('x-filename') || '').trim() || 'upload.bin';

  let tokyoBase = '';
  try {
    tokyoBase = resolveTokyoBaseUrl().replace(/\/$/, '');
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return withCorsAndSession(
      request,
      NextResponse.json({ error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail: messageText } }, { status: 500 }),
      session.setCookies,
    );
  }

  const contentLength = Number(request.headers.get('content-length') || '');
  if (Number.isFinite(contentLength) && contentLength <= 0) {
    return withCorsAndSession(
      request,
      NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 }),
      session.setCookies,
    );
  }

  const bodyStream = request.body;
  if (!bodyStream) {
    return withCorsAndSession(
      request,
      NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 }),
      session.setCookies,
    );
  }

  const headers = buildTokyoProductHeaders({
    accountId,
    accountCapsule: authz.token,
  });

  const publicId = (request.headers.get('x-public-id') || '').trim();
  if (publicId) {
    if (!isWidgetPublicId(publicId)) {
      return withCorsAndSession(
        request,
        NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } }, { status: 422 }),
        session.setCookies,
      );
    }
    headers.set('x-public-id', publicId);
  }

  const widgetType = (request.headers.get('x-widget-type') || '').trim().toLowerCase();
  if (widgetType) {
    if (!isWidgetType(widgetType)) {
      return withCorsAndSession(
        request,
        NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } }, { status: 422 }),
        session.setCookies,
      );
    }
    headers.set('x-widget-type', widgetType);
  }

  const source = (request.headers.get('x-source') || '').trim();
  if (source) headers.set('x-source', source);

  const contentType = (request.headers.get('content-type') || '').trim() || 'application/octet-stream';
  headers.set('content-type', contentType);
  headers.set('x-filename', filename);

  try {
    const tokyoUrl = `${tokyoBase}/assets/upload?_t=${Date.now()}`;
    const res = await fetch(tokyoUrl, {
      method: 'POST',
      headers,
      body: bodyStream,
      cache: 'no-store',
    });

    const text = await res.text().catch(() => '');
    const payload = safeJsonParse(text);

    if (!res.ok) {
      if (payload && typeof payload === 'object' && (payload as any).error) {
        return withCorsAndSession(request, NextResponse.json(payload, { status: res.status }), session.setCookies);
      }
      return withCorsAndSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.assets.uploadFailed',
              detail: text || `tokyo upload failed (HTTP ${res.status})`,
            },
          },
          { status: 502 },
        ),
        session.setCookies,
      );
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return withCorsAndSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.assets.uploadFailed',
              detail: 'tokyo upload response missing JSON payload',
            },
          },
          { status: 502 },
        ),
        session.setCookies,
      );
    }

    return withCorsAndSession(request, NextResponse.json(payload, { status: 200 }), session.setCookies);
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.assets.uploadFailed', detail: messageText } },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

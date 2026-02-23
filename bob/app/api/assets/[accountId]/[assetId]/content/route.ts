import { NextRequest, NextResponse } from 'next/server';
import { isUuid, isWidgetPublicId } from '@clickeen/ck-contracts';
import { applySessionCookies } from '../../../../../../lib/api/paris/proxy-helpers';
import { resolveParisBaseUrl } from '../../../../../../lib/env/paris';
import {
  isDevstudioLocalBootstrapRequest,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '../../../../../../lib/auth/session';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-account-id, x-workspace-id, x-public-id, x-widget-type, x-filename, x-variant, x-source, idempotency-key',
} as const;

type RouteContext = { params: Promise<{ accountId: string; assetId: string }> };

function safeJsonParse(text: string): unknown | null {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function withCorsAndSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  const next = applySessionCookies(response, request, setCookies);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => next.headers.set(key, value));
  return next;
}

function isWidgetType(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

function resolveIdempotencyKey(request: NextRequest): string {
  const incoming = (request.headers.get('idempotency-key') || '').trim();
  if (incoming) return incoming;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request, {
    allowLocalDevBootstrap: isDevstudioLocalBootstrapRequest(request),
  });
  if (!session.ok) {
    return withCorsAndSession(request, session.response);
  }

  const params = await context.params;
  const accountId = String(params.accountId || '').trim();
  const assetId = String(params.assetId || '').trim();
  if (!isUuid(accountId)) {
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }
  if (!isUuid(assetId)) {
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const workspaceId = (request.headers.get('x-workspace-id') || '').trim();
  if (workspaceId && !isUuid(workspaceId)) {
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const publicId = (request.headers.get('x-public-id') || '').trim();
  if (publicId && !isWidgetPublicId(publicId)) {
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const widgetType = (request.headers.get('x-widget-type') || '').trim().toLowerCase();
  if (widgetType && !isWidgetType(widgetType)) {
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  let parisBase = '';
  try {
    parisBase = resolveParisBaseUrl().replace(/\/$/, '');
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail: messageText } },
        { status: 500 },
      ),
      session.setCookies,
    );
  }

  const headers = new Headers();
  headers.set('authorization', `Bearer ${session.accessToken}`);
  headers.set('x-account-id', accountId);
  headers.set('x-filename', (request.headers.get('x-filename') || '').trim() || 'upload.bin');
  headers.set('x-variant', (request.headers.get('x-variant') || '').trim() || 'original');
  headers.set('idempotency-key', resolveIdempotencyKey(request));
  const source = (request.headers.get('x-source') || '').trim();
  if (source) headers.set('x-source', source);
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (publicId) headers.set('x-public-id', publicId);
  if (widgetType) headers.set('x-widget-type', widgetType);

  try {
    const body = await request.arrayBuffer();
    if (!body || body.byteLength === 0) {
      return withCorsAndSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } },
          { status: 422 },
        ),
        session.setCookies,
      );
    }

    headers.set('content-type', (request.headers.get('content-type') || '').trim() || 'application/octet-stream');

    const url = `${parisBase}/api/accounts/${encodeURIComponent(accountId)}/assets/${encodeURIComponent(assetId)}/content`;
    const res = await fetch(`${url}?_t=${Date.now()}`, {
      method: 'PUT',
      headers,
      body,
      cache: 'no-store',
    });

    const text = await res.text().catch(() => '');
    const payload = safeJsonParse(text);
    if (!res.ok) {
      if (payload && typeof payload === 'object' && (payload as Record<string, unknown>).error) {
        return withCorsAndSession(request, NextResponse.json(payload, { status: res.status }), session.setCookies);
      }
      return withCorsAndSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.assets.replaceFailed',
              detail: text || `replace request failed (HTTP ${res.status})`,
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
              reasonKey: 'coreui.errors.assets.replaceFailed',
              detail: 'replace response missing JSON payload',
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
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.assets.replaceFailed', detail: messageText } },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

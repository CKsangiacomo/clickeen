import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import { applySessionCookies } from '../../../../../lib/api/paris/proxy-helpers';
import { resolveParisBaseUrl } from '../../../../../lib/env/paris';
import {
  isDevstudioLocalBootstrapRequest,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '../../../../../lib/auth/session';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

type RouteContext = { params: Promise<{ accountId: string; assetId: string }> };

function withCorsAndSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  const next = applySessionCookies(response, request, setCookies);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => next.headers.set(key, value));
  return next;
}

function resolveParisAssetUrl(request: NextRequest, accountId: string, assetId: string): string {
  const parisBase = resolveParisBaseUrl().replace(/\/$/, '');
  const target = new URL(
    `${parisBase}/api/accounts/${encodeURIComponent(accountId)}/assets/${encodeURIComponent(assetId)}`,
  );
  request.nextUrl.searchParams.forEach((value, key) => {
    if (value) target.searchParams.set(key, value);
  });
  return target.toString();
}

async function forwardAssetRequest(
  request: NextRequest,
  context: RouteContext,
  method: 'GET' | 'DELETE',
): Promise<NextResponse> {
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

  const headers = new Headers();
  headers.set('authorization', `Bearer ${session.accessToken}`);

  try {
    const res = await fetch(resolveParisAssetUrl(request, accountId, assetId), {
      method,
      headers,
      cache: 'no-store',
    });
    const text = await res.text().catch(() => '');
    return withCorsAndSession(
      request,
      new NextResponse(text, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('Content-Type') || 'application/json',
        },
      }),
      session.setCookies,
    );
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.db.writeFailed', detail: messageText } },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function GET(request: NextRequest, context: RouteContext) {
  return forwardAssetRequest(request, context, 'GET');
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return forwardAssetRequest(request, context, 'DELETE');
}

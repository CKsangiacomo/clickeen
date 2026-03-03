import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionBearer, type SessionCookieSpec, applySessionCookies } from '../../../../lib/auth/session';
import { resolveParisBaseUrl } from '../../../../lib/env/paris';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

type RouteContext = { params: Promise<{ accountId: string }> };

function withCorsAndSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  const next = applySessionCookies(response, request, setCookies);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => next.headers.set(key, value));
  return next;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function resolveParisAssetsUrl(request: NextRequest, accountId: string): string {
  const parisBase = resolveParisBaseUrl().replace(/\/$/, '');
  const target = new URL(`${parisBase}/api/accounts/${encodeURIComponent(accountId)}/assets`);
  request.nextUrl.searchParams.forEach((value, key) => {
    if (value) target.searchParams.set(key, value);
  });
  return target.toString();
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) {
    return withCorsAndSession(request, session.response);
  }

  const params = await context.params;
  const accountId = String(params.accountId || '').trim();
  if (!isUuid(accountId)) {
    return withCorsAndSession(
      request,
      NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 }),
      session.setCookies,
    );
  }

  const headers = new Headers();
  headers.set('authorization', `Bearer ${session.accessToken}`);

  try {
    const res = await fetch(resolveParisAssetsUrl(request, accountId), {
      method: 'GET',
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
        { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.db.readFailed', detail: messageText } },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

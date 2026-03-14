import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../../../bob/lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../../../lib/auth/session';
import { resolveBerlinBaseUrl } from '../../../../../../lib/env/berlin';

export const runtime = 'edge';

type RouteContext = {
  params: Promise<{ accountId: string; memberId: string }>;
};

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function invalidIdResponse(request: NextRequest, setCookies: SessionCookieSpec[] | undefined, reasonKey: string) {
  return withSession(
    request,
    NextResponse.json({ error: { kind: 'VALIDATION', reasonKey } }, { status: 422 }),
    setCookies,
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw, memberId: memberIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const memberId = String(memberIdRaw || '').trim();
  if (!isUuid(accountId)) return invalidIdResponse(request, session.setCookies, 'coreui.errors.accountId.invalid');
  if (!isUuid(memberId)) return invalidIdResponse(request, session.setCookies, 'coreui.errors.account.memberId.invalid');

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(accountId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          accept: 'application/json',
        },
        cache: 'no-store',
      },
    );
    const body = await upstream.text().catch(() => '');
    return withSession(
      request,
      new NextResponse(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      }),
      session.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
        },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw, memberId: memberIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const memberId = String(memberIdRaw || '').trim();
  if (!isUuid(accountId)) return invalidIdResponse(request, session.setCookies, 'coreui.errors.accountId.invalid');
  if (!isUuid(memberId)) return invalidIdResponse(request, session.setCookies, 'coreui.errors.account.memberId.invalid');

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'admin',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(accountId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          'content-type': request.headers.get('content-type') || 'application/json',
          accept: request.headers.get('accept') || 'application/json',
        },
        cache: 'no-store',
        body: await request.text(),
      },
    );
    const body = await upstream.text().catch(() => '');
    return withSession(
      request,
      new NextResponse(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      }),
      session.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
        },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw, memberId: memberIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const memberId = String(memberIdRaw || '').trim();
  if (!isUuid(accountId)) return invalidIdResponse(request, session.setCookies, 'coreui.errors.accountId.invalid');
  if (!isUuid(memberId)) return invalidIdResponse(request, session.setCookies, 'coreui.errors.account.memberId.invalid');

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'admin',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(accountId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          accept: request.headers.get('accept') || 'application/json',
        },
        cache: 'no-store',
      },
    );
    const body = await upstream.text().catch(() => '');
    return withSession(
      request,
      new NextResponse(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      }),
      session.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
        },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

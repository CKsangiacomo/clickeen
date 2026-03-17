import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function invalidIdResponse(
  request: NextRequest,
  setCookies: Parameters<typeof withSession>[2],
  reasonKey: string,
) {
  return withSession(
    request,
    NextResponse.json({ error: { kind: 'VALIDATION', reasonKey } }, { status: 422 }),
    setCookies,
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const { memberId: memberIdRaw } = await context.params;
  const memberId = String(memberIdRaw || '').trim();
  if (!isUuid(memberId)) {
    return invalidIdResponse(request, current.value.setCookies, 'coreui.errors.account.memberId.invalid');
  }

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${current.value.accessToken}`,
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
      current.value.setCookies,
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
      current.value.setCookies,
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'admin' });
  if (!current.ok) return current.response;

  const { memberId: memberIdRaw } = await context.params;
  const memberId = String(memberIdRaw || '').trim();
  if (!isUuid(memberId)) {
    return invalidIdResponse(request, current.value.setCookies, 'coreui.errors.account.memberId.invalid');
  }

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${current.value.accessToken}`,
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
      current.value.setCookies,
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
      current.value.setCookies,
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'admin' });
  if (!current.ok) return current.response;

  const { memberId: memberIdRaw } = await context.params;
  const memberId = String(memberIdRaw || '').trim();
  if (!isUuid(memberId)) {
    return invalidIdResponse(request, current.value.setCookies, 'coreui.errors.account.memberId.invalid');
  }

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${current.value.accessToken}`,
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
      current.value.setCookies,
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
      current.value.setCookies,
    );
  }
}

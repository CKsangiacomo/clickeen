import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = {
  params: Promise<{ invitationId: string }>;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'admin' });
  if (!current.ok) return current.response;

  const { invitationId: invitationIdRaw } = await context.params;
  const invitationId = String(invitationIdRaw || '').trim();
  if (!isUuid(invitationId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.invitationNotFound' } },
        { status: 404 },
      ),
      current.value.setCookies,
    );
  }

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/invitations/${encodeURIComponent(invitationId)}`,
      {
        method: 'DELETE',
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

import { isUuid } from '@clickeen/ck-contracts';
import { NextRequest, NextResponse } from 'next/server';
import { proxyBerlinTextResponse } from '@roma/lib/berlin-proxy-route';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = {
  params: Promise<{ invitationId: string }>;
};

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

  return proxyBerlinTextResponse({
    request,
    accessToken: current.value.accessToken,
    setCookies: current.value.setCookies,
    path: `/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/invitations/${encodeURIComponent(invitationId)}`,
    method: 'DELETE',
  });
}

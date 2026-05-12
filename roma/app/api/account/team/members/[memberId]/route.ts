import { isUuid } from '@clickeen/ck-contracts';
import { NextRequest, NextResponse } from 'next/server';
import { proxyBerlinTextResponse } from '@roma/lib/berlin-proxy-route';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

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

  return proxyBerlinTextResponse({
    request,
    accessToken: current.value.accessToken,
    setCookies: current.value.setCookies,
    path: `/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/members/${encodeURIComponent(memberId)}`,
    method: 'GET',
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'admin' });
  if (!current.ok) return current.response;

  const { memberId: memberIdRaw } = await context.params;
  const memberId = String(memberIdRaw || '').trim();
  if (!isUuid(memberId)) {
    return invalidIdResponse(request, current.value.setCookies, 'coreui.errors.account.memberId.invalid');
  }

  return proxyBerlinTextResponse({
    request,
    accessToken: current.value.accessToken,
    setCookies: current.value.setCookies,
    path: `/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/members/${encodeURIComponent(memberId)}`,
    method: 'PATCH',
    accept: request.headers.get('accept'),
    contentType: request.headers.get('content-type'),
    body: await request.text(),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'admin' });
  if (!current.ok) return current.response;

  const { memberId: memberIdRaw } = await context.params;
  const memberId = String(memberIdRaw || '').trim();
  if (!isUuid(memberId)) {
    return invalidIdResponse(request, current.value.setCookies, 'coreui.errors.account.memberId.invalid');
  }

  return proxyBerlinTextResponse({
    request,
    accessToken: current.value.accessToken,
    setCookies: current.value.setCookies,
    path: `/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/members/${encodeURIComponent(memberId)}`,
    method: 'DELETE',
    accept: request.headers.get('accept'),
  });
}

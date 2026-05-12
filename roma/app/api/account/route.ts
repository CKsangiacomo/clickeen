import { NextRequest } from 'next/server';
import { proxyBerlinTextResponse } from '@roma/lib/berlin-proxy-route';
import { resolveCurrentAccountRouteContext } from './_lib/current-account-route';

export const runtime = 'edge';

export async function DELETE(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'owner' });
  if (!current.ok) return current.response;

  return proxyBerlinTextResponse({
    request,
    accessToken: current.value.accessToken,
    setCookies: current.value.setCookies,
    path: `/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}`,
    method: 'DELETE',
    accept: request.headers.get('accept'),
    contentType: request.headers.get('content-type'),
    body: await request.text(),
  });
}

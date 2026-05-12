import { NextRequest } from 'next/server';
import { proxyBerlinTextResponse } from '@roma/lib/berlin-proxy-route';
import { resolveCurrentAccountRouteContext } from '../../../_lib/current-account-route';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  return proxyBerlinTextResponse({
    request,
    accessToken: current.value.accessToken,
    setCookies: current.value.setCookies,
    path: `/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/lifecycle/tier-drop/dismiss`,
    method: 'POST',
    redirect: 'manual',
  });
}

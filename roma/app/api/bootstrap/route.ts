import { NextRequest } from 'next/server';
import { proxyBerlinTextResponse } from '@roma/lib/berlin-proxy-route';
import { resolveSessionBearer } from '../../../lib/auth/session';
import { withNoStore } from '../../../lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  return proxyBerlinTextResponse({
    request,
    accessToken: session.accessToken,
    setCookies: session.setCookies,
    path: '/v1/session/bootstrap',
    method: 'GET',
  });
}

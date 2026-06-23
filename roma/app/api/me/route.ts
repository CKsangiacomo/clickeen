import { NextRequest } from 'next/server';
import { proxyBerlinTextResponse } from '@roma/lib/berlin-proxy-route';
import { resolveSessionBearer } from '../../../lib/auth/session';
import { withNoStore } from '../../../lib/current-account-route';

export const runtime = 'edge';

async function proxyMe(request: NextRequest, method: 'GET' | 'PUT') {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  return proxyBerlinTextResponse({
    request,
    accessToken: session.accessToken,
    setCookies: session.setCookies,
    path: '/me',
    method,
    accept: request.headers.get('accept'),
    ...(method === 'PUT'
      ? { contentType: request.headers.get('content-type'), body: await request.text() }
      : {}),
  });
}

export async function GET(request: NextRequest) {
  return proxyMe(request, 'GET');
}

export async function PUT(request: NextRequest) {
  return proxyMe(request, 'PUT');
}

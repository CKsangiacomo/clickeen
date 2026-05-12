import { NextRequest } from 'next/server';
import { proxyBerlinTextResponse } from '@roma/lib/berlin-proxy-route';
import { resolveSessionBearer } from '../../../../../../lib/auth/session';
import { withNoStore } from '../../../../../../lib/current-account-route';

export const runtime = 'edge';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channel: string }> },
) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { channel } = await context.params;

  return proxyBerlinTextResponse({
    request,
    accessToken: session.accessToken,
    setCookies: session.setCookies,
    path: `/v1/me/contact-methods/${encodeURIComponent(channel)}/verify`,
    method: 'POST',
    accept: request.headers.get('accept'),
    contentType: request.headers.get('content-type'),
    body: await request.text(),
  });
}

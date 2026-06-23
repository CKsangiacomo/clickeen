import { isUuid } from '@clickeen/ck-contracts';
import { NextRequest, NextResponse } from 'next/server';
import { proxyBerlinTextResponse } from '@roma/lib/berlin-proxy-route';
import { resolveSessionBearer } from '../../../../../lib/auth/session';
import { withNoStore, withSession } from '../../../../../lib/current-account-route';

export const runtime = 'edge';

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { token: tokenRaw } = await context.params;
  const token = String(tokenRaw || '').trim();
  if (!isUuid(token)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.invitationNotFound' } },
        { status: 404 },
      ),
      session.setCookies,
    );
  }

  return proxyBerlinTextResponse({
    request,
    accessToken: session.accessToken,
    setCookies: session.setCookies,
    path: `/invitations/${encodeURIComponent(token)}/accept`,
    method: 'POST',
  });
}

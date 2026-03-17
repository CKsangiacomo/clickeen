import type { MemberRole, RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '@roma/lib/auth/session';

type CurrentAccountRouteContext = {
  accessToken: string;
  authzToken: string;
  authzPayload: RomaAccountAuthzCapsulePayload;
  setCookies?: SessionCookieSpec[];
};

export function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

export function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

export async function resolveCurrentAccountRouteContext(args: {
  request: NextRequest;
  minRole: MemberRole;
}): Promise<{ ok: true; value: CurrentAccountRouteContext } | { ok: false; response: NextResponse }> {
  const session = await resolveSessionBearer(args.request);
  if (!session.ok) {
    return { ok: false, response: withNoStore(session.response) };
  }

  const authz = await authorizeRequestRoleFromCapsule({
    request: args.request,
    minRole: args.minRole,
  });
  if (!authz.ok) {
    return {
      ok: false,
      response: withSession(
        args.request,
        NextResponse.json({ error: authz.error }, { status: authz.status }),
        session.setCookies,
      ),
    };
  }

  return {
    ok: true,
    value: {
      accessToken: session.accessToken,
      authzToken: authz.token,
      authzPayload: authz.payload,
      setCookies: session.setCookies,
    },
  };
}

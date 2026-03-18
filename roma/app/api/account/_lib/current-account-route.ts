import type { MemberRole, RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '@roma/lib/auth/session';
import { getOptionalCloudflareRequestContext } from '@roma/lib/cloudflare-request-context';
import {
  enforceRomaRateLimitForAccountRequest,
  finalizeRomaObservedResponse,
  type RomaRateLimitKv,
} from '@roma/lib/request-ops';

type CurrentAccountRouteContext = {
  accessToken: string;
  authzToken: string;
  authzPayload: RomaAccountAuthzCapsulePayload;
  setCookies?: SessionCookieSpec[];
  usageKv?: RomaRateLimitKv | null;
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
  const next = withNoStore(applySessionCookies(response, request, setCookies));
  return finalizeRomaObservedResponse(request, next);
}

export async function resolveCurrentAccountRouteContext(args: {
  request: NextRequest;
  minRole: MemberRole;
}): Promise<{ ok: true; value: CurrentAccountRouteContext } | { ok: false; response: NextResponse }> {
  const session = await resolveSessionBearer(args.request);
  if (!session.ok) {
    return { ok: false, response: withSession(args.request, session.response) };
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

  const usageKv =
    getOptionalCloudflareRequestContext<{ env?: { USAGE_KV?: RomaRateLimitKv } }>()?.env?.USAGE_KV ??
    null;

  const limited = await enforceRomaRateLimitForAccountRequest(
    args.request,
    authz.payload.accountId,
    usageKv,
  );
  if (limited) {
    return {
      ok: false,
      response: withSession(args.request, limited, session.setCookies),
    };
  }

  return {
    ok: true,
    value: {
      accessToken: session.accessToken,
      authzToken: authz.token,
      authzPayload: authz.payload,
      setCookies: session.setCookies,
      usageKv,
    },
  };
}

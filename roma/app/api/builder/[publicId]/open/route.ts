import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '@roma/lib/auth/session';
import { loadBuilderOpenEnvelope } from '@roma/lib/builder-open';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { publicId: publicIdRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const authz = await authorizeRequestRoleFromCapsule({
    request,
    minRole: 'viewer',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  const result = await loadBuilderOpenEnvelope({
    berlinBaseUrl: resolveBerlinBaseUrl(),
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    accessToken: session.accessToken,
    accountId: authz.payload.accountId,
    publicId,
    accountCapsule: authz.token,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      session.setCookies,
    );
  }

  return withSession(request, NextResponse.json(result.value), session.setCookies);
}

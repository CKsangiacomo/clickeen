import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../../../lib/account-authz-capsule';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '../../../../../../../lib/auth/session';
import { resolveBerlinBaseUrl } from '../../../../../../../lib/env/berlin';
import { resolveTokyoBaseUrl } from '../../../../../../../lib/env/tokyo';
import { loadAccountLocalizationSnapshot } from '../../../../../../../lib/account-l10n';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const publicId = String(publicIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }
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

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'viewer',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  try {
    const result = await loadAccountLocalizationSnapshot({
      berlinBaseUrl: resolveBerlinBaseUrl(),
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: session.accessToken,
      accountId,
      publicId,
    });

    return withSession(
      request,
      NextResponse.json({
        localization: result.snapshot,
      }),
      session.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.readFailed',
            detail,
          },
        },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

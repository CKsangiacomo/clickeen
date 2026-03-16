import { NextRequest, NextResponse } from 'next/server';
import {
  deleteLiveSurfaceFromTokyo,
  loadTokyoPreferredAccountInstance,
} from '@roma/lib/account-instance-direct';
import { authorizeRequestAccountRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '@roma/lib/auth/session';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';
import { updateAccountInstanceStatusRow } from '@roma/lib/michael';

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

export async function POST(request: NextRequest, context: RouteContext) {
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
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  const current = await loadTokyoPreferredAccountInstance({
    accountId,
    publicId,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken: session.accessToken,
    accountCapsule: authz.token,
  });
  if (!current.ok) {
    return withSession(
      request,
      NextResponse.json({ error: current.error }, { status: current.status }),
      session.setCookies,
    );
  }

  if (current.value.row.status === 'unpublished') {
    return withSession(
      request,
      NextResponse.json({ ok: true, publicId, status: 'unpublished', changed: false }),
      session.setCookies,
    );
  }

  const unpublishWrite = await updateAccountInstanceStatusRow({
    accountId,
    publicId,
    status: 'unpublished',
    berlinAccessToken: session.accessToken,
  });
  if (!unpublishWrite.ok) {
    const status = unpublishWrite.status === 401 ? 401 : unpublishWrite.status === 404 ? 404 : 502;
    const kind = status === 401 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: unpublishWrite.reasonKey,
            detail: unpublishWrite.detail,
          },
        },
        { status },
      ),
      session.setCookies,
    );
  }

  try {
    await deleteLiveSurfaceFromTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: session.accessToken,
      accountId,
      publicId,
      accountCapsule: authz.token,
    });
  } catch (error) {
    await updateAccountInstanceStatusRow({
      accountId,
      publicId,
      status: 'published',
      berlinAccessToken: session.accessToken,
    }).catch(() => undefined);

    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 502 },
      ),
      session.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({ ok: true, publicId, status: 'unpublished', changed: true }),
    session.setCookies,
  );
}

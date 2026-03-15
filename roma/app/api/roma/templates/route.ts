import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../bob/lib/account-authz-capsule';
import { loadTemplateCatalog } from '../../../../lib/michael';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../lib/auth/session';

export const runtime = 'edge';

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

export async function GET(request: NextRequest) {
  const session = await resolveSessionBearer(request);
  if (session.ok === false) return withNoStore(session.response);

  const accountId = request.nextUrl.searchParams.get('accountId')?.trim() || '';
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

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'viewer',
  });
  if (authz.ok === false) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  const templateCatalog = await loadTemplateCatalog(session.accessToken);
  if (templateCatalog.ok === false) {
    const kind =
      templateCatalog.status === 401
        ? 'AUTH'
        : templateCatalog.status === 403
          ? 'DENY'
          : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: templateCatalog.reasonKey,
            detail: templateCatalog.detail,
          },
        },
        { status: templateCatalog.status },
      ),
      session.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      account: {
        accountId,
      },
      widgetTypes: templateCatalog.widgetTypes,
      instances: templateCatalog.instances,
    }),
    session.setCookies,
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '@roma/lib/auth/session';
import { loadAccountWidgetCatalog } from '@roma/lib/michael';

export const runtime = 'edge';

type WidgetInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
  source: 'account' | 'curated';
  actions: {
    edit: boolean;
    duplicate: boolean;
    delete: boolean;
    rename: boolean;
    publish: boolean;
    unpublish: boolean;
  };
};

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

  const widgetCatalog = await loadAccountWidgetCatalog({
    accountId,
    berlinAccessToken: session.accessToken,
  });
  if (widgetCatalog.ok === false) {
    const kind =
      widgetCatalog.status === 401
        ? 'AUTH'
        : widgetCatalog.status === 403
          ? 'DENY'
          : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: widgetCatalog.reasonKey,
            detail: widgetCatalog.detail,
          },
        },
        { status: widgetCatalog.status },
      ),
      session.setCookies,
    );
  }

  const canMutate = authz.payload.role !== 'viewer';
  const canMutateCurated = canMutate && authz.payload.accountIsPlatform;

  const accountInstances: WidgetInstance[] = widgetCatalog.accountInstances.map((instance) => ({
    ...instance,
    source: 'account',
    actions: {
      edit: true,
      duplicate: canMutate,
      delete: canMutate,
      rename: true,
      publish: canMutate && !widgetCatalog.containment.active,
      unpublish: canMutate && instance.status === 'published',
    },
  }));

  const curatedInstances: WidgetInstance[] = widgetCatalog.curatedInstances.map((instance) => ({
    ...instance,
    source: 'curated',
    actions: {
      edit: true,
      duplicate: canMutate,
      delete: canMutateCurated,
      rename: false,
      publish: false,
      unpublish: false,
    },
  }));

  return withSession(
    request,
    NextResponse.json({
      account: {
        accountId,
      },
      widgetTypes: widgetCatalog.widgetTypes,
      instances: [...accountInstances, ...curatedInstances],
    }),
    session.setCookies,
  );
}

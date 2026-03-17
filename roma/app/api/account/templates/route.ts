import { NextRequest, NextResponse } from 'next/server';
import { loadTemplateCatalog } from '@roma/lib/michael';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const templateCatalog = await loadTemplateCatalog(current.value.accessToken);
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
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      account: {
        accountId: current.value.authzPayload.accountId,
      },
      widgetTypes: templateCatalog.widgetTypes,
      instances: templateCatalog.instances,
    }),
    current.value.setCookies,
  );
}

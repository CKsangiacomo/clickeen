import { NextRequest, NextResponse } from 'next/server';
import { loadAccountWidgetCatalog } from '@roma/lib/michael';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

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

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const widgetCatalog = await loadAccountWidgetCatalog({
    accountId,
    berlinAccessToken: current.value.accessToken,
    tokyoAccessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
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
      current.value.setCookies,
    );
  }

  const canMutate = current.value.authzPayload.role !== 'viewer';
  const canMutateCurated = canMutate && current.value.authzPayload.accountIsPlatform;

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
    current.value.setCookies,
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { loadTokyoAccountInstanceIndex } from '@roma/lib/account-instance-direct';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

type WidgetInstance = {
  instanceId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
  actions: {
    edit: boolean;
    duplicate: boolean;
    delete: boolean;
    rename: boolean;
    publish: boolean;
    unpublish: boolean;
  };
};

function routeKind(status: number): 'AUTH' | 'DENY' | 'VALIDATION' | 'UPSTREAM_UNAVAILABLE' {
  if (status === 401) return 'AUTH';
  if (status === 403) return 'DENY';
  if (status === 422) return 'VALIDATION';
  return 'UPSTREAM_UNAVAILABLE';
}

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const widgetIndex = await loadTokyoAccountInstanceIndex({
    accountId,
    accountCapsule: current.value.authzToken,
  });
  if (widgetIndex.ok === false) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: routeKind(widgetIndex.status),
            reasonKey: widgetIndex.error.reasonKey,
            detail: widgetIndex.error.detail,
          },
        },
        { status: widgetIndex.status },
      ),
      current.value.setCookies,
    );
  }
  const canMutate = current.value.authzPayload.role !== 'viewer';
  const accountInstances: WidgetInstance[] = widgetIndex.value.accountInstances.map((instance) => ({
    instanceId: instance.instanceId,
    widgetType: instance.widgetType,
    displayName: instance.displayName,
    status: instance.publishStatus,
    actions: {
      edit: canMutate,
      duplicate: canMutate,
      delete: canMutate,
      rename: canMutate,
      publish: canMutate,
      unpublish: canMutate && instance.publishStatus === 'published',
    },
  }));

  return withSession(
    request,
    NextResponse.json({
      account: {
        accountId,
      },
      instances: accountInstances,
    }),
    current.value.setCookies,
  );
}

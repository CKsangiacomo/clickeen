import { NextRequest, NextResponse } from 'next/server';
import { loadTokyoAccountInstanceIndex } from '@roma/lib/account-instance-direct';
import { loadAccountPublishContainment } from '@roma/lib/michael';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

type WidgetInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
  listed: boolean;
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
  const [widgetIndex, containment] = await Promise.all([
    loadTokyoAccountInstanceIndex({
      accountId,
      accountCapsule: current.value.authzToken,
    }),
    loadAccountPublishContainment(accountId, current.value.accessToken),
  ]);
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
  if (containment.ok === false) {
    const status = containment.status === 401 || containment.status === 403 ? containment.status : 502;
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: routeKind(status),
            reasonKey: containment.reasonKey,
            detail: containment.detail,
          },
        },
        { status },
      ),
      current.value.setCookies,
    );
  }

  const canMutate = current.value.authzPayload.role !== 'viewer';
  const accountInstances: WidgetInstance[] = widgetIndex.value.accountInstances.map((instance) => ({
    publicId: instance.publicId,
    widgetType: instance.widgetType,
    displayName: instance.displayName,
    status: instance.publishStatus,
    listed: false,
    actions: {
      edit: true,
      duplicate: canMutate,
      delete: canMutate,
      rename: true,
      publish: canMutate && !containment.containment.active,
      unpublish: canMutate && instance.publishStatus === 'published',
    },
  }));

  const listedInstances: WidgetInstance[] = widgetIndex.value.listedInstances.map((instance) => ({
    publicId: instance.publicId,
    widgetType: instance.widgetType,
    displayName: instance.displayName,
    status: instance.publishStatus,
    listed: true,
    actions: {
      edit: false,
      duplicate: canMutate && instance.duplicable,
      delete: false,
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
      widgetTypes: widgetIndex.value.widgetTypes,
      instances: [...accountInstances, ...listedInstances],
    }),
    current.value.setCookies,
  );
}

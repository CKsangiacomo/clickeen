import { NextRequest, NextResponse } from 'next/server';
import {
  loadAccountWidgetInstanceFacts,
  listTokyoWidgetDefinitions,
} from '@roma/lib/account-instance-direct';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';
type WidgetInstance = {
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  status: 'published' | 'unpublished';
  updatedAt: string;
  publishedAt: string | null;
};

type WidgetCatalogOption = {
  widgetType: string;
  displayName: string;
  description: string;
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

  const accountId = current.value.authzPayload.accountPublicId;
  const [widgetInstances, widgetDefinitions] = await Promise.all([
    loadAccountWidgetInstanceFacts({
      accountId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    }),
    listTokyoWidgetDefinitions({
      accountId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    }),
  ]);
  if (widgetInstances.ok === false) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: routeKind(widgetInstances.status),
            reasonKey: widgetInstances.error.reasonKey,
            detail: widgetInstances.error.detail,
          },
        },
        { status: widgetInstances.status },
      ),
      current.value.setCookies,
    );
  }
  if (widgetDefinitions.ok === false) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: routeKind(widgetDefinitions.status),
            reasonKey: widgetDefinitions.error.reasonKey,
            detail: widgetDefinitions.error.detail,
          },
        },
        { status: widgetDefinitions.status },
      ),
      current.value.setCookies,
    );
  }
  const catalog: WidgetCatalogOption[] = widgetDefinitions.value.widgetDefinitions
    .map((entry) => {
      return {
        widgetType: entry.widgetType,
        displayName: entry.displayName,
        description: entry.description,
      };
    });
  const accountInstances: WidgetInstance[] = widgetInstances.value.instances.map((instance) => {
    return {
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      displayName: instance.displayName,
      status: instance.publishStatus,
      publishedAt: instance.publishedAt,
      updatedAt: instance.updatedAt,
    };
  });

  return withSession(
    request,
    NextResponse.json({
      accountId,
      catalog,
      instances: accountInstances,
    }),
    current.value.setCookies,
  );
}

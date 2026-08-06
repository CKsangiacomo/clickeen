import { NextRequest, NextResponse } from 'next/server';
import {
  loadAccountWidgetInstanceFacts,
  listTokyoWidgetDefinitions,
  type AccountWidgetInstanceListFact,
} from '@roma/lib/account-instance-direct';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';
const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';

type WidgetInstance = {
  instanceId: string;
  widgetType: string;
  widget: string;
  displayName: string;
  status: 'published' | 'unpublished';
  updatedAt: string;
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
  const widgetInstances = await loadAccountWidgetInstanceFacts({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
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
  const widgetDefinitions = await listTokyoWidgetDefinitions({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
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
  const widgetNameByType = new Map(
    widgetDefinitions.value.widgetDefinitions.map((entry) => [entry.widgetType, entry.displayName]),
  );
  const missingDefinition = widgetInstances.value.instances.find(
    (instance) => !instance.isTemplate && !widgetNameByType.has(instance.widgetType),
  );
  if (missingDefinition) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: `widget_definition_missing:${missingDefinition.widgetType}`,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
  const accountInstances: WidgetInstance[] = widgetInstances.value.instances
    .filter((instance): instance is AccountWidgetInstanceListFact & { isTemplate: false; publishStatus: 'published' | 'unpublished' } => !instance.isTemplate && Boolean(instance.publishStatus))
    .map((instance) => {
    return {
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      widget: widgetNameByType.get(instance.widgetType)!,
      displayName: instance.displayName ?? DEFAULT_INSTANCE_DISPLAY_NAME,
      status: instance.publishStatus!,
      updatedAt: instance.updatedAt,
    };
    });

  return withSession(
    request,
    NextResponse.json({
      accountId,
      instances: accountInstances,
    }),
    current.value.setCookies,
  );
}

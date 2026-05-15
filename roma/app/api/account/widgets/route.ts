import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  loadTokyoAccountInstanceIndex,
  loadTokyoWidgetCatalog,
  type TokyoWidgetCatalogEntry,
} from '@roma/lib/account-instance-direct';
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

type WidgetCatalogOption = Omit<TokyoWidgetCatalogEntry, 'overlays'> & {
  canCreate: boolean;
  disabledReasonKey: string | null;
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
  const widgetIndex = await loadTokyoAccountInstanceIndex({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
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
  const widgetCatalog = await loadTokyoWidgetCatalog({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (widgetCatalog.ok === false) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: routeKind(widgetCatalog.status),
            reasonKey: widgetCatalog.error.reasonKey,
            detail: widgetCatalog.error.detail,
          },
        },
        { status: widgetCatalog.status },
      ),
      current.value.setCookies,
    );
  }
  const canMutate = current.value.authzPayload.role !== 'viewer';
  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
    entitlements: current.value.authzPayload.entitlements ?? null,
  });
  const widgetsTypesLimitRaw = policy.limits['widgets.types.max'];
  const widgetTypesLimit =
    typeof widgetsTypesLimitRaw === 'number' && Number.isFinite(widgetsTypesLimitRaw)
      ? Math.max(0, Math.floor(widgetsTypesLimitRaw))
      : null;
  const usedWidgetTypes = new Set(widgetIndex.value.accountInstances.map((instance) => instance.widgetType));
  const catalog: WidgetCatalogOption[] = widgetCatalog.value.widgets.map((entry) => {
    const existingType = usedWidgetTypes.has(entry.widgetType);
    const withinTypeLimit = widgetTypesLimit == null || existingType || usedWidgetTypes.size < widgetTypesLimit;
    return {
      widgetType: entry.widgetType,
      widgetCode: entry.widgetCode,
      label: entry.label,
      description: entry.description,
      category: entry.category,
      capabilities: entry.capabilities,
      canCreate: canMutate && withinTypeLimit,
      disabledReasonKey: canMutate
        ? withinTypeLimit
          ? null
          : 'coreui.upsell.reason.limitReached'
        : 'coreui.errors.auth.forbidden',
    };
  });
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
    catalog,
    instances: accountInstances,
  }),
    current.value.setCookies,
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  listAccountInstancesInTokyo,
  listTokyoWidgetDefinitions,
} from '@roma/lib/account-instance-direct';
import { isLegacyWidgetType } from '@roma/lib/legacy-widget-types';
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

type SystemWidgetOption = {
  widgetType: string;
  widgetCode: string;
  label: string;
  description: string;
  canCreate: boolean;
  disabledReasonKey: string | null;
};

function routeKind(status: number): 'AUTH' | 'DENY' | 'VALIDATION' | 'UPSTREAM_UNAVAILABLE' {
  if (status === 401) return 'AUTH';
  if (status === 403) return 'DENY';
  if (status === 422) return 'VALIDATION';
  return 'UPSTREAM_UNAVAILABLE';
}

function widgetProductLabel(widgetType: string): string {
  const labels: Record<string, string> = {
    'big-bang': 'Big Bang',
    calltoaction: 'Call to Action',
    cards: 'Cards',
    countdown: 'Countdown',
    faq: 'FAQ',
    logoshowcase: 'Logo Showcase',
    'split-carousel-media': 'Split Carousel Media',
    'split-media': 'Split Media',
    split: 'Split',
  };
  const normalized = String(widgetType || '').trim().toLowerCase();
  return labels[normalized] ?? normalized.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const widgetInstances = await listAccountInstancesInTokyo({
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
  const usedWidgetTypes = new Set(widgetInstances.value.accountInstances.map((instance) => instance.widgetType));
  const systemWidgets: SystemWidgetOption[] = widgetDefinitions.value.widgetDefinitions
    .filter((entry) => !isLegacyWidgetType(entry.widgetType) || usedWidgetTypes.has(entry.widgetType))
    .map((entry) => {
      const existingType = usedWidgetTypes.has(entry.widgetType);
      const legacyType = isLegacyWidgetType(entry.widgetType);
      const withinTypeLimit = widgetTypesLimit == null || existingType || usedWidgetTypes.size < widgetTypesLimit;
      return {
        widgetType: entry.widgetType,
        widgetCode: entry.widgetCode,
        label: widgetProductLabel(entry.widgetType),
        description: '',
        canCreate: canMutate && withinTypeLimit && !legacyType,
        disabledReasonKey: legacyType
          ? null
          : canMutate
            ? withinTypeLimit
              ? null
              : 'coreui.upsell.reason.limitReached'
            : 'coreui.errors.auth.forbidden',
      };
    });
  const accountInstances: WidgetInstance[] = widgetInstances.value.accountInstances.map((instance) => {
    const legacyType = isLegacyWidgetType(instance.widgetType);
    return {
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      displayName: instance.displayName,
      status: instance.publishStatus,
      actions: {
        edit: canMutate,
        duplicate: canMutate && !legacyType,
        delete: canMutate,
        rename: canMutate,
        publish: canMutate && !legacyType,
        unpublish: canMutate && instance.publishStatus === 'published',
      },
    };
  });

  return withSession(
    request,
    NextResponse.json({
      account: {
        accountId,
      },
      systemWidgets,
      instances: accountInstances,
    }),
    current.value.setCookies,
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  createAccountInstanceInTokyo,
  listAccountInstancesInTokyo,
  listTokyoWidgetDefinitions,
} from '@roma/lib/account-instance-direct';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../_lib/current-account-route';

export const runtime = 'edge';

function normalizeDisplayName(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= 120 ? trimmed : undefined;
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const bodyResult = await readJsonPayloadOrValidation<{ widgetType?: unknown; displayName?: unknown } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }
  const body = bodyResult.payload;

  const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
  const hasDisplayName = Boolean(body && Object.prototype.hasOwnProperty.call(body, 'displayName'));
  const displayName = hasDisplayName ? normalizeDisplayName(body?.displayName) : undefined;
  if (!widgetType || (hasDisplayName && displayName === undefined)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountPublicId;
  const widgetDefinitions = await listTokyoWidgetDefinitions({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!widgetDefinitions.ok) {
    return withSession(
      request,
      NextResponse.json({ error: widgetDefinitions.error }, { status: widgetDefinitions.status }),
      current.value.setCookies,
    );
  }
  if (!widgetDefinitions.value.widgetDefinitions.some((entry) => entry.widgetType === widgetType)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.widgetMissing' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const widgetInstances = await listAccountInstancesInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!widgetInstances.ok) {
    return withSession(
      request,
      NextResponse.json({ error: widgetInstances.error }, { status: widgetInstances.status }),
      current.value.setCookies,
    );
  }
  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
    entitlements: current.value.authzPayload.entitlements ?? null,
  });
  const widgetTypesLimitRaw = policy.limits['widgets.types.max'];
  const widgetTypesLimit =
    typeof widgetTypesLimitRaw === 'number' && Number.isFinite(widgetTypesLimitRaw)
      ? Math.max(0, Math.floor(widgetTypesLimitRaw))
      : null;
  const usedWidgetTypes = new Set(widgetInstances.value.accountInstances.map((instance) => instance.widgetType));
  if (widgetTypesLimit != null && !usedWidgetTypes.has(widgetType) && usedWidgetTypes.size >= widgetTypesLimit) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'DENY',
            reasonKey: 'coreui.upsell.reason.limitReached',
            detail: `widgets.types.max=${widgetTypesLimit}`,
          },
        },
        { status: 403 },
      ),
      current.value.setCookies,
    );
  }
  const created = await createAccountInstanceInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    widgetType,
    displayName,
    requestId: current.value.requestId,
  });
  if (!created.ok) {
    return withSession(
      request,
      NextResponse.json({ error: created.error }, { status: created.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json(
      {
        accountId,
        instanceId: created.value.row.instanceId,
        widgetType: created.value.row.widgetType,
        displayName: created.value.row.displayName,
        status: 'unpublished',
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}

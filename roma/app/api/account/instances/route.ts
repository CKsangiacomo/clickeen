import { NextRequest, NextResponse } from 'next/server';
import { createCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  createAccountInstanceInTokyo,
  listAccountWidgetInstanceIds,
  listTokyoWidgetDefinitions,
} from '@roma/lib/account-instance-direct';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { materializeAccountInstanceSourceArtifacts } from '@roma/lib/account-instance-source-artifacts';
import { validateAccountInstanceSavePolicy } from '@roma/lib/account-instance-save-policy';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

function normalizeDisplayName(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= 120 ? trimmed : undefined;
}

function readFinitePolicyLimit(limits: Record<string, unknown>, key: string): number | null {
  const value = limits[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function policyContractFailure(key: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'roma.errors.policy.invalidEntitlement',
        detail: key,
      },
    },
    { status: 500 },
  );
}

function upgradeRequired(args: {
  gate: 'widgets.instances.max';
  action: 'create_instance';
  current: number;
  limit: number;
}): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      kind: 'UPGRADE_REQUIRED',
      upgrade: args,
    },
    { status: 402 },
  );
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const bodyResult = await readJsonPayloadOrValidation<{
    widgetType?: unknown;
    displayName?: unknown;
    config?: unknown;
    publicPackage?: {
      indexHtml?: unknown;
      stylesCss?: unknown;
      runtimeJs?: unknown;
    };
  } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }
  const body = bodyResult.payload;

  const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
  const config = body?.config;
  const publicPackage = body?.publicPackage;
  const hasDisplayName = Boolean(body && Object.prototype.hasOwnProperty.call(body, 'displayName'));
  const displayName = hasDisplayName ? normalizeDisplayName(body?.displayName) : undefined;
  if (
    !widgetType ||
    (hasDisplayName && displayName === undefined) ||
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    !publicPackage ||
    typeof publicPackage.indexHtml !== 'string' ||
    typeof publicPackage.stylesCss !== 'string' ||
    typeof publicPackage.runtimeJs !== 'string'
  ) {
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
  const widgetInstanceIds = await listAccountWidgetInstanceIds({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!widgetInstanceIds.ok) {
    return withSession(
      request,
      NextResponse.json({ error: widgetInstanceIds.error }, { status: widgetInstanceIds.status }),
      current.value.setCookies,
    );
  }
  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
    entitlements: current.value.authzPayload.entitlements ?? null,
  });
  const widgetInstancesLimit = readFinitePolicyLimit(policy.limits, 'widgets.instances.max');
  if (widgetInstancesLimit == null) {
    return withSession(
      request,
      policyContractFailure('widgets.instances.max'),
      current.value.setCookies,
    );
  }
  if (widgetInstanceIds.value.instanceIds.length >= widgetInstancesLimit) {
    return withSession(
      request,
      upgradeRequired({
        gate: 'widgets.instances.max',
        action: 'create_instance',
        current: widgetInstanceIds.value.instanceIds.length,
        limit: widgetInstancesLimit,
      }),
      current.value.setCookies,
    );
  }
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
  const widgetDefinition = widgetDefinitions.value.widgetDefinitions.find((entry) => entry.widgetType === widgetType);
  if (!widgetDefinition) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.widgetMissing' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const accountLocales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!accountLocales.ok) {
    return withSession(
      request,
      NextResponse.json(
        accountLocales.payload ?? {
          error: {
            kind: accountLocales.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
            reasonKey:
              accountLocales.status === 401
                ? 'coreui.errors.auth.required'
                : 'coreui.errors.auth.contextUnavailable',
            detail: accountLocales.detail,
          },
        },
        { status: accountLocales.status },
      ),
      current.value.setCookies,
    );
  }
  const baseLocale = accountLocales.localePolicy.baseLocale;
  const instanceId = createCompactInstanceId();
  const savePolicy = validateAccountInstanceSavePolicy({
    config: config as Record<string, unknown>,
    authz: current.value.authzPayload,
    limits: widgetDefinition.limits,
    context: 'publish',
  });
  if (!savePolicy.ok) {
    return withSession(
      request,
      NextResponse.json({ error: savePolicy.error }, { status: savePolicy.status }),
      current.value.setCookies,
    );
  }
  const sourceArtifacts = materializeAccountInstanceSourceArtifacts({
    accountId,
    instanceId,
    widgetType,
    config: config as Record<string, unknown>,
    editableFields: widgetDefinition.editableFields,
    initialStatus: 'ok',
  });
  if (!sourceArtifacts.ok) {
    return withSession(
      request,
      NextResponse.json({ error: sourceArtifacts.error }, { status: sourceArtifacts.status }),
      current.value.setCookies,
    );
  }
  const created = await createAccountInstanceInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    instanceId,
    widgetType,
    displayName,
    config: sourceArtifacts.value.config,
    content: sourceArtifacts.value.content,
    publicPackage: {
      indexHtml: publicPackage.indexHtml,
      stylesCss: publicPackage.stylesCss,
      runtimeJs: publicPackage.runtimeJs,
    },
    baseLocale,
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

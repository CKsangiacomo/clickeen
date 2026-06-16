import { NextRequest, NextResponse } from 'next/server';
import { isRecord } from '@clickeen/ck-contracts';
import { createCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  createAccountInstanceInTokyo,
  listAccountInstancesInTokyo,
  listTokyoWidgetDefinitions,
} from '@roma/lib/account-instance-direct';
import { validateAccountInstanceConfigStructure } from '@roma/lib/account-instance-save-policy';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { loadAccountWidgetDefaultsInTokyo } from '@roma/lib/account-widget-defaults-direct';
import {
  compileWidgetForInstancePackage,
  materializeAccountInstancePublicPackage,
} from '@roma/lib/account-instance-public-package';
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

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeDefaultsInto(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  path: string,
  conflicts: string[],
): void {
  for (const [key, value] of Object.entries(source)) {
    const nextPath = path ? `${path}.${key}` : key;
    const existing = target[key];
    if (typeof existing === 'undefined') {
      target[key] = cloneValue(value);
      continue;
    }
    if (isRecord(existing) && isRecord(value)) {
      mergeDefaultsInto(existing, value, nextPath, conflicts);
      continue;
    }
    conflicts.push(nextPath);
  }
}

function materializeInstanceConfigFromAccountDefaults(args: {
  shell: Record<string, unknown>;
  core: Record<string, unknown>;
}): { ok: true; config: Record<string, unknown> } | { ok: false; conflicts: string[] } {
  const config = cloneValue(args.shell);
  const conflicts: string[] = [];
  mergeDefaultsInto(config, args.core, '', conflicts);
  return conflicts.length > 0 ? { ok: false, conflicts } : { ok: true, config };
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
  const accountWidgetDefaults = await loadAccountWidgetDefaultsInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!accountWidgetDefaults.ok) {
    return withSession(
      request,
      NextResponse.json({ error: accountWidgetDefaults.error }, { status: accountWidgetDefaults.status }),
      current.value.setCookies,
    );
  }
  const widgetDefaults = accountWidgetDefaults.value.widgetDefaults.widgets[widgetType];
  if (!widgetDefaults) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.widgetDefaults.widgetMissing',
            detail: `missing account defaults for widgetType "${widgetType}"`,
          },
        },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const materialized = materializeInstanceConfigFromAccountDefaults({
    shell: accountWidgetDefaults.value.widgetDefaults.shell,
    core: widgetDefaults.core,
  });
  if (!materialized.ok) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.widgetDefaults.shellCoreConflict',
            paths: materialized.conflicts,
          },
        },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const structureGate = validateAccountInstanceConfigStructure({
    widgetType,
    config: materialized.config,
  });
  if (!structureGate.ok) {
    return withSession(
      request,
      NextResponse.json({ error: structureGate.error }, { status: structureGate.status }),
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
  const targetLocales = accountLocales.selectedTargetLocales;
  const instanceId = createCompactInstanceId();
  const compiled = await compileWidgetForInstancePackage(request, widgetType);
  if (!compiled.ok) {
    return withSession(
      request,
      NextResponse.json({ error: compiled.error }, { status: compiled.status }),
      current.value.setCookies,
    );
  }
  const publicPackage = await materializeAccountInstancePublicPackage({
    compiled: compiled.value,
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
    instanceId,
    baseLocale,
    displayName: displayName ?? null,
    config: materialized.config,
  });
  if (!publicPackage.ok) {
    return withSession(
      request,
      NextResponse.json({ error: publicPackage.error }, { status: publicPackage.status }),
      current.value.setCookies,
    );
  }
  const created = await createAccountInstanceInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    instanceId,
    widgetType,
    displayName,
    config: materialized.config,
    publicPackage: publicPackage.value,
    baseLocale,
    targetLocales,
    meta: {
      baseLocale,
      targetLocales,
    },
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

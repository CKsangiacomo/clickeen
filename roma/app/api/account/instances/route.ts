import { NextRequest, NextResponse } from 'next/server';
import { createCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import {
  createAccountInstanceInTokyo,
  listTokyoWidgetDefinitions,
} from '@roma/lib/account-instance-direct';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { loadAccountWidgetDefaultsInTokyo } from '@roma/lib/account-widget-defaults-direct';
import { prepareAccountInstanceSourceArtifacts } from '@roma/lib/account-instance-source-artifacts';
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

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function mergeDefaultsInto(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      mergeDefaultsInto(existing as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }
    target[key] = cloneValue(value);
  }
}

function composeInstanceConfigFromAccountDefaults(args: {
  common: Record<string, unknown>;
  core: Record<string, unknown>;
}): Record<string, unknown> {
  const config = cloneValue(args.common);
  mergeDefaultsInto(config, args.core);
  return config;
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const bodyResult = await readJsonPayloadOrValidation<{
    widgetType?: unknown;
    displayName?: unknown;
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
  const widgetDefinition = widgetDefinitions.value.widgetDefinitions.find(
    (entry) => entry.widgetType === widgetType,
  );
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
  const accountWidgetDefaults = await loadAccountWidgetDefaultsInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!accountWidgetDefaults.ok) {
    return withSession(
      request,
      NextResponse.json(
        { error: accountWidgetDefaults.error },
        { status: accountWidgetDefaults.status },
      ),
      current.value.setCookies,
    );
  }
  const widgetDefaults = accountWidgetDefaults.value.widgetDefaults.widgets[widgetType]!;
  const config = composeInstanceConfigFromAccountDefaults({
    common: accountWidgetDefaults.value.widgetDefaults.common,
    core: widgetDefaults.core,
  });
  const accountLocales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!accountLocales.ok) {
    return withSession(
      request,
      NextResponse.json(accountLocales.payload, { status: accountLocales.status }),
      current.value.setCookies,
    );
  }
  const baseLocale = accountLocales.localePolicy.baseLocale;
  const instanceId = createCompactInstanceId();
  const sourceArtifacts = prepareAccountInstanceSourceArtifacts({
    accountId,
    instanceId,
    widgetType,
    config,
    editableFields: widgetDefinition.editableFields,
    initialStatus: 'ok',
  });
  const created = await createAccountInstanceInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    instanceId,
    widgetType,
    displayName,
    config: sourceArtifacts.config,
    content: sourceArtifacts.content,
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
        status: created.value.row.publishStatus,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}

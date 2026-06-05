import { getCompiledWidgetRouteResponse } from '@clickeen/bob/compiled-widget-route';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountInstanceFromTokyo,
  listPageIdsPlacingInstanceInTokyo,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { validateAccountInstanceSavePolicy } from '@roma/lib/account-instance-save-policy';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import { buildSavedWidgetPublicPackage, type CompiledWidgetForPublicPackage } from '@roma/lib/widget-public-package';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

function isCompiledWidgetForPublicPackage(value: unknown): value is CompiledWidgetForPublicPackage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const widgetPackage = record.widgetPackage;
  return (
    typeof record.widgetname === 'string' &&
    (typeof record.displayName === 'undefined' || typeof record.displayName === 'string') &&
    Boolean(widgetPackage && typeof widgetPackage === 'object' && !Array.isArray(widgetPackage))
  );
}

async function compileWidgetForSave(request: NextRequest, widgetType: string): Promise<CompiledWidgetForPublicPackage> {
  const response = await getCompiledWidgetRouteResponse(
    new NextRequest(new URL(`/api/widgets/${encodeURIComponent(widgetType)}/compiled`, request.url)),
    { params: Promise.resolve({ widgetname: widgetType }) },
  );
  const payload = await response.json().catch(() => null);
  if (response.ok && isCompiledWidgetForPublicPackage(payload)) return payload;
  throw new Error(
    payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
      ? String((payload as { error?: unknown }).error)
      : 'coreui.errors.widget.compiled.invalid',
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }
  const bodyResult = await readJsonPayloadOrValidation<
    | {
        widgetType?: string;
        config?: Record<string, unknown>;
        baseLocale?: string | null;
        displayName?: string | null;
        meta?: Record<string, unknown> | null;
      }
    | null
  >(request);
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
  const baseLocale = normalizeLocaleToken(body?.baseLocale) ?? '';
  const displayName =
    body && Object.prototype.hasOwnProperty.call(body, 'displayName')
      ? typeof body.displayName === 'string'
        ? body.displayName
        : body.displayName === null
          ? null
          : undefined
      : undefined;
  const meta =
    body && Object.prototype.hasOwnProperty.call(body, 'meta')
      ? body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
        ? (body.meta as Record<string, unknown>)
        : body.meta === null
          ? null
          : undefined
      : undefined;
  if (!widgetType || !config || typeof config !== 'object' || Array.isArray(config) || !baseLocale) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  if (
    body &&
    Object.prototype.hasOwnProperty.call(body, 'meta') &&
    meta === undefined
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
  if (
    body &&
    Object.prototype.hasOwnProperty.call(body, 'displayName') &&
    displayName === undefined
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

  const policyGate = validateAccountInstanceSavePolicy({
    config,
    authz: current.value.authzPayload,
  });
  if (!policyGate.ok) {
    return withSession(
      request,
      NextResponse.json({ error: policyGate.error }, { status: policyGate.status }),
      current.value.setCookies,
    );
  }

  let publicPackage;
  try {
    const compiled = await compileWidgetForSave(request, widgetType);
    publicPackage = buildSavedWidgetPublicPackage({
      compiled,
      instanceId,
      baseLocale,
      displayName: displayName ?? null,
      state: config,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widget.compiled.invalid', detail } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const result = await saveAccountInstanceInTokyo({
    accountId,
    instanceId,
    widgetType,
    config,
    publicPackage,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(meta !== undefined ? { meta } : {}),
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }
  return withSession(
    request,
    NextResponse.json({
      ok: true,
    }),
    current.value.setCookies,
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }

  const placedPages = await listPageIdsPlacingInstanceInTokyo({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!placedPages.ok) {
    return withSession(
      request,
      NextResponse.json({ error: placedPages.error }, { status: placedPages.status }),
      current.value.setCookies,
    );
  }
  if (placedPages.value.length) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.instance.placedOnPage',
            detail: 'Remove this widget from every page before deleting it.',
            pageIds: placedPages.value,
          },
        },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  let deleted: { existed: boolean };
  try {
    deleted = await deleteAccountInstanceFromTokyo({
      accountId,
      instanceId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[roma account instance current route] tokyo cleanup failed', {
      accountId,
      instanceId,
      detail,
    });
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      accountId,
      instanceId,
      deleted: deleted.existed,
      existed: deleted.existed,
    }),
    current.value.setCookies,
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { normalizeInstanceId } from '@clickeen/ck-contracts';
import {
  deleteAccountInstanceFromTokyo,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { loadAccountL10nIntent } from '@roma/lib/account-l10n-intent';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const { instanceId: instanceIdRaw } = await context.params;
  const instanceId = normalizeInstanceId(instanceIdRaw);
  if (!instanceId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instanceId.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  let body:
    | {
        widgetType?: string;
        config?: Record<string, unknown>;
        displayName?: string | null;
        meta?: Record<string, unknown> | null;
      }
    | null = null;
  try {
    body = (await request.json()) as
      | {
          widgetType?: string;
          config?: Record<string, unknown>;
          displayName?: string | null;
          meta?: Record<string, unknown> | null;
        }
      | null;
  } catch {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
  const config = body?.config;
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
  if (!widgetType || !config || typeof config !== 'object' || Array.isArray(config)) {
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

  const l10nIntent = await loadAccountL10nIntent({
    accessToken: current.value.accessToken,
    accountId,
  });
  if (!l10nIntent.ok) {
    return withSession(
      request,
      NextResponse.json({ error: l10nIntent.error }, { status: l10nIntent.status }),
      current.value.setCookies,
    );
  }

  const result = await saveAccountInstanceInTokyo({
    accountId,
    instanceId,
    widgetType,
    config,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(meta !== undefined ? { meta } : {}),
    l10nIntent: l10nIntent.value,
    accountCapsule: current.value.authzToken,
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
      translationFollowup: result.value.translationFollowup,
    }),
    current.value.setCookies,
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const { instanceId: instanceIdRaw } = await context.params;
  const instanceId = normalizeInstanceId(instanceIdRaw);
  if (!instanceId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instanceId.invalid' } },
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

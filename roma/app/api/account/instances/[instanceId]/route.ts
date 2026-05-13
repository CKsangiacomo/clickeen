import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountInstanceFromTokyo,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import {
  enqueueAccountInstanceSync,
  TokyoAccountInstanceSyncError,
} from '@roma/lib/account-instance-sync';
import { loadAccountL10nIntent } from '@roma/lib/account-l10n-intent';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

async function enqueueTranslationAfterSave(args: {
  accessToken: string;
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
  live: boolean;
}): Promise<
  | { ok: true }
  | { ok: false; reasonKey: string; detail: string; status: number }
> {
  const l10nIntent = await loadAccountL10nIntent({
    accessToken: args.accessToken,
    accountId: args.accountId,
    requestId: args.requestId,
  });
  if (!l10nIntent.ok) {
    return {
      ok: false,
      reasonKey: l10nIntent.error.reasonKey,
      detail: l10nIntent.error.detail ?? l10nIntent.error.reasonKey,
      status: l10nIntent.status,
    };
  }

  try {
    await enqueueAccountInstanceSync({
      accountId: args.accountId,
      instanceId: args.instanceId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
      live: args.live,
      l10nIntent: l10nIntent.value,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reasonKey: 'coreui.errors.translations.acceptanceFailed',
      detail:
        error instanceof TokyoAccountInstanceSyncError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error),
      status: error instanceof TokyoAccountInstanceSyncError ? error.status : 502,
    };
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
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

  const result = await saveAccountInstanceInTokyo({
    accountId,
    instanceId,
    widgetType,
    config,
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
  const translationFollowup = await enqueueTranslationAfterSave({
    accessToken: current.value.accessToken,
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
    live: result.value.live,
  });

  return withSession(
    request,
    NextResponse.json({
      ok: true,
      translationFollowup,
    }),
    current.value.setCookies,
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
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

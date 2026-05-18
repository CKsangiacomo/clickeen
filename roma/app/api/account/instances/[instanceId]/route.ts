import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountInstanceFromTokyo,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { runInstanceTranslationFollowupAfterSave } from '@roma/lib/account-instance-translation-followup';
import { getOptionalCloudflareRequestContext } from '@roma/lib/cloudflare-request-context';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };
type CloudflareContextWithWaitUntil = {
  env?: unknown;
  ctx?: {
    waitUntil?: (promise: Promise<unknown>) => void;
  };
  waitUntil?: (promise: Promise<unknown>) => void;
};
type TranslationFollowupResult = Awaited<
  ReturnType<typeof runInstanceTranslationFollowupAfterSave>
>;
type TranslationFollowupResults = TranslationFollowupResult['results'];

function attachTranslationFollowupToRequestLifetime(promise: Promise<unknown>): void {
  const context = getOptionalCloudflareRequestContext<CloudflareContextWithWaitUntil>();
  const waitUntil = context?.ctx?.waitUntil ?? context?.waitUntil;
  if (typeof waitUntil === 'function') {
    waitUntil.call(context?.ctx ?? context, promise);
    return;
  }
  void promise;
}

function logTranslationFollowupFailure(args: {
  accountId: string;
  instanceId: string;
  requestId?: string | null;
  results?: TranslationFollowupResults;
  detail?: string;
}): void {
  console.warn('[roma account instance save] translation follow-up failed', {
    accountId: args.accountId,
    instanceId: args.instanceId,
    requestId: args.requestId,
    ...(args.results ? { results: args.results } : {}),
    ...(args.detail ? { detail: args.detail } : {}),
  });
}

function startTranslationFollowupAfterSave(args: {
  authz: Parameters<typeof runInstanceTranslationFollowupAfterSave>[0]['authz'];
  accessToken: string;
  accountCapsule: string;
  accountPublicId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  previousConfig: Record<string, unknown> | null;
  requestId?: string | null;
}): void {
  const promise = runInstanceTranslationFollowupAfterSave(args)
    .then((translation) => {
      if (!translation.ok) {
        logTranslationFollowupFailure({
          accountId: args.accountPublicId,
          instanceId: args.instanceId,
          requestId: args.requestId,
          results: translation.results,
        });
      }
    })
    .catch((error) => {
      logTranslationFollowupFailure({
        accountId: args.accountPublicId,
        instanceId: args.instanceId,
        requestId: args.requestId,
        detail: error instanceof Error ? error.message : String(error),
      });
    });

  attachTranslationFollowupToRequestLifetime(promise);
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
  startTranslationFollowupAfterSave({
    authz: current.value.authzPayload,
    accessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
    accountPublicId: accountId,
    instanceId,
    widgetType,
    config,
    previousConfig: result.value.previousConfig,
    requestId: current.value.requestId,
  });

  return withSession(
    request,
    NextResponse.json({
      ok: true,
      sourceVersion: result.value.sourceVersion,
      generation: result.value.generation,
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

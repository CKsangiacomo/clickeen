import { NextRequest, NextResponse } from 'next/server';
import { classifyWidgetPublicId, isUuid } from '@clickeen/ck-contracts';
import {
  deleteLiveSurfaceFromTokyo,
  deleteSavedConfigFromTokyo,
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceLiveStatus,
  recordTokyoAccountInstanceProjectionGap,
  saveAccountInstanceDirect,
} from '@roma/lib/account-instance-direct';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { normalizeDesiredAccountLocales } from '@roma/lib/account-locales';
import {
  enqueueAccountInstanceSync,
  TokyoAccountInstanceSyncError,
} from '@roma/lib/account-instance-sync';
import { deleteAccountInstanceProjectionRow } from '@roma/lib/michael';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

async function deleteTokyoMirrors(args: {
  accountId: string;
  publicId: string;
  accountCapsule?: string;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    await Promise.all([
      deleteSavedConfigFromTokyo({
        accountId: args.accountId,
        publicId: args.publicId,
        accountCapsule: args.accountCapsule,
      }),
      deleteLiveSurfaceFromTokyo({
        accountId: args.accountId,
        publicId: args.publicId,
        accountCapsule: args.accountCapsule,
      }),
    ]);
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const { publicId: publicIdRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const publicIdKind = classifyWidgetPublicId(publicId);
  if (!publicIdKind) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
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

  const accountLocalesState = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId,
  });
  if (!accountLocalesState.ok) {
    const status =
      accountLocalesState.status === 401
        ? 401
        : accountLocalesState.status === 403
          ? 403
          : 502;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey:
              status === 401
                ? 'coreui.errors.auth.required'
                : status === 403
                  ? 'coreui.errors.auth.forbidden'
                  : 'coreui.errors.auth.contextUnavailable',
            detail:
              accountLocalesState.detail ||
              `berlin_account_http_${accountLocalesState.status}`,
          },
        },
        { status },
      ),
      current.value.setCookies,
    );
  }

  const result = await saveAccountInstanceDirect({
    accountId,
    publicId,
    widgetType,
    config,
    displayName,
    meta,
    l10n: {
      summary: {
        baseLocale: accountLocalesState.policy.baseLocale,
        desiredLocales: normalizeDesiredAccountLocales({
          baseLocale: accountLocalesState.policy.baseLocale,
          locales: accountLocalesState.locales,
        }),
      },
    },
    accountCapsule: current.value.authzToken,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }

  let live = false;
  const liveStatus = await loadTokyoAccountInstanceLiveStatus({
    accountId,
    publicId,
    accountCapsule: current.value.authzToken,
  });
  if (liveStatus.ok) {
    live = liveStatus.value === 'published';
  } else {
    console.error('[roma account instance current route] serve-state lookup failed after save', {
      accountId,
      publicId,
      detail: liveStatus.error.detail ?? liveStatus.error.reasonKey,
    });
  }

  let translationFollowup:
    | { ok: true }
    | { ok: false; reasonKey: string; detail: string; status: number } = { ok: true };

  try {
    await enqueueAccountInstanceSync({
      accountId,
      publicId,
      accountCapsule: current.value.authzToken,
      live,
      baseFingerprint: result.baseFingerprint,
      previousBaseFingerprint: result.previousBaseFingerprint,
      l10nIntent: {
        baseLocale: accountLocalesState.policy.baseLocale,
        desiredLocales: normalizeDesiredAccountLocales({
          baseLocale: accountLocalesState.policy.baseLocale,
          locales: accountLocalesState.locales,
        }),
        countryToLocale: accountLocalesState.policy.ip.countryToLocale,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    translationFollowup = {
      ok: false,
      reasonKey: 'coreui.errors.translations.acceptanceFailed',
      detail,
      status: error instanceof TokyoAccountInstanceSyncError ? error.status : 502,
    };
    console.error('[roma account instance current route] translation acceptance failed after save', {
      accountId,
      publicId,
      detail,
    });
  }

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
  if (!isUuid(accountId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const { publicId: publicIdRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  const publicIdKind = classifyWidgetPublicId(publicId);
  if (!publicIdKind) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const existing = await loadTokyoAccountInstanceDocument({
    accountId,
    publicId,
    accountCapsule: current.value.authzToken,
  });
  if (!existing.ok && existing.status === 404) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } },
        { status: 404 },
      ),
      current.value.setCookies,
    );
  }
  if (!existing.ok) {
    return withSession(
      request,
      NextResponse.json({ error: existing.error }, { status: existing.status }),
      current.value.setCookies,
    );
  }

  const tokyoCleanup = await deleteTokyoMirrors({
    accountId,
    publicId,
    accountCapsule: current.value.authzToken,
  });
  if (!tokyoCleanup.ok) {
    console.error('[roma account instance current route] tokyo cleanup failed', {
      accountId,
      publicId,
      detail: tokyoCleanup.detail,
    });
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: tokyoCleanup.detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }

  const deleteResult = await deleteAccountInstanceProjectionRow({
    accountId,
    publicId,
    berlinAccessToken: current.value.accessToken,
  });
  const projectionFollowup = deleteResult.ok
    ? { ok: true as const }
    : {
        ok: false as const,
        reasonKey: deleteResult.reasonKey,
        detail: deleteResult.detail,
        status: deleteResult.status,
      };
  let projectionGapFollowup:
    | { ok: true; gapId: string | null }
    | { ok: false; reasonKey: string; detail?: string; status: number } = { ok: true, gapId: null };
  if (!projectionFollowup.ok) {
    console.error('[roma account instance current route] projection delete failed after Tokyo delete', {
      accountId,
      publicId,
      reasonKey: projectionFollowup.reasonKey,
      detail: projectionFollowup.detail,
    });
    const projectionGap = await recordTokyoAccountInstanceProjectionGap({
      accountId,
      publicId,
      action: 'delete',
      reasonKey: projectionFollowup.reasonKey,
      detail: projectionFollowup.detail,
      status: projectionFollowup.status,
      accountCapsule: current.value.authzToken,
    });
    if (!projectionGap.ok) {
      projectionGapFollowup = {
        ok: false,
        reasonKey: projectionGap.error.reasonKey,
        detail: projectionGap.error.detail,
        status: projectionGap.status,
      };
      console.error('[roma account instance current route] projection gap recording failed', {
        accountId,
        publicId,
        detail: projectionGap.error.detail ?? projectionGap.error.reasonKey,
      });
    } else {
      projectionGapFollowup = { ok: true, gapId: projectionGap.gapId };
    }
  }

  return withSession(
    request,
    NextResponse.json({
      accountId,
      publicId,
      deleted: true,
      tokyoCleanupApplied: true,
      projectionFollowup,
      projectionGapFollowup,
    }),
    current.value.setCookies,
  );
}

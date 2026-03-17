import { NextRequest, NextResponse } from 'next/server';
import { classifyWidgetPublicId, isUuid } from '@clickeen/ck-contracts';
import {
  deleteLiveSurfaceFromTokyo,
  deleteSavedConfigFromTokyo,
  loadTokyoPreferredAccountInstance,
  saveAccountInstanceDirect,
  validatePersistableConfig,
} from '@roma/lib/account-instance-direct';
import { runAccountSaveAftermath } from '@roma/lib/account-save-aftermath';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';
import { deleteAccountInstanceRow, getAccountInstanceCoreRow } from '@roma/lib/michael';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

async function deleteTokyoMirrors(args: {
  tokyoAccessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    await Promise.all([
      deleteSavedConfigFromTokyo({
        tokyoBaseUrl: resolveTokyoBaseUrl(),
        tokyoAccessToken: args.tokyoAccessToken,
        accountId: args.accountId,
        publicId: args.publicId,
        accountCapsule: args.accountCapsule,
      }),
      deleteLiveSurfaceFromTokyo({
        tokyoBaseUrl: resolveTokyoBaseUrl(),
        tokyoAccessToken: args.tokyoAccessToken,
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

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

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

  const result = await loadTokyoPreferredAccountInstance({
    accountId: current.value.authzPayload.accountId,
    publicId,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken: current.value.accessToken,
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
      publicId: result.value.row.publicId,
      displayName: result.value.row.displayName || 'Untitled widget',
      ownerAccountId: result.value.row.accountId,
      widgetType: result.value.row.widgetType,
      status: result.value.row.status,
      config: result.value.config,
    }),
    current.value.setCookies,
  );
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

  let body: { config?: unknown } | null = null;
  try {
    body = (await request.json()) as { config?: unknown } | null;
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

  const validatedConfig = validatePersistableConfig(body?.config, accountId);
  if (!validatedConfig.ok) {
    return withSession(
      request,
      NextResponse.json({ error: validatedConfig.error }, { status: validatedConfig.status }),
      current.value.setCookies,
    );
  }

  const result = await saveAccountInstanceDirect({
    accountId,
    publicId,
    config: validatedConfig.value.config,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }

  if (result.value.changed) {
    try {
      await runAccountSaveAftermath({
        accessToken: current.value.accessToken,
        accountId,
        publicId,
        policyProfile: current.value.authzPayload.profile,
        accountCapsule: current.value.authzToken,
        previousConfig: result.value.previousConfig,
      });
    } catch (error) {
      console.error('[roma account instance current route] save aftermath failed', {
        publicId,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return withSession(
    request,
    NextResponse.json({ config: result.value.config, aftermath: null }),
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

  const sourceIsCurated = publicIdKind === 'main' || publicIdKind === 'curated';
  if (sourceIsCurated && current.value.authzPayload.accountIsPlatform !== true) {
    return withSession(
      request,
      NextResponse.json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 }),
      current.value.setCookies,
    );
  }

  const existing = await getAccountInstanceCoreRow(accountId, publicId, current.value.accessToken);
  if (!existing.ok) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: existing.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
            reasonKey: existing.reasonKey,
            detail: existing.detail,
          },
        },
        { status: existing.status === 401 ? 401 : 502 },
      ),
      current.value.setCookies,
    );
  }
  if (!existing.row) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } },
        { status: 404 },
      ),
      current.value.setCookies,
    );
  }

  if (sourceIsCurated && existing.row.accountId !== accountId) {
    return withSession(
      request,
      NextResponse.json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 }),
      current.value.setCookies,
    );
  }

  const deleteResult = await deleteAccountInstanceRow({
    accountId,
    publicId,
    berlinAccessToken: current.value.accessToken,
  });
  if (!deleteResult.ok) {
    const kind =
      deleteResult.status === 401
        ? 'AUTH'
        : deleteResult.status === 403
          ? 'DENY'
          : deleteResult.status === 422
            ? 'VALIDATION'
            : 'UPSTREAM_UNAVAILABLE';
    const status =
      deleteResult.status === 401 || deleteResult.status === 403 || deleteResult.status === 422
        ? deleteResult.status
        : 502;
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: deleteResult.reasonKey,
            detail: deleteResult.detail,
          },
        },
        { status },
      ),
      current.value.setCookies,
    );
  }

  const tokyoCleanup = await deleteTokyoMirrors({
    tokyoAccessToken: current.value.accessToken,
    accountId,
    publicId,
    accountCapsule: current.value.authzToken,
  });
  if (!tokyoCleanup.ok) {
    console.error('[roma account instance current route] tokyo cleanup failed after Michael delete', {
      accountId,
      publicId,
      detail: tokyoCleanup.detail,
    });
  }

  return withSession(
    request,
    NextResponse.json({
      accountId,
      publicId,
      source: existing.row.source === 'curated' ? 'curated' : 'account',
      deleted: true,
      tokyoCleanupApplied: tokyoCleanup.ok,
    }),
    current.value.setCookies,
  );
}

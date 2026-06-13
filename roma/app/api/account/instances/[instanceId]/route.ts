import { getCompiledWidgetRouteResponse } from '@clickeen/bob/compiled-widget-route';
import {
  collectConfigMediaAssetRefs,
  materializeConfigMedia,
} from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountInstanceFromTokyo,
  listPageIdsPlacingInstanceForAccount,
  refreshPagesPlacingInstanceForAccount,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { validateAccountInstanceSavePolicy } from '@roma/lib/account-instance-save-policy';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  buildSavedWidgetPublicPackage,
  isWidgetPublicPackageBuildError,
  type CompiledWidgetForPublicPackage,
  type SavedWidgetPublicPackage,
} from '@roma/lib/widget-public-package';
import {
  resolveCurrentAccountRouteContext,
  withSession,
  type CurrentAccountRouteContext,
} from '../../_lib/current-account-route';
import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from '@roma/lib/tokyo-asset-control';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

type RouteFailureLike = {
  ok: false;
  status: number;
  error: {
    kind: string;
    reasonKey: string;
    detail?: string;
    paths?: string[];
  };
};

function accountAssetResolveFailed() {
  return {
    ok: false as const,
    status: 502 as const,
    error: {
      kind: 'UPSTREAM_UNAVAILABLE' as const,
      reasonKey: 'coreui.errors.assets.resolve.failed' as const,
    },
  };
}

function isCompiledWidgetForPublicPackage(value: unknown): value is CompiledWidgetForPublicPackage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const widgetPackage = record.widgetPackage;
  return (
    typeof record.widgetname === 'string' &&
    (typeof record.displayName === 'undefined' || typeof record.displayName === 'string') &&
    Boolean(record.limits && typeof record.limits === 'object' && !Array.isArray(record.limits)) &&
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
  const packageError = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as { error?: unknown }).error : null;
  if (isWidgetPublicPackageBuildError(packageError)) throw packageError;
  throw new Error(
    payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
      ? String((payload as { error?: unknown }).error)
      : 'coreui.errors.widget.compiled.invalid',
  );
}

function routeFailureResponse(
  request: NextRequest,
  failure: RouteFailureLike,
  setCookies: CurrentAccountRouteContext['setCookies'],
) {
  return withSession(
    request,
    NextResponse.json({ error: failure.error }, { status: failure.status }),
    setCookies,
  );
}

async function materializePublicPackageMedia(args: {
  accountId: string;
  accountCapsule: string;
  requestId: string;
  config: Record<string, unknown>;
}): Promise<
  | { ok: true; state: Record<string, unknown> }
  | {
      ok: false;
      status: 422 | 502;
      error: {
        kind: 'VALIDATION' | 'UPSTREAM_UNAVAILABLE';
        reasonKey: string;
        detail?: string;
        paths?: string[];
      };
    }
> {
  let assetRefs: string[];
  try {
    assetRefs = collectConfigMediaAssetRefs(args.config);
  } catch (error) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.assets.resolve.invalidAssetRefs',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
  if (!assetRefs.length) return { ok: true, state: args.config };

  let upstream: Response;
  try {
    upstream = await fetchTokyoAssetControl({
      path: `/__internal/assets/account/${encodeURIComponent(args.accountId)}/resolve`,
      method: 'POST',
      headers: buildTokyoAssetControlHeaders({
        accountId: args.accountId,
        accountCapsule: args.accountCapsule,
        contentType: 'application/json',
        requestId: args.requestId,
      }),
      body: JSON.stringify({ assetRefs }),
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'roma.errors.proxy.tokyo_unavailable',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.assets.resolve.failed',
      },
    };
  }

  const requestedAssetRefs = new Set(assetRefs);
  if (Object.keys(payload as Record<string, unknown>).join(',') !== 'assets') return accountAssetResolveFailed();
  const assetsByRef: Record<string, unknown> = {};
  const assets = Array.isArray((payload as { assets?: unknown }).assets)
    ? ((payload as { assets: unknown[] }).assets)
    : null;
  if (!assets || assets.length !== assetRefs.length) {
    return accountAssetResolveFailed();
  }
  for (const raw of assets) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return accountAssetResolveFailed();
    }
    const keys = Object.keys(raw);
    if (keys.length !== 2 || !keys.includes('assetRef') || !keys.includes('url')) {
      return accountAssetResolveFailed();
    }
    const asset = raw as { assetRef?: unknown; url?: unknown };
    if (typeof asset.assetRef !== 'string' || typeof asset.url !== 'string' || !asset.url) {
      return accountAssetResolveFailed();
    }
    if (!requestedAssetRefs.has(asset.assetRef) || Object.prototype.hasOwnProperty.call(assetsByRef, asset.assetRef)) {
      return accountAssetResolveFailed();
    }
    assetsByRef[asset.assetRef] = asset;
  }
  const unresolved = assetRefs.filter((assetRef) => !assetsByRef[assetRef]);
  if (unresolved.length) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.assets.resolve.missing',
        detail: unresolved.join(', '),
        paths: unresolved.map((assetRef) => `assetRef:${assetRef}`),
      },
    };
  }

  let materialized: unknown;
  try {
    materialized = materializeConfigMedia(args.config, assetsByRef);
  } catch (error) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.assets.resolve.invalidMaterialization',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
  if (!materialized || typeof materialized !== 'object' || Array.isArray(materialized)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.assets.resolve.invalidMaterialization',
      },
    };
  }
  return { ok: true, state: materialized as Record<string, unknown> };
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

  let publicPackage: SavedWidgetPublicPackage;
  try {
    const compiled = await compileWidgetForSave(request, widgetType);
    const policyGate = validateAccountInstanceSavePolicy({
      widgetType,
      config,
      authz: current.value.authzPayload,
      limits: compiled.limits,
      context: 'publish',
    });
    if (!policyGate.ok) {
      return withSession(
        request,
        NextResponse.json({ error: policyGate.error }, { status: policyGate.status }),
        current.value.setCookies,
      );
    }
    const materializedMedia = await materializePublicPackageMedia({
      accountId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
      config,
    });
    if (!materializedMedia.ok) {
      return withSession(
        request,
        NextResponse.json({ error: materializedMedia.error }, { status: materializedMedia.status }),
        current.value.setCookies,
      );
    }
    publicPackage = buildSavedWidgetPublicPackage({
      compiled,
      instanceId,
      baseLocale,
      displayName: displayName ?? null,
      state: materializedMedia.state,
    });
  } catch (error) {
    if (isWidgetPublicPackageBuildError(error)) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: error.reasonKey, paths: error.paths } },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }
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
    return routeFailureResponse(request, result, current.value.setCookies);
  }
  const refreshed = await refreshPagesPlacingInstanceForAccount({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!refreshed.ok) return routeFailureResponse(request, refreshed, current.value.setCookies);
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

  const placedPages = await listPageIdsPlacingInstanceForAccount({
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

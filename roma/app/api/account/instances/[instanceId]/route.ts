import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountInstanceFromTokyo,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { listAccountPageSourcesInTokyo } from '@roma/lib/account-page-direct';
import { pageIdsPlacingInstance } from '@roma/lib/account-page-source';
import {
  compileWidgetForInstancePackage,
  materializeAccountInstancePublicPackage,
} from '@roma/lib/account-instance-public-package';
import { materializeAccountInstanceSourceArtifacts } from '@roma/lib/account-instance-source-artifacts';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { validateAccountInstanceSavePolicy } from '@roma/lib/account-instance-save-policy';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
  type CurrentAccountRouteContext,
} from '../../_lib/current-account-route';

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
  const bodyResult = await readJsonPayloadOrValidation<{
    widgetType?: string;
    config?: Record<string, unknown>;
    displayName?: string | null;
    meta?: Record<string, unknown> | null;
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
  if (
    !widgetType ||
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config)
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
  if (body && Object.prototype.hasOwnProperty.call(body, 'meta') && meta === undefined) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  if (meta && Object.prototype.hasOwnProperty.call(meta, 'targetLocales')) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.targetLocalesRemoved' } },
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

  const compiled = await compileWidgetForInstancePackage(request, widgetType);
  if (!compiled.ok) {
    return withSession(
      request,
      NextResponse.json({ error: compiled.error }, { status: compiled.status }),
      current.value.setCookies,
    );
  }
  const policyGate = validateAccountInstanceSavePolicy({
    config,
    authz: current.value.authzPayload,
    limits: compiled.value.limits,
    context: 'publish',
  });
  if (!policyGate.ok) {
    return withSession(
      request,
      NextResponse.json({ error: policyGate.error }, { status: policyGate.status }),
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
    config,
  });
  if (!publicPackage.ok) {
    return withSession(
      request,
      NextResponse.json({ error: publicPackage.error }, { status: publicPackage.status }),
      current.value.setCookies,
    );
  }
  const sourceArtifacts = materializeAccountInstanceSourceArtifacts({
    accountId,
    instanceId,
    widgetType,
    config,
    editableFields: compiled.value.editableFields ?? null,
    initialStatus: 'changed',
  });
  if (!sourceArtifacts.ok) {
    return withSession(
      request,
      NextResponse.json({ error: sourceArtifacts.error }, { status: sourceArtifacts.status }),
      current.value.setCookies,
    );
  }

  const result = await saveAccountInstanceInTokyo({
    accountId,
    instanceId,
    widgetType,
    baseLocale,
    config: sourceArtifacts.value.config,
    content: sourceArtifacts.value.content,
    publicPackage: publicPackage.value,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(meta !== undefined ? { meta } : {}),
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });

  if (!result.ok) {
    return routeFailureResponse(request, result, current.value.setCookies);
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

  const pageSources = await listAccountPageSourcesInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!pageSources.ok) {
    return routeFailureResponse(request, pageSources, current.value.setCookies);
  }
  const placedPageIds = pageIdsPlacingInstance({
    sources: pageSources.value.sources,
    instanceId,
  });
  if (!placedPageIds) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.invalidPayload' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  if (placedPageIds.length) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.instance.placedOnPage',
            detail: 'Remove this widget from every page before deleting it.',
            pageIds: placedPageIds,
          },
        },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  let deleted: Awaited<ReturnType<typeof deleteAccountInstanceFromTokyo>>;
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
  if (!deleted.ok) {
    return routeFailureResponse(request, deleted, current.value.setCookies);
  }

  return withSession(
    request,
    NextResponse.json({
      accountId,
      instanceId,
      deleted: deleted.value.existed,
      existed: deleted.value.existed,
    }),
    current.value.setCookies,
  );
}

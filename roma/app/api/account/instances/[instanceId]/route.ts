import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountInstanceFromTokyo,
  listTokyoWidgetDefinitions,
  loadTokyoAccountInstancePublicPackage,
  loadTokyoAccountInstanceSourceSnapshot,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { isRecord } from '@clickeen/ck-contracts';
import { parseCatalogPresentation } from '@clickeen/ck-contracts/catalog';
import { pageIdsPlacingInstance } from '@roma/lib/account-page-contract';
import { listAccountPageSources } from '@roma/lib/account-pages';
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const accountId = current.value.authzPayload.accountPublicId;
  if (accountId !== 'CLICKEEN') {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.accountForbidden' } },
        { status: 403 },
      ),
      current.value.setCookies,
    );
  }
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }
  const body = await readJsonPayloadOrValidation<unknown>(request);
  if (!body.ok) {
    return withSession(
      request,
      NextResponse.json({ error: body.error }, { status: body.status }),
      current.value.setCookies,
    );
  }
  const catalogPresentation = isRecord(body.payload) &&
    Object.keys(body.payload).length === 1
    ? parseCatalogPresentation(body.payload.catalogPresentation)
    : null;
  if (!catalogPresentation) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const source = await loadTokyoAccountInstanceSourceSnapshot({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!source.ok) return routeFailureResponse(request, source, current.value.setCookies);
  if (!source.value.row.isTemplate) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.templateMismatch' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const packageResult = await loadTokyoAccountInstancePublicPackage({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!packageResult.ok) {
    return routeFailureResponse(request, packageResult, current.value.setCookies);
  }
  const saved = await saveAccountInstanceInTokyo({
    accountId,
    instanceId,
    widgetType: source.value.row.widgetType,
    isTemplate: true,
    catalogPresentation,
    config: source.value.config,
    content: source.value.content,
    publicPackage: packageResult.value.publicPackage,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!saved.ok) return routeFailureResponse(request, saved, current.value.setCookies);
  return withSession(
    request,
    NextResponse.json({ ok: true, templateId: instanceId, catalogPresentation }),
    current.value.setCookies,
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
    isTemplate?: unknown;
    config?: Record<string, unknown>;
    displayName?: string | null;
    publicPackage?: {
      indexHtml?: unknown;
      stylesCss?: unknown;
      runtimeJs?: unknown;
    };
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
  const isTemplate = body?.isTemplate;
  const config = body?.config;
  const publicPackage = body?.publicPackage;
  const displayName =
    body && Object.prototype.hasOwnProperty.call(body, 'displayName')
      ? typeof body.displayName === 'string'
        ? body.displayName
        : body.displayName === null
          ? null
          : undefined
      : undefined;
  if (
    !widgetType ||
    (isTemplate !== true && isTemplate !== false) ||
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    !publicPackage ||
    typeof publicPackage.indexHtml !== 'string' ||
    typeof publicPackage.stylesCss !== 'string' ||
    typeof publicPackage.runtimeJs !== 'string'
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

  const savedSource = await loadTokyoAccountInstanceSourceSnapshot({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!savedSource.ok) return routeFailureResponse(request, savedSource, current.value.setCookies);
  if (savedSource.value.row.isTemplate !== isTemplate) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.templateMismatch' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  let baseLocale: string | undefined;
  if (!isTemplate) {
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
    baseLocale = accountLocales.localePolicy.baseLocale;
  }

  const widgetDefinitions = await listTokyoWidgetDefinitions({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!widgetDefinitions.ok) {
    return routeFailureResponse(request, widgetDefinitions, current.value.setCookies);
  }
  const widgetDefinition = widgetDefinitions.value.widgetDefinitions.find((entry) => entry.widgetType === widgetType);
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
  const policyGate = validateAccountInstanceSavePolicy({
    config,
    authz: current.value.authzPayload,
    limits: widgetDefinition.limits,
    context: 'publish',
  });
  if (!policyGate.ok) {
    return withSession(
      request,
      NextResponse.json({ error: policyGate.error }, { status: policyGate.status }),
      current.value.setCookies,
    );
  }
  const sourceArtifacts = materializeAccountInstanceSourceArtifacts({
    accountId,
    instanceId,
    widgetType,
    config,
    editableFields: widgetDefinition.editableFields,
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
    isTemplate,
    ...(baseLocale ? { baseLocale } : {}),
    ...(isTemplate && savedSource.value.row.catalogPresentation
      ? { catalogPresentation: savedSource.value.row.catalogPresentation }
      : {}),
    config: sourceArtifacts.value.config,
    content: sourceArtifacts.value.content,
    publicPackage: {
      indexHtml: publicPackage.indexHtml,
      stylesCss: publicPackage.stylesCss,
      runtimeJs: publicPackage.runtimeJs,
    },
    ...(displayName !== undefined ? { displayName } : {}),
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

  const pageSources = await listAccountPageSources({
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

import { getCompiledWidgetRouteResponse } from '@clickeen/bob/compiled-widget-route';
import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountInstanceFromTokyo,
  listPageIdsPlacingInstanceForAccount,
  listParentInstanceIdsDependingOnInstanceForAccount,
  loadTokyoAccountInstanceDocument,
  readAccountInstancePackageFromTokyo,
  refreshPagesPlacingInstanceForAccount,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { validateAccountInstanceSavePolicy } from '@roma/lib/account-instance-save-policy';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import { buildSavedWidgetPublicPackage, type CompiledWidgetForPublicPackage, type EmbeddedWidgetPublicPackage } from '@roma/lib/widget-public-package';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function embeddedInstanceIdsFromConfig(args: {
  widgetType: string;
  config: Record<string, unknown>;
  parentInstanceId: string;
}): { ok: true; value: string[] } | RouteFailureLike {
  if (args.widgetType !== 'split') return { ok: true, value: [] };
  const core = isRecord(args.config.core) ? args.config.core : null;
  const items = Array.isArray(core?.items) ? core.items : [];
  const ids = new Set<string>();
  for (const item of items) {
    if (!isRecord(item) || item.kind !== 'instance') continue;
    const instance = isRecord(item.instance) ? item.instance : null;
    const instanceId = typeof instance?.instanceId === 'string' ? instance.instanceId.trim().toUpperCase() : '';
    if (!isCompactInstanceId(instanceId)) {
      return {
        ok: false,
        status: 422,
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.widget.embeddedInstanceInvalid',
          detail: instanceId,
        },
      };
    }
    if (instanceId === args.parentInstanceId) {
      return {
        ok: false,
        status: 422,
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.widget.embeddedInstanceSelfReference',
          detail: instanceId,
        },
      };
    }
    ids.add(instanceId);
  }
  return { ok: true, value: [...ids].sort((left, right) => left.localeCompare(right)) };
}

async function loadEmbeddedPackagesForConfig(args: {
  accountId: string;
  widgetType: string;
  parentInstanceId: string;
  config: Record<string, unknown>;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: EmbeddedWidgetPublicPackage[] } | RouteFailureLike> {
  const packages: EmbeddedWidgetPublicPackage[] = [];
  const childInstanceIds = embeddedInstanceIdsFromConfig({
    widgetType: args.widgetType,
    config: args.config,
    parentInstanceId: args.parentInstanceId,
  });
  if (!childInstanceIds.ok) return childInstanceIds;
  for (const childInstanceId of childInstanceIds.value) {
    const child = await readAccountInstancePackageFromTokyo({
      accountId: args.accountId,
      instanceId: childInstanceId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!child.ok) return child;
    if (!child.value) {
      return {
        ok: false,
        status: 409,
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.widget.embeddedPackageMissing',
          detail: childInstanceId,
        },
      };
    }
    packages.push({
      instanceId: childInstanceId,
      indexHtml: child.value.indexHtml,
      stylesCss: child.value.stylesCss,
      runtimeJs: child.value.runtimeJs,
    });
    const cycle = await savedDependencyChainIncludesInstance({
      accountId: args.accountId,
      startInstanceId: childInstanceId,
      targetInstanceId: args.parentInstanceId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!cycle.ok) return cycle;
    if (cycle.value) {
      return {
        ok: false,
        status: 422,
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.widget.embeddedDependencyCycle',
          detail: childInstanceId,
        },
      };
    }
  }
  return { ok: true, value: packages };
}

async function savedDependencyChainIncludesInstance(args: {
  accountId: string;
  startInstanceId: string;
  targetInstanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: boolean } | RouteFailureLike> {
  const seen = new Set<string>();
  const queue = [args.startInstanceId];
  while (queue.length) {
    if (seen.size > 50) {
      return {
        ok: false,
        status: 409,
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.widget.embeddedDependencyDepthExceeded',
          detail: 'Embedded widget dependency chain is too deep.',
        },
      };
    }
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const pkg = await readAccountInstancePackageFromTokyo({
      accountId: args.accountId,
      instanceId: current,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!pkg.ok) return pkg;
    if (!pkg.value) continue;
    if (pkg.value.dependencies.instanceIds.includes(args.targetInstanceId)) {
      return { ok: true, value: true };
    }
    pkg.value.dependencies.instanceIds.forEach((instanceId) => {
      if (!seen.has(instanceId)) queue.push(instanceId);
    });
  }
  return { ok: true, value: false };
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

function routeFailureResponse(request: NextRequest, failure: RouteFailureLike, setCookies: CurrentAccountRouteContext['setCookies']) {
  return withSession(
    request,
    NextResponse.json({ error: failure.error }, { status: failure.status }),
    setCookies,
  );
}

async function rebuildParentInstancesAndRefreshPages(args: {
  request: NextRequest;
  accountId: string;
  seedInstanceId: string;
  fallbackBaseLocale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; rebuiltParentInstanceIds: string[]; refreshedInstanceIds: string[] } | RouteFailureLike> {
  const rebuiltParentInstanceIds = new Set<string>();
  const refreshedInstanceIds = new Set<string>([args.seedInstanceId]);
  const queue = [args.seedInstanceId];

  while (queue.length) {
    if (rebuiltParentInstanceIds.size > 50) {
      return {
        ok: false,
        status: 409,
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.widget.embeddedDependencyDepthExceeded',
          detail: 'Embedded widget dependency chain is too deep.',
        },
      };
    }

    const changedInstanceId = queue.shift()!;
    const parents = await listParentInstanceIdsDependingOnInstanceForAccount({
      accountId: args.accountId,
      instanceId: changedInstanceId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!parents.ok) return parents;

    for (const parentInstanceId of parents.value) {
      if (parentInstanceId === args.seedInstanceId || rebuiltParentInstanceIds.has(parentInstanceId)) continue;
      const parent = await loadTokyoAccountInstanceDocument({
        accountId: args.accountId,
        instanceId: parentInstanceId,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      });
      if (!parent.ok) return parent;

      const parentBaseLocale = (
        normalizeLocaleToken(parent.value.row.baseLocale)
        ?? normalizeLocaleToken(parent.value.row.meta?.baseLocale)
        ?? args.fallbackBaseLocale
      ) || 'en';
      let parentPackage;
      try {
        const compiled = await compileWidgetForSave(args.request, parent.value.row.widgetType);
        const embeddedPackages = await loadEmbeddedPackagesForConfig({
          accountId: args.accountId,
          widgetType: parent.value.row.widgetType,
          parentInstanceId,
          config: parent.value.config,
          accountCapsule: args.accountCapsule,
          requestId: args.requestId,
        });
        if (!embeddedPackages.ok) return embeddedPackages;
        parentPackage = buildSavedWidgetPublicPackage({
          compiled,
          instanceId: parentInstanceId,
          baseLocale: parentBaseLocale,
          displayName: parent.value.row.displayName ?? null,
          state: parent.value.config,
          embeddedPackages: embeddedPackages.value,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          status: 422,
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.widget.compiled.invalid',
            detail,
          },
        };
      }

      const savedParent = await saveAccountInstanceInTokyo({
        accountId: args.accountId,
        instanceId: parentInstanceId,
        widgetType: parent.value.row.widgetType,
        config: parent.value.config,
        publicPackage: parentPackage,
        displayName: parent.value.row.displayName,
        meta: parent.value.row.meta ?? null,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      });
      if (!savedParent.ok) return savedParent;
      rebuiltParentInstanceIds.add(parentInstanceId);
      refreshedInstanceIds.add(parentInstanceId);
      queue.push(parentInstanceId);
    }
  }

  for (const affectedInstanceId of refreshedInstanceIds) {
    const refreshed = await refreshPagesPlacingInstanceForAccount({
      accountId: args.accountId,
      instanceId: affectedInstanceId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!refreshed.ok) return refreshed;
  }

  return {
    ok: true,
    rebuiltParentInstanceIds: [...rebuiltParentInstanceIds].sort((left, right) => left.localeCompare(right)),
    refreshedInstanceIds: [...refreshedInstanceIds].sort((left, right) => left.localeCompare(right)),
  };
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
    const embeddedPackages = await loadEmbeddedPackagesForConfig({
      accountId,
      widgetType,
      parentInstanceId: instanceId,
      config,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
    if (!embeddedPackages.ok) return routeFailureResponse(request, embeddedPackages, current.value.setCookies);
    publicPackage = buildSavedWidgetPublicPackage({
      compiled,
      instanceId,
      baseLocale,
      displayName: displayName ?? null,
      state: config,
      embeddedPackages: embeddedPackages.value,
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
    return routeFailureResponse(request, result, current.value.setCookies);
  }
  const refreshed = await rebuildParentInstancesAndRefreshPages({
    request,
    accountId,
    seedInstanceId: instanceId,
    fallbackBaseLocale: baseLocale,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!refreshed.ok) return routeFailureResponse(request, refreshed, current.value.setCookies);
  return withSession(
    request,
    NextResponse.json({
      ok: true,
      rebuiltParentInstanceIds: refreshed.rebuiltParentInstanceIds,
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
  const parentInstances = await listParentInstanceIdsDependingOnInstanceForAccount({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!parentInstances.ok) {
    return withSession(
      request,
      NextResponse.json({ error: parentInstances.error }, { status: parentInstances.status }),
      current.value.setCookies,
    );
  }
  if (parentInstances.value.length) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.instance.embeddedInInstance',
            detail: 'Remove this widget from every parent widget before deleting it.',
            instanceIds: parentInstances.value,
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

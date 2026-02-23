import type { Env, L10nGenerateStateRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { apiError, ckError } from '../../shared/errors';
import { isRecord } from '../../shared/validation';
import { normalizeLocaleList } from '../../shared/l10n';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeWorkspace } from '../../shared/workspace-auth';
import { supabaseFetch } from '../../shared/supabase';
import { loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { loadL10nGenerateStates, loadInstanceOverlays } from './service';
import { enqueueL10nJobs } from './enqueue-jobs';
import { resolveL10nPlanningSnapshot } from './planning';
import { enforceL10nSelection, resolveWorkspaceActiveLocales } from './shared';

export async function handleWorkspaceInstanceL10nStatus(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const planning = await resolveL10nPlanningSnapshot({
    env,
    widgetType,
    config: instance.config,
    baseUpdatedAt: instance.updated_at ?? null,
  });
  if (!planning.ok) {
    return apiError('INTERNAL_ERROR', 'Failed to resolve l10n planning snapshot', 500, planning.error);
  }
  const baseFingerprint = planning.plan.baseFingerprint;
  const baseUpdatedAt = planning.plan.baseUpdatedAt;

  const workspaceLocales = resolveWorkspaceActiveLocales({ workspace });
  if (workspaceLocales instanceof Response) return workspaceLocales;
  const locales = workspaceLocales.locales;
  const entitlementGate = enforceL10nSelection(policyResult.policy, locales);
  if (entitlementGate) return entitlementGate;

  const stateMap = locales.length
    ? await loadL10nGenerateStates(env, publicId, 'locale', baseFingerprint)
    : new Map<string, L10nGenerateStateRow>();
  const overlays = locales.length ? await loadInstanceOverlays(env, publicId) : [];
  const localeOverlays = overlays.filter((row) => row.layer === 'locale');
  const overlayMatch = new Set<string>();
  const overlayStale = new Set<string>();
  localeOverlays.forEach((row) => {
    const key = row.layer_key;
    if (!key) return;
    if (row.base_fingerprint && row.base_fingerprint === baseFingerprint) {
      overlayMatch.add(key);
      return;
    }
    overlayStale.add(key);
  });

  const localeStates = locales.map((locale) => {
    const row = stateMap.get(locale);
    const hasMatch = overlayMatch.has(locale);
    const hasStale = overlayStale.has(locale);
    let status: L10nGenerateStatus = row?.status ?? 'dirty';
    if (hasMatch) status = 'succeeded';
    else if (!row?.status && hasStale) status = 'superseded';
    const attempts = hasMatch ? Math.max(row?.attempts ?? 0, 1) : (row?.attempts ?? 0);
    return {
      locale,
      status,
      attempts,
      nextAttemptAt: hasMatch ? null : (row?.next_attempt_at ?? null),
      lastAttemptAt: row?.last_attempt_at ?? null,
      lastError: hasMatch ? null : (row?.last_error ?? null),
    };
  });

  return json({
    publicId,
    widgetType,
    baseFingerprint,
    baseUpdatedAt,
    locales: localeStates,
  });
}

export async function handleWorkspaceInstanceL10nEnqueueSelected(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const workspaceLocales = resolveWorkspaceActiveLocales({ workspace });
  if (workspaceLocales instanceof Response) return workspaceLocales;
  const locales = workspaceLocales.locales;
  const entitlementGate = enforceL10nSelection(policyResult.policy, locales);
  if (entitlementGate) return entitlementGate;

  const baseUpdatedAt = instance.updated_at ?? null;
  const enqueueResult = await enqueueL10nJobs({
    env,
    instance,
    workspace,
    widgetType,
    baseUpdatedAt,
    policy: policyResult.policy,
    localesOverride: locales,
    allowNoDiff: true,
  });
  if (!enqueueResult.ok) {
    console.error('[ParisWorker] l10n enqueue failed (enqueue-selected)', enqueueResult.error);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.l10n.enqueueFailed',
        detail: enqueueResult.error,
      },
      500,
    );
  }

  return json({
    ok: true,
    publicId,
    widgetType,
    queued: enqueueResult.queued,
    skipped: enqueueResult.skipped,
  });
}

export async function handleWorkspaceLocalesGet(req: Request, env: Env, workspaceId: string) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const resolved = resolveWorkspaceActiveLocales({ workspace });
  if (resolved instanceof Response) return resolved;
  return json({ locales: resolved.locales });
}

export async function handleWorkspaceLocalesPut(req: Request, env: Env, workspaceId: string) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }

  if (!isRecord(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const localesResult = normalizeLocaleList((payload as any).locales, 'locales');
  if (!localesResult.ok) {
    return json(localesResult.issues, { status: 422 });
  }

  const locales = localesResult.locales;
  const entitlementGate = enforceL10nSelection(policyResult.policy, locales);
  if (entitlementGate) return entitlementGate;

  const patchRes = await supabaseFetch(
    env,
    `/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ l10n_locales: locales }),
    },
  );
  if (!patchRes.ok) {
    const details = await readJson(patchRes);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: JSON.stringify(details),
      },
      500,
    );
  }

  return json({ locales });
}

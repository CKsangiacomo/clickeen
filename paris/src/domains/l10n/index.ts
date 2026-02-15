import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import type { Policy } from '@clickeen/ck-policy';
import type {
  CuratedInstanceRow,
  Env,
  InstanceOverlayRow,
  InstanceRow,
  L10nBaseSnapshotRow,
  L10nGenerateReportPayload,
  L10nGenerateStateRow,
  L10nGenerateStatus,
  L10nJob,
  L10nPublishQueueJob,
  WorkspaceRow,
} from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { apiError, ckError } from '../../shared/errors';
import { assertDevAuth } from '../../shared/auth';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, isRecord, isUuid } from '../../shared/validation';
import {
  hasLocaleSuffix,
  hasProhibitedSegment,
  loadWidgetLayerAllowlist,
  loadWidgetLocalizationAllowlist,
  normalizeGeoCountries,
  normalizeL10nSource,
  normalizeLayer,
  normalizeLayerKey,
  normalizeLocaleList,
  normalizeOpPath,
  pathMatchesAllowlist,
  resolveUserOps,
  validateL10nOps,
} from '../../shared/l10n';
import {
  assertPublicId,
  assertWidgetType,
  inferInstanceKindFromPublicId,
  resolveInstanceKind,
  resolveInstanceWorkspaceId,
} from '../../shared/instances';
import { consumeBudget } from '../../shared/budgets';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { loadWorkspaceById, requireWorkspace } from '../../shared/workspaces';
import { loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { issueAiGrant } from '../ai';
import {
  L10N_GENERATE_MAX_ATTEMPTS,
  L10N_GENERATE_STALE_REQUEUE_MS,
  canRetryL10nGenerate,
  diffL10nSnapshots,
  isL10nGenerateInFlightStale,
  isL10nGenerateStatus,
  loadInstanceOverlay,
  loadInstanceOverlays,
  loadLatestL10nSnapshot,
  loadL10nGenerateStateRow,
  loadL10nGenerateStates,
  markL10nPublishDirty,
  publishLayerLocal,
  rebaseUserOverlays,
  resolveL10nFailureRetryState,
  supersedeL10nGenerateStates,
  toRetryExhaustedError,
  updateL10nGenerateStatus,
  upsertL10nGenerateStates,
  upsertL10nSnapshot,
} from './service';

async function applyL10nGenerateReport(args: { env: Env; report: L10nGenerateReportPayload }) {
  const { env, report } = args;
  let existing: L10nGenerateStateRow | null = null;
  try {
    existing = await loadL10nGenerateStateRow(
      env,
      report.publicId,
      report.layer,
      report.layerKey,
      report.baseFingerprint,
    );
  } catch (error) {
    console.error('[ParisWorker] Failed to load l10n generate state for report', error);
  }

  const occurredAt =
    report.occurredAt && !Number.isNaN(Date.parse(report.occurredAt))
      ? report.occurredAt
      : new Date().toISOString();
  const attemptsRaw =
    typeof report.attempts === 'number' && Number.isFinite(report.attempts)
      ? Math.max(0, Math.floor(report.attempts))
      : null;
  const attempts = attemptsRaw ?? existing?.attempts ?? 1;
  const failedRetry =
    report.status === 'failed'
      ? resolveL10nFailureRetryState({
          occurredAtIso: occurredAt,
          attempts: Math.max(1, attempts),
          message: report.error ? String(report.error) : 'unknown_error',
        })
      : null;

  let nextAttemptAt: string | null = null;
  let lastAttemptAt: string | null = existing?.last_attempt_at ?? null;
  if (report.status !== 'dirty') {
    lastAttemptAt = occurredAt;
  }
  if (failedRetry) nextAttemptAt = failedRetry.nextAttemptAt;

  let lastError: string | null = null;
  if (report.status === 'failed' || report.status === 'superseded') {
    if (report.status === 'failed') {
      lastError = failedRetry?.lastError ?? 'unknown_error';
    } else {
      lastError = report.error ? String(report.error) : 'superseded';
    }
  }

  await updateL10nGenerateStatus({
    env,
    publicId: report.publicId,
    layer: report.layer,
    layerKey: report.layerKey,
    baseFingerprint: report.baseFingerprint,
    status: report.status,
    widgetType: report.widgetType ?? existing?.widget_type ?? null,
    workspaceId: report.workspaceId ?? existing?.workspace_id ?? null,
    baseUpdatedAt: report.baseUpdatedAt ?? existing?.base_updated_at ?? null,
    attempts,
    nextAttemptAt,
    lastAttemptAt,
    lastError,
    changedPaths: existing?.changed_paths ?? null,
    removedPaths: existing?.removed_paths ?? null,
  });
}

export async function handleL10nGenerateReport(req: Request, env: Env): Promise<Response> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  if (!isRecord(payload)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const issues: Array<{ path: string; message: string }> = [];
  const reportRaw = payload as Record<string, unknown>;

  if (reportRaw.v !== 1) {
    issues.push({ path: 'v', message: 'invalid version' });
  }

  const publicIdResult = assertPublicId(reportRaw.publicId);
  if (!publicIdResult.ok) issues.push(...publicIdResult.issues);

  const layer = normalizeLayer(reportRaw.layer);
  if (!layer) issues.push({ path: 'layer', message: 'invalid layer' });

  const layerKey = layer ? normalizeLayerKey(layer, reportRaw.layerKey) : null;
  if (!layerKey) issues.push({ path: 'layerKey', message: 'invalid layerKey' });

  const baseFingerprint = asTrimmedString(reportRaw.baseFingerprint);
  if (!baseFingerprint)
    issues.push({ path: 'baseFingerprint', message: 'baseFingerprint is required' });

  const status = isL10nGenerateStatus(reportRaw.status) ? reportRaw.status : null;
  if (!status) issues.push({ path: 'status', message: 'invalid status' });

  const attemptsRaw = reportRaw.attempts;
  const attempts =
    typeof attemptsRaw === 'number' && Number.isFinite(attemptsRaw)
      ? Math.max(0, Math.floor(attemptsRaw))
      : undefined;

  const widgetTypeRaw = reportRaw.widgetType;
  const widgetTypeResult =
    widgetTypeRaw !== undefined
      ? assertWidgetType(widgetTypeRaw)
      : { ok: true as const, value: null };
  if (!widgetTypeResult.ok) issues.push(...widgetTypeResult.issues);

  const workspaceIdRaw = reportRaw.workspaceId;
  const workspaceId = asTrimmedString(workspaceIdRaw);
  if (workspaceId && !isUuid(workspaceId)) {
    issues.push({ path: 'workspaceId', message: 'workspaceId must be a uuid' });
  }

  const baseUpdatedAt = asTrimmedString(reportRaw.baseUpdatedAt);
  const error = asTrimmedString(reportRaw.error);
  const occurredAt = asTrimmedString(reportRaw.occurredAt);

  if (issues.length) return json(issues, { status: 422 });

  const report: L10nGenerateReportPayload = {
    v: 1,
    publicId: publicIdResult.value!,
    layer: layer!,
    layerKey: layerKey!,
    baseFingerprint: baseFingerprint!,
    status: status!,
    ...(attempts !== undefined ? { attempts } : {}),
    widgetType: widgetTypeResult.ok ? widgetTypeResult.value : null,
    workspaceId: workspaceId || null,
    baseUpdatedAt: baseUpdatedAt ?? null,
    error: error ?? null,
    occurredAt: occurredAt ?? null,
  };

  await applyL10nGenerateReport({ env, report });

  return json({ ok: true });
}

async function loadPendingL10nGenerateStates(
  env: Env,
  limit = 50,
): Promise<L10nGenerateStateRow[]> {
  const nowIso = new Date().toISOString();
  const staleBeforeIso = new Date(Date.now() - L10N_GENERATE_STALE_REQUEUE_MS).toISOString();
  const params = new URLSearchParams({
    select: [
      'public_id',
      'layer',
      'layer_key',
      'base_fingerprint',
      'base_updated_at',
      'widget_type',
      'workspace_id',
      'status',
      'attempts',
      'next_attempt_at',
      'last_attempt_at',
      'last_error',
      'changed_paths',
      'removed_paths',
    ].join(','),
    layer: 'eq.locale',
    order: 'next_attempt_at.asc.nullsfirst,last_attempt_at.asc.nullsfirst',
    limit: String(limit),
  });
  params.set(
    'or',
    `(status.eq.dirty,and(status.eq.failed,attempts.lt.${L10N_GENERATE_MAX_ATTEMPTS},next_attempt_at.lte.${nowIso}),and(status.eq.failed,attempts.lt.${L10N_GENERATE_MAX_ATTEMPTS},next_attempt_at.is.null),and(status.eq.queued,attempts.lt.${L10N_GENERATE_MAX_ATTEMPTS},last_attempt_at.lte.${staleBeforeIso}),and(status.eq.queued,attempts.lt.${L10N_GENERATE_MAX_ATTEMPTS},last_attempt_at.is.null),and(status.eq.running,attempts.lt.${L10N_GENERATE_MAX_ATTEMPTS},last_attempt_at.lte.${staleBeforeIso}),and(status.eq.running,attempts.lt.${L10N_GENERATE_MAX_ATTEMPTS},last_attempt_at.is.null))`,
  );
  const res = await supabaseFetch(env, `/rest/v1/l10n_generate_state?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load pending l10n generate state (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as L10nGenerateStateRow[];
  return rows?.filter(Boolean) ?? [];
}

async function requeueL10nGenerateStates(
  env: Env,
  limit = 50,
): Promise<{ processed: number; queued: number; failed: number }> {
  const rows = await loadPendingL10nGenerateStates(env, limit);
  if (!rows.length) return { processed: 0, queued: 0, failed: 0 };

  const envStage = asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev';
  const nowIso = new Date().toISOString();

  const workspaceLocaleCache = new Map<string, Set<string>>();
  const resolveWorkspaceLocaleSet = async (workspaceId: string): Promise<Set<string> | null> => {
    const cached = workspaceLocaleCache.get(workspaceId);
    if (cached) return cached;
    let workspace: WorkspaceRow | null = null;
    try {
      workspace = await loadWorkspaceById(env, workspaceId);
    } catch {
      return null;
    }
    if (!workspace) return null;
    const normalized = normalizeLocaleList(workspace.l10n_locales, 'l10n_locales');
    if (!normalized.ok) return null;
    const set = new Set<string>(normalized.locales);
    workspaceLocaleCache.set(workspaceId, set);
    return set;
  };

  const jobs: L10nJob[] = [];
  const queuedRows: L10nGenerateStateRow[] = [];
  const failedRows: L10nGenerateStateRow[] = [];
  const supersededRows: L10nGenerateStateRow[] = [];

  for (const row of rows) {
    const locale = row.layer_key;
    const widgetType = row.widget_type ?? null;
    const workspaceId = row.workspace_id ?? null;
    const currentAttempts = Math.max(0, Math.floor(row.attempts ?? 0));
    if (!canRetryL10nGenerate(currentAttempts)) {
      failedRows.push({
        ...row,
        status: 'failed',
        attempts: currentAttempts,
        next_attempt_at: null,
        last_attempt_at: nowIso,
        last_error: toRetryExhaustedError(row.last_error ?? 'max_attempts_reached'),
      });
      continue;
    }
    const attempts = currentAttempts + 1;
    const kind = inferInstanceKindFromPublicId(row.public_id);
    if (!locale || !widgetType || !workspaceId) {
      const retry = resolveL10nFailureRetryState({
        occurredAtIso: nowIso,
        attempts,
        message: 'missing_job_metadata',
      });
      failedRows.push({
        ...row,
        status: 'failed',
        attempts,
        next_attempt_at: retry.nextAttemptAt,
        last_attempt_at: nowIso,
        last_error: retry.lastError,
      });
      continue;
    }

    const selectedLocales = await resolveWorkspaceLocaleSet(workspaceId);
    if (!selectedLocales) {
      const retry = resolveL10nFailureRetryState({
        occurredAtIso: nowIso,
        attempts,
        message: 'workspace_locales_unavailable',
      });
      failedRows.push({
        ...row,
        status: 'failed',
        attempts,
        next_attempt_at: retry.nextAttemptAt,
        last_attempt_at: nowIso,
        last_error: retry.lastError,
      });
      continue;
    }

    if (!selectedLocales.has(locale)) {
      supersededRows.push({
        ...row,
        status: 'superseded',
        next_attempt_at: null,
        last_attempt_at: nowIso,
        last_error: 'locale_not_selected',
      });
      continue;
    }

    const grantSubject = kind === 'curated' ? 'devstudio' : 'workspace';
    const grantWorkspaceId = grantSubject === 'workspace' ? workspaceId : undefined;
    const issued = await issueAiGrant({
      env,
      agentId: 'l10n.instance.v1',
      subject: grantSubject,
      workspaceId: grantWorkspaceId,
      mode: 'ops',
      trace: { sessionId: crypto.randomUUID(), instancePublicId: row.public_id },
    });
    if (!issued.ok) {
      const details = await readJson(issued.response).catch(() => null);
      const detail = details ? JSON.stringify(details) : `status ${issued.response.status}`;
      const retry = resolveL10nFailureRetryState({
        occurredAtIso: nowIso,
        attempts,
        message: `ai_grant_failed:${detail}`,
      });
      failedRows.push({
        ...row,
        status: 'failed',
        attempts,
        next_attempt_at: retry.nextAttemptAt,
        last_attempt_at: nowIso,
        last_error: retry.lastError,
      });
      continue;
    }
    jobs.push({
      v: 2,
      agentId: issued.agentId,
      grant: issued.grant,
      publicId: row.public_id,
      widgetType,
      locale,
      baseFingerprint: row.base_fingerprint,
      baseUpdatedAt: row.base_updated_at ?? null,
      changedPaths: row.changed_paths ?? undefined,
      removedPaths: row.removed_paths ?? undefined,
      kind,
      workspaceId,
      envStage,
    });
    queuedRows.push({
      ...row,
      status: 'queued',
      attempts,
      next_attempt_at: null,
      last_attempt_at: nowIso,
      last_error: null,
    });
  }

  if (failedRows.length) {
    await upsertL10nGenerateStates(env, failedRows);
  }
  if (supersededRows.length) {
    await upsertL10nGenerateStates(env, supersededRows);
  }

  if (!jobs.length) return { processed: rows.length, queued: 0, failed: failedRows.length };

  if (!env.L10N_GENERATE_QUEUE) {
    const failedAt = new Date().toISOString();
    const queueFailures: L10nGenerateStateRow[] = queuedRows.map((row) => {
      const attempts = row.attempts ?? 1;
      const retry = resolveL10nFailureRetryState({
        occurredAtIso: failedAt,
        attempts,
        message: 'L10N_GENERATE_QUEUE missing',
      });
      return {
        ...row,
        status: 'failed' as const,
        next_attempt_at: retry.nextAttemptAt,
        last_attempt_at: failedAt,
        last_error: retry.lastError,
      };
    });
    await upsertL10nGenerateStates(env, queueFailures);
    return { processed: rows.length, queued: 0, failed: failedRows.length + queueFailures.length };
  }

  try {
    await env.L10N_GENERATE_QUEUE.sendBatch(jobs.map((job) => ({ body: job })));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const failedAt = new Date().toISOString();
    const queueFailures: L10nGenerateStateRow[] = queuedRows.map((row) => {
      const attempts = row.attempts ?? 1;
      const retry = resolveL10nFailureRetryState({
        occurredAtIso: failedAt,
        attempts,
        message: detail,
      });
      return {
        ...row,
        status: 'failed' as const,
        next_attempt_at: retry.nextAttemptAt,
        last_attempt_at: failedAt,
        last_error: retry.lastError,
      };
    });
    await upsertL10nGenerateStates(env, queueFailures);
    return { processed: rows.length, queued: 0, failed: failedRows.length + queueFailures.length };
  }

  await upsertL10nGenerateStates(env, queuedRows);
  return { processed: rows.length, queued: queuedRows.length, failed: failedRows.length };
}

export async function handleL10nGenerateRetries(env: Env): Promise<void> {
  try {
    const result = await requeueL10nGenerateStates(env, 75);
    if (result.processed > 0) {
      console.log('[ParisWorker] l10n generate retry sweep', result);
    }
  } catch (error) {
    console.error('[ParisWorker] l10n generate retry sweep failed', error);
  }
}

function requirePolicyCap(policy: Policy, key: string): number | null {
  if (!(key in policy.caps)) {
    throw new Error(`[ParisWorker] Policy missing cap key: ${key}`);
  }
  return policy.caps[key] as number | null;
}

function readWorkspaceLocales(workspace: WorkspaceRow): Response | { locales: string[] } {
  const normalized = normalizeLocaleList(workspace.l10n_locales, 'l10n_locales');
  if (!normalized.ok) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.workspace.locales.invalid',
        detail: JSON.stringify(normalized.issues),
      },
      500,
    );
  }
  return { locales: normalized.locales };
}

function resolveWorkspaceActiveLocales(args: {
  workspace: WorkspaceRow;
}): Response | { locales: string[] } {
  const configured = readWorkspaceLocales(args.workspace);
  if (configured instanceof Response) return configured;
  return configured;
}

function enforceL10nSelection(policy: Policy, locales: string[]) {
  const maxLocalesTotal = requirePolicyCap(policy, 'l10n.locales.max');
  const maxAdditional = maxLocalesTotal == null ? null : Math.max(0, maxLocalesTotal - 1);
  if (maxAdditional != null && locales.length > maxAdditional) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.capReached',
        upsell: 'UP',
        detail: `l10n.locales.max=${maxLocalesTotal}`,
      },
      403,
    );
  }
  const maxCustom = requirePolicyCap(policy, 'l10n.locales.custom.max');
  if (maxCustom != null) {
    // Some tiers reserve a subset of locale slots for system-chosen locales (e.g. Free = EN + GEO).
    const systemReserved = maxAdditional == null ? 0 : Math.max(0, maxAdditional - maxCustom);
    const customCount = Math.max(0, locales.length - systemReserved);
    if (customCount > maxCustom) {
      return ckError(
        {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.capReached',
          upsell: 'UP',
          detail: `l10n.locales.custom.max=${maxCustom}`,
        },
        403,
      );
    }
  }
  return null;
}

function enforceLayerEntitlement(_policy: Policy, _layer: string): Response | null {
  return null;
}

export async function handleWorkspaceInstanceLayersList(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const rows = await loadInstanceOverlays(env, publicIdResult.value);
  return json({
    publicId: instance.public_id,
    workspaceId: resolveInstanceWorkspaceId(instance),
    layers: rows.map((row) => {
      const { userOps } = resolveUserOps(row);
      return {
        layer: row.layer,
        layerKey: row.layer_key,
        source: row.source,
        baseFingerprint: row.base_fingerprint,
        baseUpdatedAt: row.base_updated_at ?? null,
        geoTargets: row.geo_targets ?? null,
        updatedAt: row.updated_at ?? null,
        hasUserOps: userOps.length > 0,
      };
    }),
  });
}

export async function handleWorkspaceInstanceLayerGet(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const layer = normalizeLayer(layerRaw);
  if (!layer) {
    return apiError('LAYER_INVALID', 'Invalid layer', 400, { layer: layerRaw });
  }
  const layerKey = normalizeLayerKey(layer, layerKeyRaw);
  if (!layerKey) {
    return apiError('LAYER_KEY_INVALID', 'Invalid layerKey', 400, { layer, layerKey: layerKeyRaw });
  }

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const row = await loadInstanceOverlay(env, publicIdResult.value, layer, layerKey);
  if (!row) {
    return apiError('LAYER_NOT_FOUND', 'Layer overlay not found', 404, {
      publicId,
      layer,
      layerKey,
    });
  }

  const { userOps } = resolveUserOps(row);
  return json({
    publicId: row.public_id,
    layer: row.layer,
    layerKey: row.layer_key,
    source: row.source,
    ops: row.ops,
    userOps,
    baseFingerprint: row.base_fingerprint,
    baseUpdatedAt: row.base_updated_at ?? null,
    geoTargets: row.geo_targets ?? null,
    workspaceId: row.workspace_id ?? null,
    updatedAt: row.updated_at ?? null,
  });
}

export async function handleWorkspaceInstanceLayerUpsert(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const layer = normalizeLayer(layerRaw);
  if (!layer) {
    return apiError('LAYER_INVALID', 'Invalid layer', 400, { layer: layerRaw });
  }
  const layerKey = normalizeLayerKey(layer, layerKeyRaw);
  if (!layerKey) {
    return apiError('LAYER_KEY_INVALID', 'Invalid layerKey', 400, { layer, layerKey: layerKeyRaw });
  }
  if (layer === 'locale' && hasLocaleSuffix(publicIdResult.value, layerKey)) {
    return apiError('LOCALE_INVALID', 'publicId must be locale-free', 400, {
      publicId,
      locale: layerKey,
    });
  }
  if (
    layer === 'user' &&
    layerKey !== 'global' &&
    hasLocaleSuffix(publicIdResult.value, layerKey)
  ) {
    return apiError('LOCALE_INVALID', 'publicId must be locale-free', 400, {
      publicId,
      locale: layerKey,
    });
  }

  const entitlementGate = enforceLayerEntitlement(policyResult.policy, layer);
  if (entitlementGate) return entitlementGate;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError('OPS_INVALID_TYPE', 'Invalid JSON payload', 400);
  }
  if (!isRecord(payload)) {
    return apiError('OPS_INVALID_TYPE', 'Payload must be an object', 400);
  }

  const hasOps = Object.prototype.hasOwnProperty.call(payload, 'ops');
  const hasUserOps = Object.prototype.hasOwnProperty.call(payload, 'userOps');
  if (!hasOps && !hasUserOps) {
    return apiError('OPS_INVALID_TYPE', 'ops or userOps required', 400);
  }
  if (hasUserOps && layer !== 'user') {
    return apiError('OPS_INVALID_TYPE', 'userOps only allowed for layer=user', 400, { layer });
  }

  const hasGeoTargets = Object.prototype.hasOwnProperty.call(payload, 'geoTargets');
  if (hasGeoTargets && layer !== 'locale') {
    return apiError('OPS_INVALID_TYPE', 'geoTargets only allowed for layer=locale', 400, { layer });
  }
  if (hasGeoTargets && !hasOps) {
    return apiError('OPS_INVALID_TYPE', 'geoTargets requires ops', 400);
  }

  const source = hasOps ? normalizeL10nSource((payload as any).source) : null;
  if (hasOps && !source) {
    return apiError('OPS_INVALID_TYPE', 'Invalid source', 400);
  }

  const baseFingerprintRaw = asTrimmedString((payload as any).baseFingerprint);
  const baseUpdatedAtRaw = asTrimmedString((payload as any).baseUpdatedAt);
  const widgetTypeRaw = asTrimmedString((payload as any).widgetType);

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance) return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });

  const instanceKind = resolveInstanceKind(instance);
  const instanceWorkspaceId = resolveInstanceWorkspaceId(instance);
  if (instanceKind === 'user') {
    if (!instanceWorkspaceId) {
      return apiError('WORKSPACE_MISMATCH', 'Instance missing workspace', 403, { publicId });
    }
    if (instanceWorkspaceId !== workspaceId) {
      return apiError('WORKSPACE_MISMATCH', 'Instance does not belong to workspace', 403, {
        publicId,
        workspaceId,
      });
    }
    if (layer === 'locale') {
      const normalized = normalizeLocaleList(workspace.l10n_locales, 'l10n_locales');
      if (!normalized.ok) {
        return apiError('LOCALE_INVALID', 'Workspace locales invalid', 500, normalized.issues);
      }
      if (!normalized.locales.includes(layerKey)) {
        return apiError('LOCALE_NOT_ENTITLED', 'Locale not enabled for workspace', 403, {
          locale: layerKey,
          workspaceId: instanceWorkspaceId,
        });
      }
    }
  }

  let widgetTypeFallback: string | null = null;
  if (widgetTypeRaw) {
    const widgetTypeResult = assertWidgetType(widgetTypeRaw);
    if (!widgetTypeResult.ok) {
      return apiError('OPS_INVALID_TYPE', 'Invalid widgetType', 400, widgetTypeResult.issues);
    }
    widgetTypeFallback = widgetTypeResult.value;
  }
  const widgetType = await resolveWidgetTypeForInstance(env, instance, widgetTypeFallback);
  if (!widgetType) {
    return apiError('INTERNAL_ERROR', 'widgetType required for allowlist', 500);
  }

  let localizationAllowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  try {
    localizationAllowlist = await loadWidgetLocalizationAllowlist(env, widgetType);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to load localization allowlist', 500, detail);
  }

  const l10nSnapshot = buildL10nSnapshot(instance.config, localizationAllowlist);
  const computedFingerprint = await computeBaseFingerprint(l10nSnapshot);
  if (!baseFingerprintRaw) {
    return apiError('FINGERPRINT_MISMATCH', 'baseFingerprint required', 409);
  }
  if (baseFingerprintRaw !== computedFingerprint) {
    return apiError('FINGERPRINT_MISMATCH', 'baseFingerprint does not match', 409, {
      provided: baseFingerprintRaw,
    });
  }

  let allowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  try {
    allowlist = await loadWidgetLayerAllowlist(env, widgetType, layer);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to load layer allowlist', 500, detail);
  }
  const allowlistPaths = allowlist.map((entry) => entry.path);

  const existing = await loadInstanceOverlay(env, publicIdResult.value, layer, layerKey);
  const existingUserOps = resolveUserOps(existing).userOps;

  const geoResult = hasGeoTargets
    ? normalizeGeoCountries((payload as any).geoTargets, 'geoTargets')
    : null;
  if (geoResult && !geoResult.ok) {
    return apiError('OPS_INVALID_TYPE', 'Invalid geoTargets', 400, geoResult.issues);
  }

  const opsResult = hasOps ? validateL10nOps((payload as any).ops, allowlistPaths) : null;
  if (hasOps && opsResult && !opsResult.ok) {
    return apiError(opsResult.code, opsResult.message, 400, opsResult.detail);
  }

  const userOpsResult = hasUserOps
    ? validateL10nOps((payload as any).userOps, allowlistPaths)
    : null;
  if (hasUserOps && userOpsResult && !userOpsResult.ok) {
    return apiError(userOpsResult.code, userOpsResult.message, 400, userOpsResult.detail);
  }

  const maxPublishes = policyResult.policy.budgets['budget.l10n.publishes']?.max ?? null;
  const publish = await consumeBudget({
    env,
    scope: { kind: 'workspace', workspaceId },
    budgetKey: 'budget.l10n.publishes',
    max: maxPublishes,
    amount: 1,
  });
  if (!publish.ok) {
    return ckError(
      { kind: 'DENY', reasonKey: publish.reasonKey, upsell: 'UP', detail: publish.detail },
      403,
    );
  }

  let row: InstanceOverlayRow | null = null;
  if (hasOps) {
    const geoTargets = hasGeoTargets
      ? (geoResult?.geoCountries ?? null)
      : (existing?.geo_targets ?? null);
    const payloadRow = {
      public_id: publicIdResult.value,
      layer,
      layer_key: layerKey,
      ops: opsResult?.ok ? opsResult.ops : [],
      user_ops:
        layer === 'user'
          ? hasUserOps && userOpsResult?.ok
            ? userOpsResult.ops
            : existingUserOps
          : [],
      base_fingerprint: computedFingerprint,
      base_updated_at: baseUpdatedAtRaw ?? instance.updated_at ?? null,
      source,
      geo_targets: geoTargets,
      workspace_id: instanceWorkspaceId,
    };

    const upsertRes = await supabaseFetch(
      env,
      `/rest/v1/widget_instance_overlays?on_conflict=public_id,layer,layer_key`,
      {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payloadRow),
      },
    );
    if (!upsertRes.ok) {
      const details = await readJson(upsertRes);
      return apiError('INTERNAL_ERROR', 'Failed to upsert layer', 500, details);
    }

    const rows = (await upsertRes.json().catch(() => [])) as InstanceOverlayRow[];
    row = rows?.[0] ?? null;
  } else if (hasUserOps && userOpsResult?.ok) {
    if (!existing) {
      const payloadRow = {
        public_id: publicIdResult.value,
        layer,
        layer_key: layerKey,
        ops: [],
        user_ops: userOpsResult.ops,
        base_fingerprint: computedFingerprint,
        base_updated_at: baseUpdatedAtRaw ?? instance.updated_at ?? null,
        source: 'user',
        geo_targets: null,
        workspace_id: instanceWorkspaceId,
      };
      const insertRes = await supabaseFetch(
        env,
        `/rest/v1/widget_instance_overlays?on_conflict=public_id,layer,layer_key`,
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payloadRow),
        },
      );
      if (!insertRes.ok) {
        const details = await readJson(insertRes);
        return apiError('INTERNAL_ERROR', 'Failed to create layer overrides', 500, details);
      }
      const rows = (await insertRes.json().catch(() => [])) as InstanceOverlayRow[];
      row = rows?.[0] ?? null;
    } else {
      const patchRes = await supabaseFetch(
        env,
        `/rest/v1/widget_instance_overlays?public_id=eq.${encodeURIComponent(
          publicIdResult.value,
        )}&layer=eq.${encodeURIComponent(layer)}&layer_key=eq.${encodeURIComponent(layerKey)}`,
        {
          method: 'PATCH',
          headers: {
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ user_ops: userOpsResult.ops }),
        },
      );
      if (!patchRes.ok) {
        const details = await readJson(patchRes);
        return apiError('INTERNAL_ERROR', 'Failed to update layer overrides', 500, details);
      }
      const rows = (await patchRes.json().catch(() => [])) as InstanceOverlayRow[];
      row = rows?.[0] ?? null;
    }
  }

  if (layer === 'locale') {
    const overlayFingerprint = row?.base_fingerprint ?? computedFingerprint;
    if (overlayFingerprint) {
      try {
        const existingState = await loadL10nGenerateStateRow(
          env,
          publicIdResult.value,
          layer,
          layerKey,
          overlayFingerprint,
        );
        const attempts = existingState?.attempts ?? 1;
        await updateL10nGenerateStatus({
          env,
          publicId: publicIdResult.value,
          layer,
          layerKey,
          baseFingerprint: overlayFingerprint,
          status: 'succeeded',
          widgetType,
          workspaceId: instanceWorkspaceId ?? workspaceId ?? null,
          baseUpdatedAt: row?.base_updated_at ?? baseUpdatedAtRaw ?? instance.updated_at ?? null,
          attempts,
          nextAttemptAt: null,
          lastAttemptAt: new Date().toISOString(),
          lastError: null,
          changedPaths: existingState?.changed_paths ?? null,
          removedPaths: existingState?.removed_paths ?? null,
        });
      } catch (error) {
        console.error('[ParisWorker] Failed to mark l10n generate state succeeded', error);
      }
    }
  }

  if (!env.L10N_PUBLISH_QUEUE) {
    return apiError('INTERNAL_ERROR', 'L10N_PUBLISH_QUEUE missing', 500);
  }
  const markDirty = await markL10nPublishDirty({
    env,
    publicId: publicIdResult.value,
    layer,
    layerKey,
    baseFingerprint: computedFingerprint,
  });
  if (markDirty) return markDirty;
  try {
    await env.L10N_PUBLISH_QUEUE.send({
      v: 2,
      publicId: publicIdResult.value,
      layer,
      layerKey,
      action: 'upsert',
    } satisfies L10nPublishQueueJob);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to enqueue publish job', 500, detail);
  }

  const localPublish = await publishLayerLocal(
    env,
    publicIdResult.value,
    layer,
    layerKey,
    'upsert',
  );
  if (localPublish) return localPublish;

  const resolvedSource = row?.source ?? source ?? null;
  return json({
    publicId: publicIdResult.value,
    layer,
    layerKey,
    source: resolvedSource,
    baseFingerprint: row?.base_fingerprint ?? computedFingerprint,
    baseUpdatedAt: row?.base_updated_at ?? baseUpdatedAtRaw ?? instance.updated_at ?? null,
    updatedAt: row?.updated_at ?? null,
  });
}

export async function handleWorkspaceInstanceLayerDelete(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const layer = normalizeLayer(layerRaw);
  if (!layer) {
    return apiError('LAYER_INVALID', 'Invalid layer', 400, { layer: layerRaw });
  }
  const layerKey = normalizeLayerKey(layer, layerKeyRaw);
  if (!layerKey) {
    return apiError('LAYER_KEY_INVALID', 'Invalid layerKey', 400, { layer, layerKey: layerKeyRaw });
  }

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance) return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType) return apiError('INTERNAL_ERROR', 'widgetType required for allowlist', 500);
  let localizationAllowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  try {
    localizationAllowlist = await loadWidgetLocalizationAllowlist(env, widgetType);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to load localization allowlist', 500, detail);
  }
  const l10nSnapshot = buildL10nSnapshot(instance.config, localizationAllowlist);
  const computedFingerprint = await computeBaseFingerprint(l10nSnapshot);

  const existing = await loadInstanceOverlay(env, publicIdResult.value, layer, layerKey);
  if (!existing) {
    return json({
      publicId: publicIdResult.value,
      layer,
      layerKey,
      deleted: false,
      reason: 'not_found',
    });
  }

  const maxPublishes = policyResult.policy.budgets['budget.l10n.publishes']?.max ?? null;
  const publish = await consumeBudget({
    env,
    scope: { kind: 'workspace', workspaceId },
    budgetKey: 'budget.l10n.publishes',
    max: maxPublishes,
    amount: 1,
  });
  if (!publish.ok) {
    return ckError(
      { kind: 'DENY', reasonKey: publish.reasonKey, upsell: 'UP', detail: publish.detail },
      403,
    );
  }

  const deleteRes = await supabaseFetch(
    env,
    `/rest/v1/widget_instance_overlays?public_id=eq.${encodeURIComponent(
      publicIdResult.value,
    )}&layer=eq.${encodeURIComponent(layer)}&layer_key=eq.${encodeURIComponent(layerKey)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    },
  );
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    return apiError('INTERNAL_ERROR', 'Failed to delete layer overlay', 500, details);
  }

  if (!env.L10N_PUBLISH_QUEUE) {
    return apiError('INTERNAL_ERROR', 'L10N_PUBLISH_QUEUE missing', 500);
  }
  const markDirty = await markL10nPublishDirty({
    env,
    publicId: publicIdResult.value,
    layer,
    layerKey,
    baseFingerprint: computedFingerprint,
  });
  if (markDirty) return markDirty;
  try {
    await env.L10N_PUBLISH_QUEUE.send({
      v: 2,
      publicId: publicIdResult.value,
      layer,
      layerKey,
      action: 'delete',
    } satisfies L10nPublishQueueJob);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to enqueue publish job', 500, detail);
  }

  const localPublish = await publishLayerLocal(
    env,
    publicIdResult.value,
    layer,
    layerKey,
    'delete',
  );
  if (localPublish) return localPublish;

  return json({ publicId: publicIdResult.value, layer, layerKey, deleted: true });
}

export async function handleWorkspaceInstanceL10nStatus(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  let localizationAllowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  try {
    localizationAllowlist = await loadWidgetLocalizationAllowlist(env, widgetType);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to load localization allowlist', 500, detail);
  }
  const l10nSnapshot = buildL10nSnapshot(instance.config, localizationAllowlist);
  const baseFingerprint = await computeBaseFingerprint(l10nSnapshot);
  const baseUpdatedAt = instance.updated_at ?? null;

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
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

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
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const resolved = resolveWorkspaceActiveLocales({ workspace });
  if (resolved instanceof Response) return resolved;
  return json({ locales: resolved.locales });
}

export async function handleWorkspaceLocalesPut(req: Request, env: Env, workspaceId: string) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

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

export async function enqueueL10nJobs(args: {
  env: Env;
  instance: InstanceRow | CuratedInstanceRow;
  workspace: WorkspaceRow;
  widgetType: string | null;
  baseUpdatedAt: string | null | undefined;
  policy: Policy;
  localesOverride?: string[];
  allowNoDiff?: boolean;
}) {
  if (!args.widgetType) {
    return {
      ok: false as const,
      queued: 0,
      skipped: 0,
      error: 'coreui.errors.instance.widgetMissing',
    };
  }

  const kind = resolveInstanceKind(args.instance);
  const workspaceLocales = readWorkspaceLocales(args.workspace);
  if (workspaceLocales instanceof Response) {
    return {
      ok: false as const,
      queued: 0,
      skipped: 0,
      error: 'coreui.errors.workspace.locales.invalid',
    };
  }
  const locales = args.localesOverride ?? workspaceLocales.locales;
  const entitlementGate = enforceL10nSelection(args.policy, locales);
  if (entitlementGate) {
    return { ok: true as const, queued: 0, skipped: locales.length };
  }

  if (locales.length === 0) return { ok: true as const, queued: 0, skipped: 0 };

  const workspaceId = resolveInstanceWorkspaceId(args.instance) ?? args.workspace.id;
  let localizationAllowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  try {
    localizationAllowlist = await loadWidgetLocalizationAllowlist(args.env, args.widgetType);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false as const, queued: 0, skipped: 0, error: detail };
  }

  const l10nSnapshot = buildL10nSnapshot(args.instance.config, localizationAllowlist);
  const baseFingerprint = await computeBaseFingerprint(l10nSnapshot);
  const previousSnapshot = await loadLatestL10nSnapshot(args.env, args.instance.public_id);
  const { changedPaths, removedPaths } = diffL10nSnapshots(
    previousSnapshot?.snapshot ?? null,
    l10nSnapshot,
  );
  const fingerprintChanged = previousSnapshot?.base_fingerprint !== baseFingerprint;

  const envStage = asTrimmedString(args.env.ENV_STAGE) ?? 'cloud-dev';
  const layer = 'locale';
  const publicId = args.instance.public_id;
  const baseUpdatedAt = args.baseUpdatedAt ?? null;
  const sfBaseUrl = asTrimmedString(args.env.SANFRANCISCO_BASE_URL);
  const useDirectDispatch = envStage === 'local' && Boolean(sfBaseUrl);

  if (fingerprintChanged) {
    try {
      await upsertL10nSnapshot(args.env, {
        public_id: publicId,
        base_fingerprint: baseFingerprint,
        snapshot: l10nSnapshot,
        widget_type: args.widgetType,
        base_updated_at: baseUpdatedAt ?? null,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false as const, queued: 0, skipped: 0, error: detail };
    }
  }

  const allowlistPaths = localizationAllowlist.map((entry) => entry.path);
  const diffIsEmpty = changedPaths.length === 0 && removedPaths.length === 0;
  const translateWithoutDiff = Boolean(args.allowNoDiff) && diffIsEmpty;
  const effectiveChangedPaths = translateWithoutDiff ? allowlistPaths : changedPaths;
  const effectiveRemovedPaths = translateWithoutDiff ? [] : removedPaths;
  if (fingerprintChanged) {
    try {
      await rebaseUserOverlays({
        env: args.env,
        publicId,
        baseFingerprint,
        baseUpdatedAt,
        allowlistPaths,
        snapshot: l10nSnapshot,
      });
    } catch (error) {
      console.error('[ParisWorker] Failed to rebase user overlays', error);
    }
  }

  if (fingerprintChanged) {
    await supersedeL10nGenerateStates({
      env: args.env,
      publicId,
      layer,
      layerKeys: locales,
      baseFingerprint,
    });
  }

  if (!translateWithoutDiff && diffIsEmpty) {
    return { ok: true as const, queued: 0, skipped: locales.length };
  }

  const existingStates = await loadL10nGenerateStates(args.env, publicId, layer, baseFingerprint);
  let matchingOverlayLocales = new Set<string>();
  try {
    const overlays = await loadInstanceOverlays(args.env, publicId);
    overlays.forEach((row) => {
      if (row.layer !== 'locale') return;
      if (!row.layer_key) return;
      if (row.base_fingerprint !== baseFingerprint) return;
      matchingOverlayLocales.add(row.layer_key);
    });
  } catch (error) {
    console.error('[ParisWorker] Failed to load overlay matches for l10n enqueue', error);
  }
  const pendingLocales: string[] = [];
  const dirtyRows: L10nGenerateStateRow[] = [];
  const succeededRows: L10nGenerateStateRow[] = [];
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const allowRetryScheduleOverride = Boolean(args.allowNoDiff);

  locales.forEach((locale) => {
    const current = existingStates.get(locale);
    const hasMatchingOverlay = matchingOverlayLocales.has(locale);
    if (diffIsEmpty && hasMatchingOverlay) {
      if (current?.status !== 'succeeded') {
        const attempts = Math.max(current?.attempts ?? 0, 1);
        succeededRows.push({
          public_id: publicId,
          layer,
          layer_key: locale,
          base_fingerprint: baseFingerprint,
          base_updated_at: baseUpdatedAt,
          widget_type: args.widgetType!,
          workspace_id: workspaceId,
          status: 'succeeded',
          attempts,
          next_attempt_at: null,
          last_attempt_at: current?.last_attempt_at ?? nowIso,
          last_error: null,
          changed_paths: current?.changed_paths ?? null,
          removed_paths: current?.removed_paths ?? null,
        });
      }
      return;
    }
    if (current?.status === 'succeeded') return;
    if (current?.status === 'failed') {
      const attempts = Math.max(0, Math.floor(current.attempts ?? 0));
      if (!canRetryL10nGenerate(attempts)) return;
      const nextAttemptMs = current.next_attempt_at ? Date.parse(current.next_attempt_at) : NaN;
      const retryReady = !Number.isFinite(nextAttemptMs) || nextAttemptMs <= nowMs;
      if (!retryReady && !allowRetryScheduleOverride) return;
    }
    if (current && (current.status === 'queued' || current.status === 'running')) {
      const staleAttempt = isL10nGenerateInFlightStale(current.last_attempt_at, nowMs);
      if (!staleAttempt && !useDirectDispatch) return;
    }
    pendingLocales.push(locale);
    dirtyRows.push({
      public_id: publicId,
      layer,
      layer_key: locale,
      base_fingerprint: baseFingerprint,
      base_updated_at: baseUpdatedAt,
      widget_type: args.widgetType!,
      workspace_id: workspaceId,
      status: 'dirty',
      attempts: current?.attempts ?? 0,
      next_attempt_at: null,
      last_attempt_at: current?.last_attempt_at ?? null,
      last_error: null,
      changed_paths: effectiveChangedPaths,
      removed_paths: effectiveRemovedPaths,
    });
  });

  if (succeededRows.length) {
    await upsertL10nGenerateStates(args.env, succeededRows);
  }

  if (!pendingLocales.length) return { ok: true as const, queued: 0, skipped: locales.length };

  await upsertL10nGenerateStates(args.env, dirtyRows);

  const grantSubject = kind === 'curated' ? 'devstudio' : 'workspace';
  const grantWorkspaceId = grantSubject === 'workspace' ? workspaceId : undefined;
  if (grantSubject === 'workspace' && !grantWorkspaceId) {
    return {
      ok: false as const,
      queued: 0,
      skipped: 0,
      error: 'Missing workspaceId for user l10n grant',
    };
  }
  const jobs: L10nJob[] = [];
  for (const locale of pendingLocales) {
    const issued = await issueAiGrant({
      env: args.env,
      agentId: 'l10n.instance.v1',
      subject: grantSubject,
      workspaceId: grantWorkspaceId,
      mode: 'ops',
      trace: { sessionId: crypto.randomUUID(), instancePublicId: publicId },
    });
    if (!issued.ok) {
      const details = await readJson(issued.response).catch(() => null);
      const detail = details ? JSON.stringify(details) : `status ${issued.response.status}`;
      return {
        ok: false as const,
        queued: 0,
        skipped: 0,
        error: `AI grant failed for l10n: ${detail}`,
      };
    }
    jobs.push({
      v: 2,
      agentId: issued.agentId,
      grant: issued.grant,
      publicId,
      widgetType: args.widgetType!,
      locale,
      baseFingerprint,
      baseUpdatedAt,
      changedPaths: effectiveChangedPaths,
      removedPaths: effectiveRemovedPaths,
      kind,
      workspaceId,
      envStage,
    });
  }

  if (useDirectDispatch) {
    const token = asTrimmedString(args.env.PARIS_DEV_JWT);
    const dispatchUrl = new URL('/v1/l10n', sfBaseUrl as string).toString();
    let res: Response;
    let payload: unknown;
    try {
      res = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ jobs }),
      });
      payload = await readJson(res);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const failedAt = new Date();
      const failedRows: L10nGenerateStateRow[] = pendingLocales.map((locale) => {
        const current = existingStates.get(locale);
        const attempts = (current?.attempts ?? 0) + 1;
        const retry = resolveL10nFailureRetryState({
          occurredAtIso: failedAt.toISOString(),
          attempts,
          message: detail,
        });
        return {
          public_id: publicId,
          layer,
          layer_key: locale,
          base_fingerprint: baseFingerprint,
          base_updated_at: baseUpdatedAt,
          widget_type: args.widgetType!,
          workspace_id: workspaceId,
          status: 'failed',
          attempts,
          next_attempt_at: retry.nextAttemptAt,
          last_attempt_at: failedAt.toISOString(),
          last_error: retry.lastError,
          changed_paths: effectiveChangedPaths,
          removed_paths: effectiveRemovedPaths,
        };
      });
      await upsertL10nGenerateStates(args.env, failedRows);
      return {
        ok: false as const,
        queued: 0,
        skipped: locales.length - pendingLocales.length,
        error: detail,
      };
    }
    if (!res.ok) {
      const detail =
        asTrimmedString((payload as any)?.error?.message) ||
        asTrimmedString((payload as any)?.error?.code) ||
        (payload ? JSON.stringify(payload) : '') ||
        `HTTP ${res.status}`;
      const failedAt = new Date();
      const failedRows: L10nGenerateStateRow[] = pendingLocales.map((locale) => {
        const current = existingStates.get(locale);
        const attempts = (current?.attempts ?? 0) + 1;
        const retry = resolveL10nFailureRetryState({
          occurredAtIso: failedAt.toISOString(),
          attempts,
          message: detail,
        });
        return {
          public_id: publicId,
          layer,
          layer_key: locale,
          base_fingerprint: baseFingerprint,
          base_updated_at: baseUpdatedAt,
          widget_type: args.widgetType!,
          workspace_id: workspaceId,
          status: 'failed',
          attempts,
          next_attempt_at: retry.nextAttemptAt,
          last_attempt_at: failedAt.toISOString(),
          last_error: retry.lastError,
          changed_paths: effectiveChangedPaths,
          removed_paths: effectiveRemovedPaths,
        };
      });
      await upsertL10nGenerateStates(args.env, failedRows);
      return {
        ok: false as const,
        queued: 0,
        skipped: locales.length - pendingLocales.length,
        error: detail,
      };
    }
  } else {
    if (!args.env.L10N_GENERATE_QUEUE) {
      const failedAt = new Date();
      const failedRows: L10nGenerateStateRow[] = pendingLocales.map((locale) => {
        const current = existingStates.get(locale);
        const attempts = (current?.attempts ?? 0) + 1;
        const retry = resolveL10nFailureRetryState({
          occurredAtIso: failedAt.toISOString(),
          attempts,
          message: 'L10N_GENERATE_QUEUE missing',
        });
        return {
          public_id: publicId,
          layer,
          layer_key: locale,
          base_fingerprint: baseFingerprint,
          base_updated_at: baseUpdatedAt,
          widget_type: args.widgetType!,
          workspace_id: workspaceId,
          status: 'failed',
          attempts,
          next_attempt_at: retry.nextAttemptAt,
          last_attempt_at: failedAt.toISOString(),
          last_error: retry.lastError,
          changed_paths: effectiveChangedPaths,
          removed_paths: effectiveRemovedPaths,
        };
      });
      await upsertL10nGenerateStates(args.env, failedRows);
      return {
        ok: false as const,
        queued: 0,
        skipped: locales.length - pendingLocales.length,
        error: 'L10N_GENERATE_QUEUE missing',
      };
    }

    try {
      await args.env.L10N_GENERATE_QUEUE.sendBatch(jobs.map((job) => ({ body: job })));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const failedAt = new Date();
      const failedRows: L10nGenerateStateRow[] = pendingLocales.map((locale) => {
        const current = existingStates.get(locale);
        const attempts = (current?.attempts ?? 0) + 1;
        const retry = resolveL10nFailureRetryState({
          occurredAtIso: failedAt.toISOString(),
          attempts,
          message: detail,
        });
        return {
          public_id: publicId,
          layer,
          layer_key: locale,
          base_fingerprint: baseFingerprint,
          base_updated_at: baseUpdatedAt,
          widget_type: args.widgetType!,
          workspace_id: workspaceId,
          status: 'failed',
          attempts,
          next_attempt_at: retry.nextAttemptAt,
          last_attempt_at: failedAt.toISOString(),
          last_error: retry.lastError,
          changed_paths: effectiveChangedPaths,
          removed_paths: effectiveRemovedPaths,
        };
      });
      await upsertL10nGenerateStates(args.env, failedRows);
      return {
        ok: false as const,
        queued: 0,
        skipped: locales.length - pendingLocales.length,
        error: detail,
      };
    }
  }

  const queuedAt = new Date().toISOString();
  const queuedRows: L10nGenerateStateRow[] = pendingLocales.map((locale) => {
    const current = existingStates.get(locale);
    const attempts = (current?.attempts ?? 0) + 1;
    return {
      public_id: publicId,
      layer,
      layer_key: locale,
      base_fingerprint: baseFingerprint,
      base_updated_at: baseUpdatedAt,
      widget_type: args.widgetType!,
      workspace_id: workspaceId,
      status: 'queued',
      attempts,
      next_attempt_at: null,
      last_attempt_at: queuedAt,
      last_error: null,
      changed_paths: effectiveChangedPaths,
      removed_paths: effectiveRemovedPaths,
    };
  });
  await upsertL10nGenerateStates(args.env, queuedRows);

  return {
    ok: true as const,
    queued: pendingLocales.length,
    skipped: locales.length - pendingLocales.length,
  };
}

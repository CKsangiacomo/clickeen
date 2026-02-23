import { asTrimmedString, isRecord, isUuid } from '../../shared/validation';
import {
  normalizeLayer,
  normalizeLayerKey,
  normalizeLocaleList,
} from '../../shared/l10n';
import {
  assertPublicId,
  assertWidgetType,
  inferInstanceKindFromPublicId,
} from '../../shared/instances';
import type {
  Env,
  L10nGenerateReportPayload,
  L10nGenerateStateRow,
  L10nJob,
  WorkspaceRow,
} from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { assertDevAuth } from '../../shared/auth';
import { supabaseFetch } from '../../shared/supabase';
import { loadWorkspaceById } from '../../shared/workspaces';
import { issueAiGrant } from '../ai';
import {
  L10N_GENERATE_MAX_ATTEMPTS,
  L10N_GENERATE_STALE_REQUEUE_MS,
  canRetryL10nGenerate,
  isL10nGenerateStatus,
  loadL10nGenerateStateRow,
  resolveL10nFailureRetryState,
  toRetryExhaustedError,
  updateL10nGenerateStatus,
  upsertL10nGenerateStates,
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

    const issued = await issueAiGrant({
      env,
      agentId: 'l10n.instance.v1',
      subject: 'workspace',
      workspaceId,
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


import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import { resolvePolicy } from '@clickeen/ck-policy';
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
  AccountRow,
  Env,
  L10nGenerateReportPayload,
  L10nGenerateStateRow,
  L10nJob,
} from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { assertDevAuth } from '../../shared/auth';
import { loadAccountById } from '../../shared/accounts';
import { loadWidgetLocalizationAllowlist } from '../../shared/l10n';
import { issueAiGrant } from '../ai';
import { convergePublishedInstanceSurface } from '../account-instances/published-convergence';
import { loadSavedConfigStateFromTokyo } from '../account-instances/service';
import { loadInstanceByAccountAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import {
  L10N_GENERATE_MAX_ATTEMPTS,
  L10N_GENERATE_STALE_REQUEUE_MS,
  canRetryL10nGenerate,
  isL10nGenerateStatus,
  loadAllL10nGenerateStateRows,
  loadL10nGenerateStateRow,
  resolveL10nFailureRetryState,
  toRetryExhaustedError,
  updateL10nGenerateStatus,
  upsertL10nGenerateStates,
} from './service';

async function dispatchL10nGenerateJobs(
  env: Env,
  jobs: L10nJob[],
): Promise<{ ok: true; transport: 'queue' } | { ok: false; error: string }> {
  if (env.L10N_GENERATE_QUEUE) {
    try {
      await env.L10N_GENERATE_QUEUE.sendBatch(jobs.map((job) => ({ body: job })));
      return { ok: true, transport: 'queue' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  return { ok: false, error: 'L10N_GENERATE_QUEUE missing' };
}

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
    accountId: report.accountId ?? existing?.account_id ?? null,
    baseUpdatedAt: report.baseUpdatedAt ?? existing?.base_updated_at ?? null,
    attempts,
    nextAttemptAt,
    lastAttemptAt,
    lastError,
    changedPaths: existing?.changed_paths ?? null,
    removedPaths: existing?.removed_paths ?? null,
  });
}

async function maybeConvergePublishedInstanceSurface(args: {
  env: Env;
  report: L10nGenerateReportPayload;
}): Promise<void> {
  const { env, report } = args;
  if (report.layer !== 'locale' || report.status !== 'succeeded') return;

  const accountId = asTrimmedString(report.accountId);
  if (!accountId) return;

  const account = await loadAccountById(env, accountId).catch(() => null);
  if (!account) return;

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, report.publicId).catch(() => null);
  if (!instance || instance.status !== 'published') return;

  const savedState = await loadSavedConfigStateFromTokyo({
    env,
    accountId,
    publicId: report.publicId,
  }).catch(() => null);
  if (!savedState) return;

  const widgetType =
    (await resolveWidgetTypeForInstance(env, instance, savedState.widgetType).catch(() => null)) ??
    savedState.widgetType;
  if (!widgetType) return;

  const allowlist = await loadWidgetLocalizationAllowlist(env, widgetType).catch(() => null);
  if (!allowlist) return;

  const baseTextPack = buildL10nSnapshot(savedState.config, allowlist);
  const baseFingerprint = await computeBaseFingerprint(baseTextPack);
  if (baseFingerprint !== report.baseFingerprint) return;

  const policy = resolvePolicy({ profile: account.tier, role: 'editor' });
  const convergenceError = await convergePublishedInstanceSurface({
    env,
    account,
    policy,
    publicId: report.publicId,
    widgetType,
    config: savedState.config,
    baseTextPack,
    writeTextPacks: true,
    writeConfigPack: false,
    syncLiveSurface: true,
    context: 'l10n generate report',
  });
  if (convergenceError) {
    console.error('[ParisWorker] published locale convergence failed after l10n success', {
      publicId: report.publicId,
      locale: report.layerKey,
      baseFingerprint: report.baseFingerprint,
      error: convergenceError,
    });
  }
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

  const accountIdRaw = reportRaw.accountId;
  const accountId = asTrimmedString(accountIdRaw);
  if (accountId && !isUuid(accountId)) {
    issues.push({ path: 'accountId', message: 'accountId must be a uuid' });
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
    accountId: accountId || null,
    baseUpdatedAt: baseUpdatedAt ?? null,
    error: error ?? null,
    occurredAt: occurredAt ?? null,
  };

  await applyL10nGenerateReport({ env, report });
  await maybeConvergePublishedInstanceSurface({ env, report });

  return json({ ok: true });
}

async function loadPendingL10nGenerateStates(
  env: Env,
  limit = 50,
): Promise<L10nGenerateStateRow[]> {
  const nowMs = Date.now();
  const staleBeforeMs = nowMs - L10N_GENERATE_STALE_REQUEUE_MS;
  const rows = await loadAllL10nGenerateStateRows(env);

  const shouldRequeue = (row: L10nGenerateStateRow): boolean => {
    const attempts = Math.max(0, Math.floor(row.attempts || 0));
    if (!canRetryL10nGenerate(attempts)) return false;
    if (row.layer !== 'locale') return false;
    if (row.status === 'dirty') return true;
    if (row.status === 'failed') {
      if (!row.next_attempt_at) return true;
      const nextAttemptMs = Date.parse(row.next_attempt_at);
      return Number.isFinite(nextAttemptMs) ? nextAttemptMs <= nowMs : true;
    }
    if (row.status !== 'queued' && row.status !== 'running') return false;
    if (!row.last_attempt_at) return true;
    const lastAttemptMs = Date.parse(row.last_attempt_at);
    return Number.isFinite(lastAttemptMs) ? lastAttemptMs <= staleBeforeMs : true;
  };

  const sortBySchedule = (a: L10nGenerateStateRow, b: L10nGenerateStateRow): number => {
    const aNext = a.next_attempt_at ? Date.parse(a.next_attempt_at) : Number.NEGATIVE_INFINITY;
    const bNext = b.next_attempt_at ? Date.parse(b.next_attempt_at) : Number.NEGATIVE_INFINITY;
    const aLast = a.last_attempt_at ? Date.parse(a.last_attempt_at) : Number.NEGATIVE_INFINITY;
    const bLast = b.last_attempt_at ? Date.parse(b.last_attempt_at) : Number.NEGATIVE_INFINITY;
    const nextCmp = aNext - bNext;
    if (nextCmp !== 0) return nextCmp;
    return aLast - bLast;
  };

  return rows.filter(shouldRequeue).sort(sortBySchedule).slice(0, Math.max(1, limit));
}

async function requeueL10nGenerateStates(
  env: Env,
  limit = 50,
): Promise<{ processed: number; queued: number; failed: number }> {
  const rows = await loadPendingL10nGenerateStates(env, limit);
  if (!rows.length) return { processed: 0, queued: 0, failed: 0 };

  const envStage = asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev';
  const nowIso = new Date().toISOString();

  const accountLocaleCache = new Map<string, { account: AccountRow; locales: Set<string> } | null>();
  const resolveAccountLocaleSnapshot = async (
    accountId: string,
  ): Promise<{ account: AccountRow; locales: Set<string> } | null> => {
    const cached = accountLocaleCache.get(accountId);
    if (cached !== undefined) return cached;

    let account: AccountRow | null = null;
    try {
      account = await loadAccountById(env, accountId);
    } catch {
      accountLocaleCache.set(accountId, null);
      return null;
    }
    if (!account) {
      accountLocaleCache.set(accountId, null);
      return null;
    }

    const normalized = normalizeLocaleList(account.l10n_locales, 'l10n_locales');
    if (!normalized.ok) {
      accountLocaleCache.set(accountId, null);
      return null;
    }

    const snapshot = { account, locales: new Set<string>(normalized.locales) };
    accountLocaleCache.set(accountId, snapshot);
    return snapshot;
  };

  const jobs: L10nJob[] = [];
  const queuedRows: L10nGenerateStateRow[] = [];
  const failedRows: L10nGenerateStateRow[] = [];
  const supersededRows: L10nGenerateStateRow[] = [];

  for (const row of rows) {
    const locale = row.layer_key;
    const widgetType = row.widget_type ?? null;
    const accountId = row.account_id ?? null;
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
    if (!locale || !widgetType || !accountId) {
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

    const localeSnapshot = await resolveAccountLocaleSnapshot(accountId);
    if (!localeSnapshot) {
      const retry = resolveL10nFailureRetryState({
        occurredAtIso: nowIso,
        attempts,
        message: 'account_locales_unavailable',
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

    if (!localeSnapshot.locales.has(locale)) {
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
      subject: 'account',
      accountId,
      account: localeSnapshot.account,
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
      accountId,
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

  const dispatched = await dispatchL10nGenerateJobs(env, jobs);
  if (!dispatched.ok) {
    const failedAt = new Date().toISOString();
    const queueFailures: L10nGenerateStateRow[] = queuedRows.map((row) => {
      const attempts = row.attempts ?? 1;
      const retry = resolveL10nFailureRetryState({
        occurredAtIso: failedAt,
        attempts,
        message: dispatched.error,
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

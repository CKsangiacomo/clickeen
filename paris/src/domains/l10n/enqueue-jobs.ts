import type { Policy } from '@clickeen/ck-policy';
import type {
  AccountRow,
  CuratedInstanceRow,
  Env,
  InstanceRow,
  L10nGenerateStateRow,
  L10nJob,
} from '../../shared/types';
import { errorDetail } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { asTrimmedString } from '../../shared/validation';
import { resolveInstanceAccountId, resolveInstanceKind } from '../../shared/instances';
import { issueAiGrant } from '../ai';
import {
  canRetryL10nGenerate,
  isL10nGenerateInFlightStale,
  loadLatestL10nSnapshot,
  loadL10nGenerateStates,
  resolveL10nFailureRetryState,
  supersedeL10nGenerateStates,
  upsertL10nGenerateStates,
  upsertL10nSnapshot,
} from './service';
import { enforceL10nSelection, readAccountLocales } from './shared';
import { resolveL10nPlanningSnapshot } from './planning';
import { dispatchL10nGenerateJobs } from './dispatch-jobs';

function normalizeSnapshotPayload(snapshot: unknown): Record<string, string> {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return {};
  const out: Record<string, string> = {};
  for (const [path, value] of Object.entries(snapshot as Record<string, unknown>)) {
    if (!path || typeof value !== 'string') continue;
    out[path] = value;
  }
  return out;
}

function diffL10nSnapshots(
  previousSnapshot: unknown,
  currentSnapshot: Record<string, string>,
): { changedPaths: string[]; removedPaths: string[] } {
  const previous = normalizeSnapshotPayload(previousSnapshot);
  const changedPaths: string[] = [];
  const removedPaths: string[] = [];

  for (const [path, value] of Object.entries(currentSnapshot)) {
    if (previous[path] !== value) changedPaths.push(path);
  }
  for (const path of Object.keys(previous)) {
    if (!Object.prototype.hasOwnProperty.call(currentSnapshot, path)) removedPaths.push(path);
  }

  changedPaths.sort();
  removedPaths.sort();
  return { changedPaths, removedPaths };
}

function toFailedStateRows(args: {
  publicId: string;
  layer: string;
  pendingLocales: string[];
  existingStates: Map<string, L10nGenerateStateRow>;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  widgetType: string;
  accountId: string;
  message: string;
  defaultChangedPaths?: string[] | null;
  defaultRemovedPaths?: string[] | null;
  occurredAtIso?: string;
}): L10nGenerateStateRow[] {
  const occurredAtIso = args.occurredAtIso || new Date().toISOString();
  return args.pendingLocales.map((locale) => {
    const current = args.existingStates.get(locale);
    const attempts = (current?.attempts ?? 0) + 1;
    const retry = resolveL10nFailureRetryState({
      occurredAtIso,
      attempts,
      message: args.message,
    });
    return {
      public_id: args.publicId,
      layer: args.layer,
      layer_key: locale,
      base_fingerprint: args.baseFingerprint,
      base_updated_at: args.baseUpdatedAt,
      widget_type: args.widgetType,
      account_id: args.accountId,
      status: 'failed',
      attempts,
      next_attempt_at: retry.nextAttemptAt,
      last_attempt_at: occurredAtIso,
      last_error: retry.lastError,
      changed_paths: current?.changed_paths ?? args.defaultChangedPaths ?? null,
      removed_paths: current?.removed_paths ?? args.defaultRemovedPaths ?? null,
    };
  });
}

export async function enqueueL10nJobs(args: {
  env: Env;
  instance: InstanceRow | CuratedInstanceRow;
  account: AccountRow;
  widgetType: string | null;
  config?: Record<string, unknown>;
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
  const accountLocales = readAccountLocales(args.account);
  if (accountLocales instanceof Response) {
    return {
      ok: false as const,
      queued: 0,
      skipped: 0,
      error: 'coreui.errors.account.locales.invalid',
    };
  }
  const locales = args.localesOverride ?? accountLocales.locales;
  const entitlementGate = enforceL10nSelection(args.policy, locales);
  if (entitlementGate) {
    return { ok: true as const, queued: 0, skipped: locales.length };
  }

  if (locales.length === 0) return { ok: true as const, queued: 0, skipped: 0 };

  const accountId = resolveInstanceAccountId(args.instance) ?? args.account.id;
  const planning = await resolveL10nPlanningSnapshot({
    env: args.env,
    widgetType: args.widgetType,
    config: args.config ?? args.instance.config,
    baseUpdatedAt: args.baseUpdatedAt ?? null,
  });
  if (!planning.ok) {
    return { ok: false as const, queued: 0, skipped: 0, error: planning.error };
  }
  const { widgetType, baseFingerprint, snapshot: l10nSnapshot } = planning.plan;
  const baseUpdatedAt = planning.plan.baseUpdatedAt ?? args.baseUpdatedAt ?? null;
  const previousSnapshot = await loadLatestL10nSnapshot(args.env, args.instance.public_id);
  const fingerprintChanged = previousSnapshot?.base_fingerprint !== baseFingerprint;
  const snapshotDiff = fingerprintChanged
    ? diffL10nSnapshots(previousSnapshot?.snapshot ?? null, l10nSnapshot)
    : null;
  const defaultChangedPaths = snapshotDiff?.changedPaths ?? null;
  const defaultRemovedPaths = snapshotDiff?.removedPaths ?? null;

  const envStage = asTrimmedString(args.env.ENV_STAGE) ?? 'cloud-dev';
  const layer = 'locale';
  const publicId = args.instance.public_id;

  if (fingerprintChanged) {
    try {
      await upsertL10nSnapshot(args.env, {
        public_id: publicId,
        base_fingerprint: baseFingerprint,
        snapshot: l10nSnapshot,
        widget_type: widgetType,
        base_updated_at: baseUpdatedAt ?? null,
      });
    } catch (error) {
      const detail = errorDetail(error);
      return { ok: false as const, queued: 0, skipped: 0, error: detail };
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

  const existingStates = await loadL10nGenerateStates(args.env, publicId, layer, baseFingerprint);
  const pendingLocales: string[] = [];
  const dirtyRows: L10nGenerateStateRow[] = [];
  const pendingLocaleDiffs = new Map<string, { changedPaths: string[] | null; removedPaths: string[] | null }>();
  const nowMs = Date.now();
  const allowRetryScheduleOverride = Boolean(args.allowNoDiff);

  locales.forEach((locale) => {
    const current = existingStates.get(locale);
    if (current?.status === 'succeeded') return;
    if (current?.status === 'failed') {
      const attempts = Math.max(0, Math.floor(current.attempts ?? 0));
      if (!canRetryL10nGenerate(attempts) && !allowRetryScheduleOverride) return;
      const nextAttemptMs = current.next_attempt_at ? Date.parse(current.next_attempt_at) : NaN;
      const retryReady = !Number.isFinite(nextAttemptMs) || nextAttemptMs <= nowMs;
      if (!retryReady && !allowRetryScheduleOverride) return;
    }
    if (current && (current.status === 'queued' || current.status === 'running')) {
      const staleAttempt = isL10nGenerateInFlightStale(current.last_attempt_at, nowMs);
      if (!staleAttempt) return;
    }
    const changedPaths = current?.changed_paths ?? defaultChangedPaths;
    const removedPaths = current?.removed_paths ?? defaultRemovedPaths;
    pendingLocaleDiffs.set(locale, { changedPaths, removedPaths });
    pendingLocales.push(locale);
    dirtyRows.push({
      public_id: publicId,
      layer,
      layer_key: locale,
      base_fingerprint: baseFingerprint,
      base_updated_at: baseUpdatedAt,
      widget_type: widgetType,
      account_id: accountId,
      status: 'dirty',
      attempts: current?.attempts ?? 0,
      next_attempt_at: null,
      last_attempt_at: current?.last_attempt_at ?? null,
      last_error: null,
      changed_paths: changedPaths,
      removed_paths: removedPaths,
    });
  });

  if (!pendingLocales.length) return { ok: true as const, queued: 0, skipped: locales.length };

  await upsertL10nGenerateStates(args.env, dirtyRows);

  if (!accountId) {
    return {
      ok: false as const,
      queued: 0,
      skipped: 0,
      error: 'Missing accountId for l10n grant',
    };
  }
  const jobs: L10nJob[] = [];
  for (const locale of pendingLocales) {
    const localeDiff = pendingLocaleDiffs.get(locale) ?? {
      changedPaths: defaultChangedPaths,
      removedPaths: defaultRemovedPaths,
    };
    const issued = await issueAiGrant({
      env: args.env,
      agentId: 'l10n.instance.v1',
      subject: 'account',
      accountId,
      account: args.account,
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
      widgetType,
      locale,
      baseFingerprint,
      baseUpdatedAt,
      kind,
      accountId,
      envStage,
      changedPaths: localeDiff.changedPaths ?? undefined,
      removedPaths: localeDiff.removedPaths ?? undefined,
    });
  }

  const dispatched = await dispatchL10nGenerateJobs(args.env, jobs);
  if (!dispatched.ok) {
    const failedRows = toFailedStateRows({
      publicId,
      layer,
      pendingLocales,
      existingStates,
      baseFingerprint,
      baseUpdatedAt,
      widgetType,
      accountId,
      message: dispatched.error,
      defaultChangedPaths,
      defaultRemovedPaths,
    });
    await upsertL10nGenerateStates(args.env, failedRows);
    return {
      ok: false as const,
      queued: 0,
      skipped: locales.length - pendingLocales.length,
      error: dispatched.error,
    };
  }

  const queuedAt = new Date().toISOString();
  const queuedRows: L10nGenerateStateRow[] = pendingLocales.map((locale) => {
    const current = existingStates.get(locale);
    const attempts = (current?.attempts ?? 0) + 1;
    const diff = pendingLocaleDiffs.get(locale) ?? {
      changedPaths: current?.changed_paths ?? defaultChangedPaths,
      removedPaths: current?.removed_paths ?? defaultRemovedPaths,
    };
    return {
      public_id: publicId,
      layer,
      layer_key: locale,
      base_fingerprint: baseFingerprint,
      base_updated_at: baseUpdatedAt,
      widget_type: widgetType,
      account_id: accountId,
      status: 'queued',
      attempts,
      next_attempt_at: null,
      last_attempt_at: queuedAt,
      last_error: null,
      changed_paths: diff.changedPaths,
      removed_paths: diff.removedPaths,
    };
  });
  await upsertL10nGenerateStates(args.env, queuedRows);

  return {
    ok: true as const,
    queued: pendingLocales.length,
    skipped: locales.length - pendingLocales.length,
  };
}

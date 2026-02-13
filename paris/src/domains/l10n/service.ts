import type {
  Env,
  InstanceOverlayRow,
  L10nBaseSnapshotRow,
  L10nGenerateStateRow,
  L10nGenerateStatus,
  L10nPublishQueueJob,
} from '../../shared/types';
import { readJson } from '../../shared/http';
import { apiError } from '../../shared/errors';
import { asTrimmedString } from '../../shared/validation';
import { hasProhibitedSegment, normalizeOpPath, pathMatchesAllowlist } from '../../shared/l10n';
import { supabaseFetch } from '../../shared/supabase';

function resolveLocalTokyoWorkerBase(env: Env): string | null {
  const stage = asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev';
  if (stage !== 'local') return null;
  const base = asTrimmedString(env.TOKYO_WORKER_BASE_URL);
  if (!base) return null;
  return base.replace(/\/+$/, '');
}

async function publishLayerLocal(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
  action: 'upsert' | 'delete',
): Promise<Response | null> {
  const base = resolveLocalTokyoWorkerBase(env);
  if (!base) return null;
  const token = asTrimmedString(env.TOKYO_DEV_JWT) ?? asTrimmedString(env.PARIS_DEV_JWT);
  const headers: HeadersInit = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;

  const res = await fetch(`${base}/l10n/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ v: 2, publicId, layer, layerKey, action }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return apiError('INTERNAL_ERROR', 'Local l10n publish failed', 500, detail);
  }
  return null;
}

async function loadInstanceOverlay(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
): Promise<InstanceOverlayRow | null> {
  const params = new URLSearchParams({
    select:
      'public_id,layer,layer_key,ops,user_ops,base_fingerprint,base_updated_at,source,geo_targets,workspace_id,updated_at',
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    layer_key: `eq.${layerKey}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load instance overlay (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as InstanceOverlayRow[];
  return rows?.[0] ?? null;
}

async function loadInstanceOverlays(env: Env, publicId: string): Promise<InstanceOverlayRow[]> {
  const params = new URLSearchParams({
    select:
      'public_id,layer,layer_key,ops,user_ops,base_fingerprint,base_updated_at,source,geo_targets,workspace_id,updated_at',
    public_id: `eq.${publicId}`,
    order: 'layer.asc,layer_key.asc',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load instance overlays (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  return ((await res.json()) as InstanceOverlayRow[]).filter(Boolean);
}

async function markL10nPublishDirty(args: {
  env: Env;
  publicId: string;
  layer: string;
  layerKey: string;
  baseFingerprint: string;
}): Promise<Response | null> {
  const { env, publicId, layer, layerKey, baseFingerprint } = args;
  const payload = {
    public_id: publicId,
    locale: layer === 'locale' ? layerKey : null,
    layer,
    layer_key: layerKey,
    base_fingerprint: baseFingerprint,
    publish_state: 'dirty',
    publish_attempts: 0,
    publish_next_at: null,
    last_error: null,
  };
  const res = await supabaseFetch(
    env,
    `/rest/v1/l10n_publish_state?on_conflict=public_id,layer,layer_key`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const detail = await readJson(res);
    return apiError('INTERNAL_ERROR', 'Failed to mark l10n publish state', 500, detail);
  }
  return null;
}

const L10N_GENERATE_STATUS: ReadonlySet<L10nGenerateStatus> = new Set([
  'dirty',
  'queued',
  'running',
  'succeeded',
  'failed',
  'superseded',
]);

const L10N_GENERATE_MAX_ATTEMPTS = 3;
const L10N_GENERATE_STALE_REQUEUE_MS = 10 * 60_000;

function isL10nGenerateStatus(value: unknown): value is L10nGenerateStatus {
  return typeof value === 'string' && L10N_GENERATE_STATUS.has(value as L10nGenerateStatus);
}

function computeL10nGenerateBackoffMs(attempts: number): number {
  const normalized = Math.max(1, Math.min(10, Math.floor(attempts || 1)));
  const minutes = Math.min(60, Math.pow(2, normalized));
  const jitterSeconds = Math.floor(Math.random() * 30);
  return (minutes * 60 + jitterSeconds) * 1000;
}

function isL10nGenerateInFlightStale(
  lastAttemptAt: string | null | undefined,
  nowMs: number,
): boolean {
  const lastAttemptMs = lastAttemptAt ? Date.parse(lastAttemptAt) : NaN;
  if (!Number.isFinite(lastAttemptMs)) return true;
  return nowMs - lastAttemptMs >= L10N_GENERATE_STALE_REQUEUE_MS;
}

function canRetryL10nGenerate(attempts: number): boolean {
  const normalized = Math.max(0, Math.floor(attempts || 0));
  return normalized < L10N_GENERATE_MAX_ATTEMPTS;
}

function toRetryExhaustedError(message: string): string {
  const trimmed = String(message || '').trim() || 'unknown_error';
  return trimmed.startsWith('retry_exhausted:') ? trimmed : `retry_exhausted:${trimmed}`;
}

function computeL10nGenerateNextAttemptAt(occurredAtIso: string, attempts: number): string | null {
  if (!canRetryL10nGenerate(attempts)) return null;
  const delayMs = computeL10nGenerateBackoffMs(Math.max(1, attempts));
  const parsed = Date.parse(occurredAtIso);
  const anchorMs = Number.isFinite(parsed) ? parsed : Date.now();
  return new Date(anchorMs + delayMs).toISOString();
}

function resolveL10nFailureRetryState(args: {
  occurredAtIso: string;
  attempts: number;
  message: string;
}) {
  const nextAttemptAt = computeL10nGenerateNextAttemptAt(args.occurredAtIso, args.attempts);
  if (nextAttemptAt) {
    return {
      nextAttemptAt,
      lastError: String(args.message || '').trim() || 'unknown_error',
    };
  }
  return {
    nextAttemptAt: null,
    lastError: toRetryExhaustedError(args.message),
  };
}

async function loadL10nGenerateStates(
  env: Env,
  publicId: string,
  layer: string,
  baseFingerprint: string,
) {
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
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    base_fingerprint: `eq.${baseFingerprint}`,
  });
  const res = await supabaseFetch(env, `/rest/v1/l10n_generate_state?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load l10n generate state (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as L10nGenerateStateRow[];
  const map = new Map<string, L10nGenerateStateRow>();
  rows.forEach((row) => {
    if (row?.layer_key) map.set(row.layer_key, row);
  });
  return map;
}

async function loadL10nGenerateStateRow(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
  baseFingerprint: string,
): Promise<L10nGenerateStateRow | null> {
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
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    layer_key: `eq.${layerKey}`,
    base_fingerprint: `eq.${baseFingerprint}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/l10n_generate_state?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load l10n generate state row (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as L10nGenerateStateRow[];
  return rows?.[0] ?? null;
}

async function upsertL10nGenerateStates(env: Env, rows: L10nGenerateStateRow[]) {
  if (!rows.length) return;
  const res = await supabaseFetch(
    env,
    `/rest/v1/l10n_generate_state?on_conflict=public_id,layer,layer_key,base_fingerprint`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to upsert l10n generate state (${res.status}): ${JSON.stringify(details)}`,
    );
  }
}

async function supersedeL10nGenerateStates(args: {
  env: Env;
  publicId: string;
  layer: string;
  layerKeys: string[];
  baseFingerprint: string;
}) {
  const { env, publicId, layer, layerKeys, baseFingerprint } = args;
  if (!layerKeys.length) return;
  const params = new URLSearchParams({
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    base_fingerprint: `neq.${baseFingerprint}`,
    layer_key: `in.(${layerKeys.map((key) => key.replace(/,/g, '')).join(',')})`,
  });
  const res = await supabaseFetch(env, `/rest/v1/l10n_generate_state?${params.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'superseded',
      next_attempt_at: null,
      last_error: 'superseded_by_new_base',
    }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to supersede l10n generate state (${res.status}): ${JSON.stringify(details)}`,
    );
  }
}

async function loadLatestL10nSnapshot(
  env: Env,
  publicId: string,
): Promise<L10nBaseSnapshotRow | null> {
  const params = new URLSearchParams({
    select: [
      'public_id',
      'base_fingerprint',
      'snapshot',
      'widget_type',
      'base_updated_at',
      'created_at',
    ].join(','),
    public_id: `eq.${publicId}`,
    order: 'created_at.desc',
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/l10n_base_snapshots?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load l10n base snapshot (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as L10nBaseSnapshotRow[];
  return rows?.[0] ?? null;
}

async function upsertL10nSnapshot(env: Env, row: L10nBaseSnapshotRow): Promise<void> {
  const res = await supabaseFetch(
    env,
    `/rest/v1/l10n_base_snapshots?on_conflict=public_id,base_fingerprint`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(row),
    },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to upsert l10n base snapshot (${res.status}): ${JSON.stringify(details)}`,
    );
  }
}

function diffL10nSnapshots(prev: Record<string, string> | null, next: Record<string, string>) {
  const changed: string[] = [];
  const removed: string[] = [];

  if (!prev) {
    changed.push(...Object.keys(next));
  } else {
    Object.entries(next).forEach(([path, value]) => {
      if (prev[path] !== value) {
        changed.push(path);
      }
    });

    Object.keys(prev).forEach((path) => {
      if (!(path in next)) {
        removed.push(path);
      }
    });
  }

  changed.sort();
  removed.sort();
  return { changedPaths: changed, removedPaths: removed };
}

function filterOpsForSnapshot(
  ops: Array<{ op: 'set'; path: string; value: unknown }> | null | undefined,
  allowlist: string[],
  snapshotKeys: Set<string>,
): Array<{ op: 'set'; path: string; value: unknown }> {
  if (!Array.isArray(ops)) return [];
  const filtered: Array<{ op: 'set'; path: string; value: unknown }> = [];
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    const rawPath = typeof op.path === 'string' ? op.path : '';
    const path = normalizeOpPath(rawPath);
    if (!path || hasProhibitedSegment(path)) continue;
    if (!allowlist.some((allow) => pathMatchesAllowlist(path, allow))) continue;
    if (!snapshotKeys.has(path)) continue;
    if (op.value === undefined) continue;
    filtered.push({ op: 'set', path, value: op.value });
  }
  return filtered;
}

async function rebaseUserOverlays(args: {
  env: Env;
  publicId: string;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  allowlistPaths: string[];
  snapshot: Record<string, string>;
}): Promise<void> {
  const snapshotKeys = new Set(Object.keys(args.snapshot));
  const overlays = await loadInstanceOverlays(args.env, args.publicId);
  const userOverlays = overlays.filter((row) => row.layer === 'user');
  if (!userOverlays.length) return;

  for (const row of userOverlays) {
    const filteredOps = filterOpsForSnapshot(row.ops ?? [], args.allowlistPaths, snapshotKeys);
    const filteredUserOps = filterOpsForSnapshot(
      row.user_ops ?? [],
      args.allowlistPaths,
      snapshotKeys,
    );

    const patchRes = await supabaseFetch(
      args.env,
      `/rest/v1/widget_instance_overlays?public_id=eq.${encodeURIComponent(
        args.publicId,
      )}&layer=eq.user&layer_key=eq.${encodeURIComponent(row.layer_key)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          ops: filteredOps,
          user_ops: filteredUserOps,
          base_fingerprint: args.baseFingerprint,
          base_updated_at: args.baseUpdatedAt ?? null,
        }),
      },
    );
    if (!patchRes.ok) {
      const details = await readJson(patchRes);
      throw new Error(
        `[ParisWorker] Failed to rebase user overlay (${patchRes.status}): ${JSON.stringify(details)}`,
      );
    }

    if (!args.env.L10N_PUBLISH_QUEUE) {
      console.error('[ParisWorker] L10N_PUBLISH_QUEUE missing while rebasing user overlays');
      continue;
    }
    const markDirty = await markL10nPublishDirty({
      env: args.env,
      publicId: args.publicId,
      layer: 'user',
      layerKey: row.layer_key,
      baseFingerprint: args.baseFingerprint,
    });
    if (markDirty) {
      console.error('[ParisWorker] Failed to mark user overlay dirty during rebase', markDirty);
      continue;
    }
    try {
      await args.env.L10N_PUBLISH_QUEUE.send({
        v: 2,
        publicId: args.publicId,
        layer: 'user',
        layerKey: row.layer_key,
        action: 'upsert',
      } satisfies L10nPublishQueueJob);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[ParisWorker] Failed to enqueue user overlay publish during rebase', detail);
      continue;
    }
    const localPublish = await publishLayerLocal(
      args.env,
      args.publicId,
      'user',
      row.layer_key,
      'upsert',
    );
    if (localPublish) {
      console.error(
        '[ParisWorker] Failed to locally publish user overlay during rebase',
        localPublish,
      );
    }
  }
}

async function updateL10nGenerateStatus(args: {
  env: Env;
  publicId: string;
  layer: string;
  layerKey: string;
  baseFingerprint: string;
  status: L10nGenerateStatus;
  widgetType?: string | null;
  workspaceId?: string | null;
  baseUpdatedAt?: string | null;
  lastError?: string | null;
  attempts?: number;
  nextAttemptAt?: string | null;
  lastAttemptAt?: string | null;
  changedPaths?: string[] | null;
  removedPaths?: string[] | null;
}) {
  const {
    env,
    publicId,
    layer,
    layerKey,
    baseFingerprint,
    status,
    widgetType,
    workspaceId,
    baseUpdatedAt,
    lastError,
    attempts = 0,
    nextAttemptAt,
    lastAttemptAt,
    changedPaths,
    removedPaths,
  } = args;
  const rows: L10nGenerateStateRow[] = [
    {
      public_id: publicId,
      layer,
      layer_key: layerKey,
      base_fingerprint: baseFingerprint,
      base_updated_at: baseUpdatedAt ?? null,
      widget_type: widgetType ?? null,
      workspace_id: workspaceId ?? null,
      status,
      attempts,
      next_attempt_at: nextAttemptAt ?? null,
      last_attempt_at: lastAttemptAt ?? null,
      last_error: lastError ?? null,
      changed_paths: changedPaths ?? null,
      removed_paths: removedPaths ?? null,
    },
  ];
  await upsertL10nGenerateStates(env, rows);
}

export {
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
};

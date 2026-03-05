import type {
  Env,
  InstanceOverlayRow,
  L10nBaseSnapshotRow,
  L10nGenerateStateRow,
  L10nGenerateStatus,
} from '../../shared/types';

const OVERLAY_PREFIX = 'overlays';
const L10N_STATE_PREFIX = 'l10n-gen:v1:row';
const L10N_SNAPSHOT_PREFIX = 'l10n/snapshots';

function requireOverlaysBucket(env: Env): R2Bucket {
  if (!env.OVERLAYS_R2) throw new Error('[ParisWorker] Missing OVERLAYS_R2 binding');
  return env.OVERLAYS_R2;
}

function requireL10nStateKv(env: Env): KVNamespace {
  if (!env.L10N_STATE_KV) throw new Error('[ParisWorker] Missing L10N_STATE_KV binding');
  return env.L10N_STATE_KV;
}

function normalizeKeySegment(value: string): string {
  return encodeURIComponent(String(value || '').trim());
}

function denormalizeKeySegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function overlayObjectKey(publicId: string, layer: string, layerKey: string): string {
  return [OVERLAY_PREFIX, normalizeKeySegment(publicId), normalizeKeySegment(layer), `${normalizeKeySegment(layerKey)}.json`].join('/');
}

function parseOverlayObjectKey(key: string): { publicId: string; layer: string; layerKey: string } | null {
  const parts = String(key || '').split('/');
  if (parts.length !== 4) return null;
  if (parts[0] !== OVERLAY_PREFIX) return null;
  if (!parts[3].endsWith('.json')) return null;
  return {
    publicId: denormalizeKeySegment(parts[1]),
    layer: denormalizeKeySegment(parts[2]),
    layerKey: denormalizeKeySegment(parts[3].slice(0, -5)),
  };
}

function l10nStateKey(publicId: string, layer: string, layerKey: string, baseFingerprint: string): string {
  return [
    L10N_STATE_PREFIX,
    normalizeKeySegment(publicId),
    normalizeKeySegment(layer),
    normalizeKeySegment(layerKey),
    normalizeKeySegment(baseFingerprint),
  ].join(':');
}

function l10nStatePrefixForPublicLayer(publicId: string, layer: string): string {
  return [L10N_STATE_PREFIX, normalizeKeySegment(publicId), normalizeKeySegment(layer)].join(':') + ':';
}

function l10nSnapshotKey(publicId: string, baseFingerprint: string): string {
  return `${L10N_SNAPSHOT_PREFIX}/${normalizeKeySegment(publicId)}/${normalizeKeySegment(baseFingerprint)}.json`;
}

function l10nSnapshotLatestKey(publicId: string): string {
  return `${L10N_SNAPSHOT_PREFIX}/${normalizeKeySegment(publicId)}/latest.json`;
}

async function readR2Json<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const payload = await obj.json().catch(() => null);
  return (payload as T | null) ?? null;
}

function normalizeOverlayRow(raw: unknown, fallback: { publicId: string; layer: string; layerKey: string }): InstanceOverlayRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const public_id = typeof row.public_id === 'string' && row.public_id.trim() ? row.public_id.trim() : fallback.publicId;
  const layer = typeof row.layer === 'string' && row.layer.trim() ? row.layer.trim() : fallback.layer;
  const layer_key = typeof row.layer_key === 'string' && row.layer_key.trim() ? row.layer_key.trim() : fallback.layerKey;
  if (!public_id || !layer || !layer_key) return null;

  const ops = Array.isArray(row.ops) ? (row.ops as Array<{ op: 'set'; path: string; value: unknown }>) : [];
  const user_ops = Array.isArray(row.user_ops)
    ? (row.user_ops as Array<{ op: 'set'; path: string; value: unknown }>)
    : [];

  return {
    public_id,
    layer,
    layer_key,
    ops,
    user_ops,
    base_fingerprint: typeof row.base_fingerprint === 'string' && row.base_fingerprint.trim() ? row.base_fingerprint.trim() : null,
    base_updated_at: typeof row.base_updated_at === 'string' && row.base_updated_at.trim() ? row.base_updated_at.trim() : null,
    source: typeof row.source === 'string' && row.source.trim() ? row.source.trim() : 'user',
    geo_targets: Array.isArray(row.geo_targets)
      ? row.geo_targets
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry): entry is string => Boolean(entry))
      : null,
    account_id: typeof row.account_id === 'string' && row.account_id.trim() ? row.account_id.trim() : null,
    updated_at: typeof row.updated_at === 'string' && row.updated_at.trim() ? row.updated_at.trim() : null,
  };
}

function normalizeGenerateStateRow(raw: unknown): L10nGenerateStateRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const public_id = typeof row.public_id === 'string' ? row.public_id.trim() : '';
  const layer = typeof row.layer === 'string' ? row.layer.trim() : '';
  const layer_key = typeof row.layer_key === 'string' ? row.layer_key.trim() : '';
  const base_fingerprint = typeof row.base_fingerprint === 'string' ? row.base_fingerprint.trim() : '';
  const status = isL10nGenerateStatus(row.status) ? row.status : null;
  if (!public_id || !layer || !layer_key || !base_fingerprint || !status) return null;

  const attemptsRaw = typeof row.attempts === 'number' ? row.attempts : Number(row.attempts);
  const attempts = Number.isFinite(attemptsRaw) && attemptsRaw >= 0 ? Math.floor(attemptsRaw) : 0;

  const asNullableString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const asNullableStringArray = (value: unknown): string[] | null =>
    Array.isArray(value)
      ? value.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter((entry): entry is string => Boolean(entry))
      : null;

  return {
    public_id,
    layer,
    layer_key,
    base_fingerprint,
    base_updated_at: asNullableString(row.base_updated_at),
    widget_type: asNullableString(row.widget_type),
    account_id: asNullableString(row.account_id),
    status,
    attempts,
    next_attempt_at: asNullableString(row.next_attempt_at),
    last_attempt_at: asNullableString(row.last_attempt_at),
    last_error: asNullableString(row.last_error),
    changed_paths: asNullableStringArray(row.changed_paths),
    removed_paths: asNullableStringArray(row.removed_paths),
  };
}

async function listR2KeysByPrefix(bucket: R2Bucket, prefix: string): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor, limit: 1000 });
    listed.objects.forEach((obj: { key?: string }) => {
      const key = typeof obj.key === 'string' ? obj.key.trim() : '';
      if (key) out.push(key);
    });
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return out;
}

async function loadInstanceOverlay(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
): Promise<InstanceOverlayRow | null> {
  const bucket = requireOverlaysBucket(env);
  const key = overlayObjectKey(publicId, layer, layerKey);
  const raw = await readR2Json<unknown>(bucket, key);
  if (!raw) return null;
  return normalizeOverlayRow(raw, { publicId, layer, layerKey });
}

async function loadInstanceOverlays(env: Env, publicId: string): Promise<InstanceOverlayRow[]> {
  const bucket = requireOverlaysBucket(env);
  const prefix = `${OVERLAY_PREFIX}/${normalizeKeySegment(publicId)}/`;
  const keys = await listR2KeysByPrefix(bucket, prefix);
  if (!keys.length) return [];

  const rows = await Promise.all(
    keys.map(async (key) => {
      const parsed = parseOverlayObjectKey(key);
      if (!parsed || parsed.publicId !== publicId) return null;
      const raw = await readR2Json<unknown>(bucket, key);
      return normalizeOverlayRow(raw, parsed);
    }),
  );

  return rows
    .filter((row): row is InstanceOverlayRow => Boolean(row))
    .sort((a, b) => {
      const layerCmp = a.layer.localeCompare(b.layer);
      if (layerCmp !== 0) return layerCmp;
      return a.layer_key.localeCompare(b.layer_key);
    });
}

async function upsertInstanceOverlay(env: Env, row: InstanceOverlayRow): Promise<InstanceOverlayRow> {
  const bucket = requireOverlaysBucket(env);
  const nowIso = new Date().toISOString();
  const normalized: InstanceOverlayRow = {
    public_id: row.public_id,
    layer: row.layer,
    layer_key: row.layer_key,
    ops: Array.isArray(row.ops) ? row.ops : [],
    user_ops: Array.isArray(row.user_ops) ? row.user_ops : [],
    base_fingerprint: row.base_fingerprint ?? null,
    base_updated_at: row.base_updated_at ?? null,
    source: row.source ?? 'user',
    geo_targets: Array.isArray(row.geo_targets) ? row.geo_targets : null,
    account_id: row.account_id ?? null,
    updated_at: nowIso,
  };
  const key = overlayObjectKey(normalized.public_id, normalized.layer, normalized.layer_key);
  await bucket.put(key, JSON.stringify(normalized), {
    httpMetadata: { contentType: 'application/json' },
  });
  return normalized;
}

async function deleteInstanceOverlay(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
): Promise<void> {
  const bucket = requireOverlaysBucket(env);
  await bucket.delete(overlayObjectKey(publicId, layer, layerKey));
}

async function upsertL10nGenerateStates(env: Env, rows: L10nGenerateStateRow[]) {
  if (!rows.length) return;
  const kv = requireL10nStateKv(env);
  await Promise.all(
    rows.map(async (row) => {
      const normalized = normalizeGenerateStateRow(row);
      if (!normalized) return;
      const key = l10nStateKey(normalized.public_id, normalized.layer, normalized.layer_key, normalized.base_fingerprint);
      await kv.put(key, JSON.stringify(normalized));
    }),
  );
}

async function loadL10nGenerateStates(
  env: Env,
  publicId: string,
  layer: string,
  baseFingerprint: string,
): Promise<Map<string, L10nGenerateStateRow>> {
  const kv = requireL10nStateKv(env);
  const prefix = l10nStatePrefixForPublicLayer(publicId, layer);
  const listed = await kv.list({ prefix, limit: 1000 });
  const entries = await Promise.all(
    listed.keys.map(async (entry: { name: string }) => {
      const raw = await kv.get(entry.name);
      if (!raw) return null;
      const parsed = normalizeGenerateStateRow(JSON.parse(raw) as unknown);
      if (!parsed) return null;
      if (parsed.base_fingerprint !== baseFingerprint) return null;
      return parsed;
    }),
  );
  const map = new Map<string, L10nGenerateStateRow>();
  entries.forEach((row: L10nGenerateStateRow | null) => {
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
  const kv = requireL10nStateKv(env);
  const key = l10nStateKey(publicId, layer, layerKey, baseFingerprint);
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return normalizeGenerateStateRow(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function loadAllL10nGenerateStateRows(env: Env): Promise<L10nGenerateStateRow[]> {
  const kv = requireL10nStateKv(env);
  const rows: L10nGenerateStateRow[] = [];
  let cursor: string | undefined;

  do {
    const listed = await kv.list({ prefix: `${L10N_STATE_PREFIX}:`, cursor, limit: 1000 });
    const batch = await Promise.all(
      listed.keys.map(async (entry: { name: string }) => {
        const raw = await kv.get(entry.name);
        if (!raw) return null;
        try {
          return normalizeGenerateStateRow(JSON.parse(raw) as unknown);
        } catch {
          return null;
        }
      }),
    );
    batch.forEach((row: L10nGenerateStateRow | null) => {
      if (row) rows.push(row);
    });
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  return rows;
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
  const existing = await loadL10nGenerateStates(env, publicId, layer, baseFingerprint);
  const keySet = new Set(layerKeys);

  const kv = requireL10nStateKv(env);
  const prefix = l10nStatePrefixForPublicLayer(publicId, layer);
  let cursor: string | undefined;

  do {
    const listed = await kv.list({ prefix, cursor, limit: 1000 });
    const updates: L10nGenerateStateRow[] = [];

    await Promise.all(
      listed.keys.map(async (entry: { name: string }) => {
        const raw = await kv.get(entry.name);
        if (!raw) return;
        let parsed: L10nGenerateStateRow | null = null;
        try {
          parsed = normalizeGenerateStateRow(JSON.parse(raw) as unknown);
        } catch {
          parsed = null;
        }
        if (!parsed) return;
        if (!keySet.has(parsed.layer_key)) return;
        if (parsed.base_fingerprint === baseFingerprint) return;
        if (existing.get(parsed.layer_key)?.base_fingerprint === parsed.base_fingerprint) return;

        updates.push({
          ...parsed,
          status: 'superseded',
          next_attempt_at: null,
          last_error: 'superseded_by_new_base',
        });
      }),
    );

    if (updates.length) {
      await upsertL10nGenerateStates(env, updates);
    }

    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
}

async function loadLatestL10nSnapshot(
  env: Env,
  publicId: string,
): Promise<L10nBaseSnapshotRow | null> {
  const bucket = requireOverlaysBucket(env);
  const latest = await readR2Json<{ baseFingerprint?: unknown }>(bucket, l10nSnapshotLatestKey(publicId));
  const fingerprint = typeof latest?.baseFingerprint === 'string' && latest.baseFingerprint.trim()
    ? latest.baseFingerprint.trim()
    : null;

  if (fingerprint) {
    const row = await readR2Json<L10nBaseSnapshotRow>(bucket, l10nSnapshotKey(publicId, fingerprint));
    if (row?.public_id && row.base_fingerprint) return row;
  }

  const prefix = `${L10N_SNAPSHOT_PREFIX}/${normalizeKeySegment(publicId)}/`;
  const keys = await listR2KeysByPrefix(bucket, prefix);
  const snapshotKeys = keys.filter((key) => key.endsWith('.json') && !key.endsWith('/latest.json'));
  if (!snapshotKeys.length) return null;

  const rows = await Promise.all(snapshotKeys.map((key) => readR2Json<L10nBaseSnapshotRow>(bucket, key)));
  const validRows = rows
    .filter((row): row is L10nBaseSnapshotRow => Boolean(row?.public_id && row?.base_fingerprint));
  if (!validRows.length) return null;

  validRows.sort((a, b) => {
    const aTs = Date.parse(String(a.created_at || ''));
    const bTs = Date.parse(String(b.created_at || ''));
    if (Number.isFinite(aTs) && Number.isFinite(bTs)) return bTs - aTs;
    return String(b.base_fingerprint).localeCompare(String(a.base_fingerprint));
  });

  return validRows[0] ?? null;
}

async function upsertL10nSnapshot(env: Env, row: L10nBaseSnapshotRow): Promise<void> {
  const bucket = requireOverlaysBucket(env);
  const createdAt = row.created_at ?? new Date().toISOString();
  const payload: L10nBaseSnapshotRow = {
    ...row,
    created_at: createdAt,
  };

  await bucket.put(l10nSnapshotKey(row.public_id, row.base_fingerprint), JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json' },
  });

  await bucket.put(
    l10nSnapshotLatestKey(row.public_id),
    JSON.stringify({
      baseFingerprint: row.base_fingerprint,
      updatedAt: new Date().toISOString(),
    }),
    { httpMetadata: { contentType: 'application/json' } },
  );
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

async function updateL10nGenerateStatus(args: {
  env: Env;
  publicId: string;
  layer: string;
  layerKey: string;
  baseFingerprint: string;
  status: L10nGenerateStatus;
  widgetType?: string | null;
  accountId?: string | null;
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
    accountId,
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
      account_id: accountId ?? null,
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
  deleteInstanceOverlay,
  isL10nGenerateInFlightStale,
  isL10nGenerateStatus,
  loadAllL10nGenerateStateRows,
  loadInstanceOverlay,
  loadInstanceOverlays,
  loadLatestL10nSnapshot,
  loadL10nGenerateStateRow,
  loadL10nGenerateStates,
  resolveL10nFailureRetryState,
  supersedeL10nGenerateStates,
  toRetryExhaustedError,
  updateL10nGenerateStatus,
  upsertInstanceOverlay,
  upsertL10nGenerateStates,
  upsertL10nSnapshot,
};

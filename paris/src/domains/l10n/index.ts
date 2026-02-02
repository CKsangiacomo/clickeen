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
  SUPPORTED_LOCALES,
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
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { requireWorkspace } from '../../shared/workspaces';
import { loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { issueAiGrant } from '../ai';

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
  action: 'upsert' | 'delete'
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

async function loadInstanceOverlay(env: Env, publicId: string, layer: string, layerKey: string): Promise<InstanceOverlayRow | null> {
  const params = new URLSearchParams({
    select: 'public_id,layer,layer_key,ops,user_ops,base_fingerprint,base_updated_at,source,geo_targets,workspace_id,updated_at',
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    layer_key: `eq.${layerKey}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load instance overlay (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as InstanceOverlayRow[];
  return rows?.[0] ?? null;
}

async function loadInstanceOverlays(env: Env, publicId: string): Promise<InstanceOverlayRow[]> {
  const params = new URLSearchParams({
    select: 'public_id,layer,layer_key,ops,user_ops,base_fingerprint,base_updated_at,source,geo_targets,workspace_id,updated_at',
    public_id: `eq.${publicId}`,
    order: 'layer.asc,layer_key.asc',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load instance overlays (${res.status}): ${JSON.stringify(details)}`);
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
  const res = await supabaseFetch(env, `/rest/v1/l10n_publish_state?on_conflict=public_id,layer,layer_key`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(payload),
  });
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

function isL10nGenerateStatus(value: unknown): value is L10nGenerateStatus {
  return typeof value === 'string' && L10N_GENERATE_STATUS.has(value as L10nGenerateStatus);
}

function computeL10nGenerateBackoffMs(attempts: number): number {
  const normalized = Math.max(1, Math.min(10, Math.floor(attempts || 1)));
  const minutes = Math.min(60, Math.pow(2, normalized));
  const jitterSeconds = Math.floor(Math.random() * 30);
  return (minutes * 60 + jitterSeconds) * 1000;
}

async function loadL10nGenerateStates(env: Env, publicId: string, layer: string, baseFingerprint: string) {
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
  const res = await supabaseFetch(env, `/rest/v1/l10n_generate_state?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load l10n generate state (${res.status}): ${JSON.stringify(details)}`);
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
  baseFingerprint: string
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
  const res = await supabaseFetch(env, `/rest/v1/l10n_generate_state?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load l10n generate state row (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as L10nGenerateStateRow[];
  return rows?.[0] ?? null;
}

async function upsertL10nGenerateStates(env: Env, rows: L10nGenerateStateRow[]) {
  if (!rows.length) return;
  const res = await supabaseFetch(env, `/rest/v1/l10n_generate_state?on_conflict=public_id,layer,layer_key,base_fingerprint`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to upsert l10n generate state (${res.status}): ${JSON.stringify(details)}`);
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
    throw new Error(`[ParisWorker] Failed to supersede l10n generate state (${res.status}): ${JSON.stringify(details)}`);
  }
}

async function loadLatestL10nSnapshot(env: Env, publicId: string): Promise<L10nBaseSnapshotRow | null> {
  const params = new URLSearchParams({
    select: ['public_id', 'base_fingerprint', 'snapshot', 'widget_type', 'base_updated_at', 'created_at'].join(','),
    public_id: `eq.${publicId}`,
    order: 'created_at.desc',
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/l10n_base_snapshots?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load l10n base snapshot (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as L10nBaseSnapshotRow[];
  return rows?.[0] ?? null;
}

async function upsertL10nSnapshot(env: Env, row: L10nBaseSnapshotRow): Promise<void> {
  const res = await supabaseFetch(env, `/rest/v1/l10n_base_snapshots?on_conflict=public_id,base_fingerprint`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to upsert l10n base snapshot (${res.status}): ${JSON.stringify(details)}`);
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
    const filteredUserOps = filterOpsForSnapshot(row.user_ops ?? [], args.allowlistPaths, snapshotKeys);

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
      throw new Error(`[ParisWorker] Failed to rebase user overlay (${patchRes.status}): ${JSON.stringify(details)}`);
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
    const localPublish = await publishLayerLocal(args.env, args.publicId, 'user', row.layer_key, 'upsert');
    if (localPublish) {
      console.error('[ParisWorker] Failed to locally publish user overlay during rebase', localPublish);
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

async function applyL10nGenerateReport(args: { env: Env; report: L10nGenerateReportPayload }) {
  const { env, report } = args;
  let existing: L10nGenerateStateRow | null = null;
  try {
    existing = await loadL10nGenerateStateRow(env, report.publicId, report.layer, report.layerKey, report.baseFingerprint);
  } catch (error) {
    console.error('[ParisWorker] Failed to load l10n generate state for report', error);
  }

  const occurredAt = report.occurredAt && !Number.isNaN(Date.parse(report.occurredAt)) ? report.occurredAt : new Date().toISOString();
  const attemptsRaw =
    typeof report.attempts === 'number' && Number.isFinite(report.attempts)
      ? Math.max(0, Math.floor(report.attempts))
      : null;
  const attempts = attemptsRaw ?? existing?.attempts ?? 1;

  let nextAttemptAt: string | null = null;
  let lastAttemptAt: string | null = existing?.last_attempt_at ?? null;
  if (report.status !== 'dirty') {
    lastAttemptAt = occurredAt;
  }
  if (report.status === 'failed') {
    const delayMs = computeL10nGenerateBackoffMs(Math.max(1, attempts));
    nextAttemptAt = new Date(Date.parse(occurredAt) + delayMs).toISOString();
  }

  let lastError: string | null = null;
  if (report.status === 'failed' || report.status === 'superseded') {
    lastError = report.error ? String(report.error) : report.status === 'superseded' ? 'superseded' : 'unknown_error';
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
  const auth = assertDevAuth(req, env);
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
  if (!baseFingerprint) issues.push({ path: 'baseFingerprint', message: 'baseFingerprint is required' });

  const status = isL10nGenerateStatus(reportRaw.status) ? reportRaw.status : null;
  if (!status) issues.push({ path: 'status', message: 'invalid status' });

  const attemptsRaw = reportRaw.attempts;
  const attempts =
    typeof attemptsRaw === 'number' && Number.isFinite(attemptsRaw) ? Math.max(0, Math.floor(attemptsRaw)) : undefined;

  const widgetTypeRaw = reportRaw.widgetType;
  const widgetTypeResult = widgetTypeRaw !== undefined ? assertWidgetType(widgetTypeRaw) : { ok: true as const, value: null };
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
    publicId: publicIdResult.value,
    layer: layer!,
    layerKey: layerKey!,
    baseFingerprint,
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

async function loadPendingL10nGenerateStates(env: Env, limit = 50): Promise<L10nGenerateStateRow[]> {
  const nowIso = new Date().toISOString();
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
    `(status.eq.dirty,and(status.eq.failed,next_attempt_at.lte.${nowIso}),and(status.eq.failed,next_attempt_at.is.null))`,
  );
  const res = await supabaseFetch(env, `/rest/v1/l10n_generate_state?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load pending l10n generate state (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as L10nGenerateStateRow[];
  return rows?.filter(Boolean) ?? [];
}

async function requeueL10nGenerateStates(env: Env, limit = 50): Promise<{ processed: number; queued: number; failed: number }> {
  const rows = await loadPendingL10nGenerateStates(env, limit);
  if (!rows.length) return { processed: 0, queued: 0, failed: 0 };

  const envStage = asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev';
  const nowIso = new Date().toISOString();

  const jobs: L10nJob[] = [];
  const queuedRows: L10nGenerateStateRow[] = [];
  const failedRows: L10nGenerateStateRow[] = [];

  for (const row of rows) {
    const locale = row.layer_key;
    const widgetType = row.widget_type ?? null;
    const workspaceId = row.workspace_id ?? null;
    const attempts = (row.attempts ?? 0) + 1;
    if (!locale || !widgetType || !workspaceId) {
      const nextAttemptAt = new Date(Date.parse(nowIso) + computeL10nGenerateBackoffMs(attempts)).toISOString();
      failedRows.push({
        ...row,
        status: 'failed',
        attempts,
        next_attempt_at: nextAttemptAt,
        last_attempt_at: nowIso,
        last_error: 'missing_job_metadata',
      });
      continue;
    }

    const kind = inferInstanceKindFromPublicId(row.public_id);
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
      const nextAttemptAt = new Date(Date.parse(nowIso) + computeL10nGenerateBackoffMs(attempts)).toISOString();
      failedRows.push({
        ...row,
        status: 'failed',
        attempts,
        next_attempt_at: nextAttemptAt,
        last_attempt_at: nowIso,
        last_error: `ai_grant_failed:${detail}`,
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

  if (!jobs.length) return { processed: rows.length, queued: 0, failed: failedRows.length };

  if (!env.L10N_GENERATE_QUEUE) {
    const failedAt = new Date().toISOString();
    const queueFailures = queuedRows.map((row) => {
      const attempts = row.attempts ?? 1;
      const nextAttemptAt = new Date(Date.parse(failedAt) + computeL10nGenerateBackoffMs(attempts)).toISOString();
      return {
        ...row,
        status: 'failed',
        next_attempt_at: nextAttemptAt,
        last_attempt_at: failedAt,
        last_error: 'L10N_GENERATE_QUEUE missing',
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
    const queueFailures = queuedRows.map((row) => {
      const attempts = row.attempts ?? 1;
      const nextAttemptAt = new Date(Date.parse(failedAt) + computeL10nGenerateBackoffMs(attempts)).toISOString();
      return {
        ...row,
        status: 'failed',
        next_attempt_at: nextAttemptAt,
        last_attempt_at: failedAt,
        last_error: detail,
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
      500
    );
  }
  return { locales: normalized.locales };
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
      403
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
        403
      );
    }
  }
  return null;
}

function enforceLayerEntitlement(_policy: Policy, _layer: string): Response | null {
  return null;
}

export async function handleWorkspaceInstanceLayersList(req: Request, env: Env, workspaceId: string, publicId: string) {
  const auth = assertDevAuth(req, env);
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
  if (!instance) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

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
  layerKeyRaw: string
) {
  const auth = assertDevAuth(req, env);
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
  if (!instance) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const row = await loadInstanceOverlay(env, publicIdResult.value, layer, layerKey);
  if (!row) {
    return apiError('LAYER_NOT_FOUND', 'Layer overlay not found', 404, { publicId, layer, layerKey });
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
  layerKeyRaw: string
) {
  const auth = assertDevAuth(req, env);
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
    return apiError('LOCALE_INVALID', 'publicId must be locale-free', 400, { publicId, locale: layerKey });
  }
  if (layer === 'user' && layerKey !== 'global' && hasLocaleSuffix(publicIdResult.value, layerKey)) {
    return apiError('LOCALE_INVALID', 'publicId must be locale-free', 400, { publicId, locale: layerKey });
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

  const geoResult = hasGeoTargets ? normalizeGeoCountries((payload as any).geoTargets, 'geoTargets') : null;
  if (geoResult && !geoResult.ok) {
    return apiError('OPS_INVALID_TYPE', 'Invalid geoTargets', 400, geoResult.issues);
  }

  const opsResult = hasOps ? validateL10nOps((payload as any).ops, allowlistPaths) : null;
  if (hasOps && opsResult && !opsResult.ok) {
    return apiError(opsResult.code, opsResult.message, 400, opsResult.detail);
  }

  const userOpsResult = hasUserOps ? validateL10nOps((payload as any).userOps, allowlistPaths) : null;
  if (hasUserOps && userOpsResult && !userOpsResult.ok) {
    return apiError(userOpsResult.code, userOpsResult.message, 400, userOpsResult.detail);
  }

  let row: InstanceOverlayRow | null = null;
  if (hasOps) {
    const geoTargets = hasGeoTargets ? geoResult?.geoCountries ?? null : existing?.geo_targets ?? null;
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

    const upsertRes = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?on_conflict=public_id,layer,layer_key`, {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payloadRow),
    });
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
      const insertRes = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?on_conflict=public_id,layer,layer_key`, {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payloadRow),
      });
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
        const existingState = await loadL10nGenerateStateRow(env, publicIdResult.value, layer, layerKey, overlayFingerprint);
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

  const localPublish = await publishLayerLocal(env, publicIdResult.value, layer, layerKey, 'upsert');
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
  layerKeyRaw: string
) {
  const auth = assertDevAuth(req, env);
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
    return json({ publicId: publicIdResult.value, layer, layerKey, deleted: false, reason: 'not_found' });
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

  const localPublish = await publishLayerLocal(env, publicIdResult.value, layer, layerKey, 'delete');
  if (localPublish) return localPublish;

  return json({ publicId: publicIdResult.value, layer, layerKey, deleted: true });
}

export async function handleWorkspaceInstanceL10nStatus(req: Request, env: Env, workspaceId: string, publicId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType) return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

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
  const kind = resolveInstanceKind(instance);

  let locales: string[] = [];
  if (kind === 'curated') {
    locales = SUPPORTED_LOCALES;
  } else {
    const workspaceLocales = readWorkspaceLocales(workspace);
    if (workspaceLocales instanceof Response) return workspaceLocales;
    locales = workspaceLocales.locales;
    const entitlementGate = enforceL10nSelection(policyResult.policy, locales);
    if (entitlementGate) return entitlementGate;
  }

  let stateMap = locales.length
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

  if (locales.length && stateMap.size === 0 && overlayStale.size > 0) {
    try {
      const enqueueResult = await enqueueL10nJobs({
        env,
        instance,
        workspace,
        widgetType,
        baseUpdatedAt,
        policy: policyResult.policy,
      });
      if (!enqueueResult.ok) {
        console.error('[ParisWorker] l10n enqueue failed (status refresh)', enqueueResult.error);
      }
      stateMap = await loadL10nGenerateStates(env, publicId, 'locale', baseFingerprint);
    } catch (error) {
      console.error('[ParisWorker] Failed to enqueue l10n on status refresh', error);
    }
  }

  if (overlayMatch.size) {
    const nowIso = new Date().toISOString();
    const backfillRows: L10nGenerateStateRow[] = [];
    overlayMatch.forEach((locale) => {
      const existing = stateMap.get(locale);
      if (existing?.status === 'succeeded') return;
      const attempts = Math.max(existing?.attempts ?? 0, 1);
      backfillRows.push({
        public_id: publicId,
        layer: 'locale',
        layer_key: locale,
        base_fingerprint: baseFingerprint,
        base_updated_at: baseUpdatedAt,
        widget_type: widgetType,
        workspace_id: workspace.id,
        status: 'succeeded',
        attempts,
        next_attempt_at: null,
        last_attempt_at: existing?.last_attempt_at ?? nowIso,
        last_error: null,
        changed_paths: existing?.changed_paths ?? null,
        removed_paths: existing?.removed_paths ?? null,
      });
    });
    if (backfillRows.length) {
      await upsertL10nGenerateStates(env, backfillRows);
    }
  }

  const localeStates = locales.map((locale) => {
    const row = stateMap.get(locale);
    const hasMatch = overlayMatch.has(locale);
    const hasStale = overlayStale.has(locale);
    let status: L10nGenerateStatus = row?.status ?? 'dirty';
    if (hasMatch) status = 'succeeded';
    else if (!row?.status && hasStale) status = 'superseded';
    const attempts = hasMatch ? Math.max(row?.attempts ?? 0, 1) : row?.attempts ?? 0;
    return {
      locale,
      status,
      attempts,
      nextAttemptAt: hasMatch ? null : row?.next_attempt_at ?? null,
      lastAttemptAt: row?.last_attempt_at ?? null,
      lastError: hasMatch ? null : row?.last_error ?? null,
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

export async function handleWorkspaceLocalesGet(req: Request, env: Env, workspaceId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const normalized = normalizeLocaleList(workspace.l10n_locales, 'l10n_locales');
  if (!normalized.ok) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.workspace.locales.invalid',
        detail: JSON.stringify(normalized.issues),
      },
      500
    );
  }

  return json({ locales: normalized.locales });
}

export async function handleWorkspaceLocalesPut(req: Request, env: Env, workspaceId: string) {
  const auth = assertDevAuth(req, env);
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

  const patchRes = await supabaseFetch(env, `/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ l10n_locales: locales }),
  });
  if (!patchRes.ok) {
    const details = await readJson(patchRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500);
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
}) {
  if (!args.widgetType) {
    return { ok: false as const, queued: 0, skipped: 0, error: 'coreui.errors.instance.widgetMissing' };
  }

  const kind = resolveInstanceKind(args.instance);
  let locales: string[] = [];

  if (kind === 'curated') {
    locales = SUPPORTED_LOCALES;
  } else {
    const workspaceLocales = readWorkspaceLocales(args.workspace);
    if (workspaceLocales instanceof Response) {
      return { ok: false as const, queued: 0, skipped: 0, error: 'coreui.errors.workspace.locales.invalid' };
    }
    locales = workspaceLocales.locales;
    const entitlementGate = enforceL10nSelection(args.policy, locales);
    if (entitlementGate) {
      return { ok: true as const, queued: 0, skipped: locales.length };
    }
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
  const { changedPaths, removedPaths } = diffL10nSnapshots(previousSnapshot?.snapshot ?? null, l10nSnapshot);
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

  if (changedPaths.length === 0 && removedPaths.length === 0) {
    return { ok: true as const, queued: 0, skipped: locales.length };
  }

  const existingStates = await loadL10nGenerateStates(args.env, publicId, layer, baseFingerprint);
  const pendingLocales: string[] = [];
  const dirtyRows: L10nGenerateStateRow[] = [];
  const nowMs = Date.now();
  // In non-local environments queued/running states can get stuck if the queue
  // consumer was unavailable. Treat long-stale attempts as requeueable.
  const requeueStaleMs = 10 * 60_000;

  locales.forEach((locale) => {
    const current = existingStates.get(locale);
    if (current?.status === 'succeeded') return;
    if (current && (current.status === 'queued' || current.status === 'running')) {
      const lastAttemptAt = current.last_attempt_at ? Date.parse(current.last_attempt_at) : NaN;
      const staleAttempt = !Number.isFinite(lastAttemptAt) || nowMs - lastAttemptAt >= requeueStaleMs;
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
      changed_paths: changedPaths,
      removed_paths: removedPaths,
    });
  });

  if (!pendingLocales.length) return { ok: true as const, queued: 0, skipped: locales.length };

  await upsertL10nGenerateStates(args.env, dirtyRows);

  const grantSubject = kind === 'curated' ? 'devstudio' : 'workspace';
  const grantWorkspaceId = grantSubject === 'workspace' ? workspaceId : undefined;
  if (grantSubject === 'workspace' && !grantWorkspaceId) {
    return { ok: false as const, queued: 0, skipped: 0, error: 'Missing workspaceId for user l10n grant' };
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
      return { ok: false as const, queued: 0, skipped: 0, error: `AI grant failed for l10n: ${detail}` };
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
      changedPaths,
      removedPaths,
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
        const nextAttemptAt = new Date(failedAt.getTime() + computeL10nGenerateBackoffMs(attempts)).toISOString();
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
          next_attempt_at: nextAttemptAt,
          last_attempt_at: failedAt.toISOString(),
          last_error: detail,
          changed_paths: current?.changed_paths ?? changedPaths,
          removed_paths: current?.removed_paths ?? removedPaths,
        };
      });
      await upsertL10nGenerateStates(args.env, failedRows);
      return { ok: false as const, queued: 0, skipped: locales.length - pendingLocales.length, error: detail };
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
        const nextAttemptAt = new Date(failedAt.getTime() + computeL10nGenerateBackoffMs(attempts)).toISOString();
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
          next_attempt_at: nextAttemptAt,
          last_attempt_at: failedAt.toISOString(),
          last_error: detail,
          changed_paths: current?.changed_paths ?? changedPaths,
          removed_paths: current?.removed_paths ?? removedPaths,
        };
      });
      await upsertL10nGenerateStates(args.env, failedRows);
      return { ok: false as const, queued: 0, skipped: locales.length - pendingLocales.length, error: detail };
    }
  } else {
    if (!args.env.L10N_GENERATE_QUEUE) {
      const failedAt = new Date();
      const failedRows: L10nGenerateStateRow[] = pendingLocales.map((locale) => {
        const current = existingStates.get(locale);
        const attempts = (current?.attempts ?? 0) + 1;
        const nextAttemptAt = new Date(failedAt.getTime() + computeL10nGenerateBackoffMs(attempts)).toISOString();
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
          next_attempt_at: nextAttemptAt,
          last_attempt_at: failedAt.toISOString(),
          last_error: 'L10N_GENERATE_QUEUE missing',
          changed_paths: current?.changed_paths ?? changedPaths,
          removed_paths: current?.removed_paths ?? removedPaths,
        };
      });
      await upsertL10nGenerateStates(args.env, failedRows);
      return { ok: false as const, queued: 0, skipped: locales.length - pendingLocales.length, error: 'L10N_GENERATE_QUEUE missing' };
    }

    try {
      await args.env.L10N_GENERATE_QUEUE.sendBatch(jobs.map((job) => ({ body: job })));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const failedAt = new Date();
      const failedRows: L10nGenerateStateRow[] = pendingLocales.map((locale) => {
        const current = existingStates.get(locale);
        const attempts = (current?.attempts ?? 0) + 1;
        const nextAttemptAt = new Date(failedAt.getTime() + computeL10nGenerateBackoffMs(attempts)).toISOString();
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
          next_attempt_at: nextAttemptAt,
          last_attempt_at: failedAt.toISOString(),
          last_error: detail,
          changed_paths: current?.changed_paths ?? changedPaths,
          removed_paths: current?.removed_paths ?? removedPaths,
        };
      });
      await upsertL10nGenerateStates(args.env, failedRows);
      return { ok: false as const, queued: 0, skipped: locales.length - pendingLocales.length, error: detail };
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
      changed_paths: current?.changed_paths ?? changedPaths,
      removed_paths: current?.removed_paths ?? removedPaths,
    };
  });
  await upsertL10nGenerateStates(args.env, queuedRows);

  return { ok: true as const, queued: pendingLocales.length, skipped: locales.length - pendingLocales.length };
}

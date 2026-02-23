import { json, normalizeSha256Hex, requireDevAuth, supabaseFetch } from '../index';
import type { Env } from '../index';
import { loadWorkspaceTier, resolveL10nVersionLimit } from './assets';
import {
  assertOverlayShape,
  deleteLayerArtifacts,
  handleDeleteL10nLayerIndex,
  handleDeleteL10nOverlay,
  handlePutL10nLayerIndex,
  handlePutL10nOverlay,
  loadInstanceOverlayRow,
  loadL10nBaseSnapshot,
  normalizeLayer,
  normalizeLayerKey,
  normalizePublicId,
  publishBaseSnapshotArtifact,
  publishLayerIndex,
  publishLayerOverlayArtifacts,
  putBaseSnapshotArtifactDirect,
  type InstanceOverlayRow,
  type L10nOverlay,
  type L10nPublishRequest,
  type L10nPublishQueueJob,
  type L10nPublishResult,
  type L10nPublishStateRow,
} from './l10n-core';

async function handlePutL10nBaseSnapshot(
  req: Request,
  env: Env,
  publicId: string,
  baseFingerprint: string,
): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }, { status: 422 });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 });
  }
  if (payload.v !== 1) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid', detail: 'snapshot.v must be 1' } }, { status: 422 });
  }
  if (payload.publicId && String(payload.publicId) !== publicId) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid', detail: 'snapshot.publicId mismatch' } },
      { status: 422 },
    );
  }
  if (payload.baseFingerprint && normalizeSha256Hex(payload.baseFingerprint) !== baseFingerprint) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid', detail: 'snapshot.baseFingerprint mismatch' } },
      { status: 422 },
    );
  }
  if (!payload.snapshot || typeof payload.snapshot !== 'object' || Array.isArray(payload.snapshot)) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid', detail: 'snapshot.snapshot must be an object' } },
      { status: 422 },
    );
  }

  const snapshot: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.snapshot as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    snapshot[String(key)] = value;
  }

  const outName = await putBaseSnapshotArtifactDirect(env, publicId, baseFingerprint, snapshot);
  return json({ publicId, baseFingerprint, file: outName }, { status: 200 });
}

function isPublishJob(value: unknown): value is L10nPublishQueueJob {
  if (!value || typeof value !== 'object') return false;
  const job = value as L10nPublishQueueJob;
  if (job.v !== 2) return false;
  if (typeof job.publicId !== 'string' || typeof job.layer !== 'string' || typeof job.layerKey !== 'string') {
    return false;
  }
  if (job.action && job.action !== 'upsert' && job.action !== 'delete') return false;
  return true;
}

async function publishLayerFromSupabase(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string
): Promise<L10nPublishResult | null> {
  const row = await loadInstanceOverlayRow(env, publicId, layer, layerKey);
  if (row) {
    const includeUserOps = layer === 'user';
    return publishLayerRow(env, row, includeUserOps);
  }
  return null;
}

async function publishLayerRow(
  env: Env,
  row: InstanceOverlayRow,
  includeUserOps: boolean
): Promise<L10nPublishResult | null> {
  const publicId = normalizePublicId(row.public_id);
  const layer = normalizeLayer(row.layer);
  const layerKey = layer ? normalizeLayerKey(layer, row.layer_key) : null;
  if (!publicId || !layer || !layerKey) return null;
  const baseOps = Array.isArray(row.ops) ? row.ops : [];
  const userOps = includeUserOps && Array.isArray(row.user_ops) ? row.user_ops : [];
  const mergedOps = [...baseOps, ...userOps];
  let overlay: L10nOverlay;
  try {
    overlay = assertOverlayShape({
      v: 1,
      baseUpdatedAt: row.base_updated_at ?? null,
      baseFingerprint: row.base_fingerprint ?? null,
      ops: mergedOps,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`[tokyo] Invalid overlay row: ${detail}`);
  }
  await publishLayerOverlayArtifacts(env, publicId, layer, layerKey, overlay);

  if (layer === 'locale' || layer === 'user') {
    try {
      const baseSnapshot = await loadL10nBaseSnapshot(env, publicId, overlay.baseFingerprint);
      if (baseSnapshot) {
        await publishBaseSnapshotArtifact(env, publicId, overlay.baseFingerprint, baseSnapshot);
      }
    } catch (err) {
      console.warn('[tokyo] Failed to publish l10n base snapshot', err);
    }
  }

  return {
    publicId,
    layer,
    layerKey,
    baseFingerprint: overlay.baseFingerprint ?? '',
    baseUpdatedAt: row.base_updated_at ?? null,
    workspaceId: row.workspace_id ?? null,
  };
}

async function handlePublishLocaleRequest(req: Request, env: Env): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }, { status: 422 });
  }
  if (!payload || typeof payload !== 'object') {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 });
  }

  const { publicId: rawPublicId, layer: rawLayer, layerKey: rawLayerKey, action } = payload as L10nPublishRequest;
  const publicId = normalizePublicId(String(rawPublicId || ''));
  const layer = normalizeLayer(String(rawLayer || ''));
  const layerKey = layer ? normalizeLayerKey(layer, String(rawLayerKey || '')) : null;
  if (!publicId || !layer || !layerKey) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 });
  }

  const resolvedAction = action === 'delete' ? 'delete' : 'upsert';
  if (resolvedAction === 'delete') {
    await deleteLayerArtifacts(env, publicId, layer, layerKey);
    await deleteL10nOverlayVersions(env, publicId, layer, layerKey);
    const stateRow = await loadPublishStateRow(env, publicId, layer, layerKey);
    if (stateRow?.base_fingerprint) {
      await markPublishStateClean(env, publicId, layer, layerKey, stateRow.base_fingerprint);
    }
    await publishLayerIndex(env, publicId);
  } else {
    const result = await publishLayerFromSupabase(env, publicId, layer, layerKey);
    if (result?.baseFingerprint) {
      await markPublishStateClean(env, publicId, layer, layerKey, result.baseFingerprint);
      await recordL10nOverlayVersion(env, result);
    }
    await publishLayerIndex(env, publicId);
  }

  if ((layer === 'locale' || layer === 'user') && env.RENDER_SNAPSHOT_QUEUE) {
    await env.RENDER_SNAPSHOT_QUEUE.send({
      v: 1,
      kind: 'render-snapshot',
      publicId,
      locales: [layerKey],
      action: 'upsert',
    });
  }

  return json({ publicId, layer, layerKey, action: resolvedAction }, { status: 200 });
}

async function loadPublishStateRow(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string
): Promise<L10nPublishStateRow | null> {
  const params = new URLSearchParams({
    select:
      'public_id,locale,layer,layer_key,base_fingerprint,published_fingerprint,publish_state,publish_attempts,publish_next_at,last_error',
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    layer_key: `eq.${layerKey}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/l10n_publish_state?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase publish state read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as L10nPublishStateRow[];
  return rows?.[0] ?? null;
}

async function upsertPublishState(env: Env, payload: Record<string, unknown>): Promise<void> {
  const res = await supabaseFetch(env, `/rest/v1/l10n_publish_state?on_conflict=public_id,layer,layer_key`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase publish state upsert failed (${res.status}) ${text}`.trim());
  }
}

async function markPublishStateClean(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
  baseFingerprint: string
): Promise<void> {
  await upsertPublishState(env, {
    public_id: publicId,
    locale: layer === 'locale' ? layerKey : null,
    layer,
    layer_key: layerKey,
    base_fingerprint: baseFingerprint,
    published_fingerprint: baseFingerprint,
    publish_state: 'clean',
    publish_attempts: 0,
    publish_next_at: null,
    last_error: null,
  });
}

async function markPublishStateFailed(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
  baseFingerprint: string,
  error: string,
): Promise<void> {
  const existing = await loadPublishStateRow(env, publicId, layer, layerKey);
  const attempts = (existing?.publish_attempts ?? 0) + 1;
  const delayMs = Math.min(60_000 * attempts, 15 * 60_000);
  const nextAt = new Date(Date.now() + delayMs).toISOString();
  await upsertPublishState(env, {
    public_id: publicId,
    locale: layer === 'locale' ? layerKey : null,
    layer,
    layer_key: layerKey,
    base_fingerprint: baseFingerprint,
    publish_state: 'failed',
    publish_attempts: attempts,
    publish_next_at: nextAt,
    last_error: error,
  });
}

async function listDirtyPublishStates(env: Env, limit = 200): Promise<L10nPublishStateRow[]> {
  const now = new Date().toISOString();
  const params = new URLSearchParams({
    select: 'public_id,layer,layer_key,base_fingerprint,publish_state,publish_next_at',
    publish_state: 'in.(dirty,failed)',
    order: 'publish_next_at.asc.nullsfirst,updated_at.asc',
    limit: String(limit),
  });
  params.set('or', `(publish_next_at.is.null,publish_next_at.lte.${now})`);
  const res = await supabaseFetch(env, `/rest/v1/l10n_publish_state?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase dirty publish list failed (${res.status}) ${text}`.trim());
  }
  return (await res.json().catch(() => [])) as L10nPublishStateRow[];
}


async function recordL10nOverlayVersion(env: Env, result: L10nPublishResult): Promise<void> {
  const workspaceId = result.workspaceId;
  if (!workspaceId) return;
  const tier = await loadWorkspaceTier(env, workspaceId);
  const limit = resolveL10nVersionLimit(tier);
  if (!result.baseFingerprint) return;

  const r2Path = `l10n/instances/${result.publicId}/${result.layer}/${result.layerKey}/${result.baseFingerprint}.ops.json`;
  const payload = {
    workspace_id: workspaceId,
    public_id: result.publicId,
    locale: result.layer === 'locale' ? result.layerKey : null,
    layer: result.layer,
    layer_key: result.layerKey,
    base_fingerprint: result.baseFingerprint,
    base_updated_at: result.baseUpdatedAt,
    r2_path: r2Path,
  };

  const insertRes = await supabaseFetch(env, `/rest/v1/l10n_overlay_versions?on_conflict=public_id,layer,layer_key,base_fingerprint`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(payload),
  });
  if (!insertRes.ok) {
    const text = await insertRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase l10n version insert failed (${insertRes.status}) ${text}`.trim());
  }

  if (limit != null) {
    await cleanupL10nOverlayVersions(env, result.publicId, result.layer, result.layerKey, limit);
  }
}

async function cleanupL10nOverlayVersions(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
  keepCount: number
): Promise<void> {
  if (keepCount <= 0) return;
  const limit = 1000;
  const params = new URLSearchParams({
    select: 'id,r2_path',
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    layer_key: `eq.${layerKey}`,
    order: 'created_at.desc',
    offset: String(keepCount),
    limit: String(limit),
  });
  const res = await supabaseFetch(env, `/rest/v1/l10n_overlay_versions?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase l10n version list failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ id: string; r2_path: string }>;
  if (!rows.length) return;

  for (const row of rows) {
    if (row?.r2_path) {
      await env.TOKYO_R2.delete(row.r2_path);
    }
  }

  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return;
  const deleteParams = new URLSearchParams({ id: `in.(${ids.join(',')})` });
  const deleteRes = await supabaseFetch(env, `/rest/v1/l10n_overlay_versions?${deleteParams.toString()}`, {
    method: 'DELETE',
  });
  if (!deleteRes.ok) {
    const text = await deleteRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase l10n version delete failed (${deleteRes.status}) ${text}`.trim());
  }
}

async function deleteL10nOverlayVersions(env: Env, publicId: string, layer: string, layerKey: string): Promise<void> {
  const params = new URLSearchParams({
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    layer_key: `eq.${layerKey}`,
  });
  const res = await supabaseFetch(env, `/rest/v1/l10n_overlay_versions?${params.toString()}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase l10n version purge failed (${res.status}) ${text}`.trim());
  }
}

async function handleGetL10nAsset(env: Env, key: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  headers.set('content-type', obj.httpMetadata?.contentType || 'application/json; charset=utf-8');
  // Fingerprinted overlay files are immutable; layer indices are mutable and must not be cached long.
  if (key.endsWith('/index.json')) {
    headers.set('cache-control', 'public, max-age=60');
  } else {
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  }
  return new Response(obj.body, { status: 200, headers });
}

export type { L10nPublishQueueJob };

export {
  deleteLayerArtifacts,
  deleteL10nOverlayVersions,
  handleDeleteL10nLayerIndex,
  handleDeleteL10nOverlay,
  handleGetL10nAsset,
  handlePublishLocaleRequest,
  handlePutL10nBaseSnapshot,
  handlePutL10nLayerIndex,
  handlePutL10nOverlay,
  isPublishJob,
  listDirtyPublishStates,
  loadPublishStateRow,
  markPublishStateClean,
  markPublishStateFailed,
  normalizeLayer,
  normalizeLayerKey,
  publishLayerFromSupabase,
  publishLayerIndex,
  recordL10nOverlayVersion,
};

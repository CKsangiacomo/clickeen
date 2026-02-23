import {
  buildL10nBridgeHeaders,
  json,
  requireDevAuth,
  resolveL10nHttpBase,
  supabaseFetch,
} from '../index';
import type { Env } from '../index';
import { normalizeWidgetPublicId } from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';

const L10N_PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

type L10nOverlay = {
  v: 1;
  baseUpdatedAt?: string | null;
  baseFingerprint?: string | null;
  ops: Array<{ op: 'set'; path: string; value: unknown }>;
};

type L10nBaseSnapshot = {
  v: 1;
  publicId: string;
  baseFingerprint: string;
  snapshot: Record<string, string>;
};

type LayerIndexEntry = {
  keys: string[];
  lastPublishedFingerprint?: Record<string, string>;
  geoTargets?: Record<string, string[]>;
};

type LayerIndex = {
  v: 1;
  publicId: string;
  layers: Record<string, LayerIndexEntry>;
};

type LayerPublishJob = {
  v: 2;
  publicId: string;
  layer: string;
  layerKey: string;
  action?: 'upsert' | 'delete';
};

type L10nPublishQueueJob = LayerPublishJob;

type L10nPublishRequest = {
  publicId: string;
  layer: string;
  layerKey: string;
  action?: 'upsert' | 'delete';
};

type InstanceOverlayRow = {
  public_id: string;
  layer: string;
  layer_key: string;
  ops: Array<{ op: 'set'; path: string; value: unknown }>;
  user_ops?: Array<{ op: 'set'; path: string; value: unknown }>;
  base_updated_at?: string | null;
  base_fingerprint?: string | null;
  geo_targets?: string[] | null;
  workspace_id?: string | null;
};

type BaseSnapshotRow = {
  public_id: string;
  base_fingerprint: string;
  snapshot: Record<string, unknown>;
};

type L10nPublishStateRow = {
  public_id: string;
  locale?: string | null;
  layer: string;
  layer_key: string;
  base_fingerprint: string;
  published_fingerprint?: string | null;
  publish_state: string;
  publish_attempts?: number | null;
  publish_next_at?: string | null;
  last_error?: string | null;
};

type L10nPublishResult = {
  publicId: string;
  layer: string;
  layerKey: string;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  workspaceId: string | null;
};

const normalizePublicId = normalizeWidgetPublicId;

function normalizeWidgetType(raw: string): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) return null;
  return value;
}

export function normalizeLocale(raw: unknown): string | null {
  return normalizeLocaleToken(raw);
}

const L10N_LAYER_ALLOWED = new Set(['locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user']);
const LAYER_KEY_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_EXPERIMENT = /^exp_[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_BEHAVIOR = /^behavior_[a-z0-9][a-z0-9_-]*$/;

function normalizeLayer(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || !L10N_LAYER_ALLOWED.has(value)) return null;
  return value;
}

function normalizeLayerKey(layer: string, raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  switch (layer) {
    case 'locale': {
      return normalizeLocale(value);
    }
    case 'geo': {
      const upper = value.toUpperCase();
      return /^[A-Z]{2}$/.test(upper) ? upper : null;
    }
    case 'industry': {
      const lower = value.toLowerCase();
      return LAYER_KEY_SLUG.test(lower) ? lower : null;
    }
    case 'experiment': {
      const lower = value.toLowerCase();
      return LAYER_KEY_EXPERIMENT.test(lower) ? lower : null;
    }
    case 'account': {
      const lower = value.toLowerCase();
      return LAYER_KEY_SLUG.test(lower) ? lower : null;
    }
    case 'behavior': {
      const lower = value.toLowerCase();
      return LAYER_KEY_BEHAVIOR.test(lower) ? lower : null;
    }
    case 'user': {
      if (value === 'global') return 'global';
      return normalizeLocale(value);
    }
    default:
      return null;
  }
}

function normalizeGeoCountries(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const list = raw
    .map((code) => String(code || '').trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));
  if (!list.length) return null;
  return Array.from(new Set(list));
}

function hasProhibitedSegment(pathStr: string): boolean {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && L10N_PROHIBITED_SEGMENTS.has(seg));
}

function stableStringify(value: any): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
  return `{${body}}`;
}

export function prettyStableJson(value: any): string {
  const parsed = JSON.parse(stableStringify(value));
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

export function normalizeSha256Hex(raw: unknown): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!SHA256_HEX_RE.test(value)) return null;
  return value;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(hash);
  let out = '';
  for (let i = 0; i < view.length; i += 1) {
    out += view[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

function assertOverlayShape(payload: any): L10nOverlay {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('[tokyo] overlay must be an object');
  }
  if (payload.v !== 1) throw new Error('[tokyo] overlay.v must be 1');
  if (!Array.isArray(payload.ops)) throw new Error('[tokyo] overlay.ops must be an array');

  const ops = payload.ops.map((op: any, index: number) => {
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new Error(`[tokyo] overlay.ops[${index}] must be an object`);
    }
    if (op.op !== 'set') throw new Error(`[tokyo] overlay.ops[${index}].op must be "set"`);
    const path = typeof op.path === 'string' ? op.path.trim() : '';
    if (!path) throw new Error(`[tokyo] overlay.ops[${index}].path is required`);
    if (hasProhibitedSegment(path)) throw new Error(`[tokyo] overlay.ops[${index}].path contains prohibited segment`);
    if (!('value' in op)) throw new Error(`[tokyo] overlay.ops[${index}].value is required`);
    return { op: 'set' as const, path, value: op.value };
  });

  const baseFingerprint = typeof payload.baseFingerprint === 'string' ? payload.baseFingerprint.trim() : '';
  if (!SHA256_HEX_RE.test(baseFingerprint)) {
    throw new Error('[tokyo] overlay.baseFingerprint must be a sha256 hex string');
  }
  return { v: 1, baseUpdatedAt: payload.baseUpdatedAt ?? null, baseFingerprint, ops };
}

async function cleanOldLayerOutputs(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
  keepKey: string
): Promise<void> {
  const prefix = `l10n/instances/${publicId}/${layer}/${layerKey}/`;
  let cursor: string | undefined = undefined;
  do {
    const list = await env.TOKYO_R2.list({ prefix, cursor });
    for (const obj of list.objects) {
      if (obj.key !== keepKey) {
        await env.TOKYO_R2.delete(obj.key);
      }
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}

function layerOverlayPath(publicId: string, layer: string, layerKey: string, outName: string): string {
  return `l10n/instances/${publicId}/${layer}/${layerKey}/${outName}`;
}

function layerBaseSnapshotPath(publicId: string, baseFingerprint: string): string {
  return `l10n/instances/${publicId}/bases/${baseFingerprint}.snapshot.json`;
}

function layerIndexPath(publicId: string): string {
  return `l10n/instances/${publicId}/index.json`;
}

async function putLayerOverlayArtifactDirect(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
  overlay: L10nOverlay,
  opts?: { cleanupOld?: boolean },
): Promise<string> {
  const stable = prettyStableJson(overlay);
  const fingerprint = overlay.baseFingerprint ?? '';
  if (!/^[a-f0-9]{64}$/i.test(fingerprint)) {
    throw new Error('[tokyo] Missing baseFingerprint for deterministic l10n path');
  }
  const outName = `${fingerprint}.ops.json`;
  const key = layerOverlayPath(publicId, layer, layerKey, outName);

  await env.TOKYO_R2.put(key, stable, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  if (opts?.cleanupOld) {
    await cleanOldLayerOutputs(env, publicId, layer, layerKey, key);
  }
  return outName;
}

async function deleteLayerArtifactsDirectWithResult(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
): Promise<boolean> {
  const prefix = `l10n/instances/${publicId}/${layer}/${layerKey}/`;
  let deleted = false;
  let cursor: string | undefined = undefined;
  do {
    const list = await env.TOKYO_R2.list({ prefix, cursor });
    for (const obj of list.objects) {
      if (!obj.key.endsWith('.ops.json')) continue;
      deleted = true;
      await env.TOKYO_R2.delete(obj.key);
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  return deleted;
}

async function deleteLayerArtifactsWithResult(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
): Promise<boolean> {
  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(
      `${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(layer)}/${encodeURIComponent(
        layerKey
      )}`,
      { method: 'DELETE', headers: buildL10nBridgeHeaders(env) },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP delete failed (${res.status}): ${detail}`);
    }
    const payload = (await res.json().catch(() => null)) as { deleted?: unknown } | null;
    if (typeof payload?.deleted === 'boolean') return payload.deleted;
    return true;
  }

  return deleteLayerArtifactsDirectWithResult(env, publicId, layer, layerKey);
}

async function deleteLayerArtifacts(env: Env, publicId: string, layer: string, layerKey: string): Promise<void> {
  await deleteLayerArtifactsWithResult(env, publicId, layer, layerKey);
}

async function publishLayerOverlayArtifacts(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
  overlay: L10nOverlay,
): Promise<string> {
  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(
      `${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(layer)}/${encodeURIComponent(
        layerKey
      )}`,
      {
        method: 'POST',
        headers: buildL10nBridgeHeaders(env, { 'content-type': 'application/json' }),
        body: JSON.stringify({
          ...overlay,
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP publish failed (${res.status}): ${detail}`);
    }
    const data = (await res.json().catch(() => null)) as { file?: string } | null;
    const file = typeof data?.file === 'string' ? data.file.trim() : '';
    if (!file) {
      throw new Error('[tokyo] HTTP publish missing file name');
    }
    return file;
  }

  return putLayerOverlayArtifactDirect(env, publicId, layer, layerKey, overlay);
}

async function loadL10nBaseSnapshot(
  env: Env,
  publicId: string,
  baseFingerprintRaw: string | null | undefined,
): Promise<Record<string, string> | null> {
  const baseFingerprint = normalizeSha256Hex(baseFingerprintRaw);
  if (!baseFingerprint) return null;

  const params = new URLSearchParams({
    select: 'public_id,base_fingerprint,snapshot',
    public_id: `eq.${publicId}`,
    base_fingerprint: `eq.${baseFingerprint}`,
    limit: '1',
  });

  const res = await supabaseFetch(env, `/rest/v1/l10n_base_snapshots?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase base snapshot read failed (${res.status}) ${text}`.trim());
  }

  const rows = (await res.json().catch(() => [])) as BaseSnapshotRow[];
  const row = rows?.[0];
  if (!row) return null;
  if (row.public_id !== publicId) return null;
  if (normalizeSha256Hex(row.base_fingerprint) !== baseFingerprint) return null;
  if (!row.snapshot || typeof row.snapshot !== 'object' || Array.isArray(row.snapshot)) return null;

  const snapshot: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.snapshot)) {
    if (typeof value !== 'string') continue;
    snapshot[String(key)] = value;
  }
  return snapshot;
}

async function putBaseSnapshotArtifactDirect(
  env: Env,
  publicId: string,
  baseFingerprint: string,
  snapshot: Record<string, string>,
): Promise<string> {
  const payload: L10nBaseSnapshot = { v: 1, publicId, baseFingerprint, snapshot };
  const stable = prettyStableJson(payload);
  const outName = `${baseFingerprint}.snapshot.json`;
  const key = layerBaseSnapshotPath(publicId, baseFingerprint);

  await env.TOKYO_R2.put(key, stable, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  return outName;
}

async function publishBaseSnapshotArtifact(
  env: Env,
  publicId: string,
  baseFingerprintRaw: string | null | undefined,
  snapshot: Record<string, string>,
): Promise<void> {
  const baseFingerprint = normalizeSha256Hex(baseFingerprintRaw);
  if (!baseFingerprint) return;

  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(
      `${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/bases/${encodeURIComponent(baseFingerprint)}`,
      {
        method: 'POST',
        headers: buildL10nBridgeHeaders(env, { 'content-type': 'application/json' }),
        body: prettyStableJson({ v: 1, publicId, baseFingerprint, snapshot }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP base snapshot publish failed (${res.status}): ${detail}`.trim());
    }
    return;
  }

  await putBaseSnapshotArtifactDirect(env, publicId, baseFingerprint, snapshot);
}

async function loadInstanceOverlayRow(
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string
): Promise<InstanceOverlayRow | null> {
  const params = new URLSearchParams({
    select: 'public_id,layer,layer_key,ops,user_ops,base_updated_at,base_fingerprint,geo_targets,workspace_id',
    public_id: `eq.${publicId}`,
    layer: `eq.${layer}`,
    layer_key: `eq.${layerKey}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase overlay read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as InstanceOverlayRow[];
  return rows?.[0] ?? null;
}

async function loadInstanceOverlaysForPublicId(env: Env, publicId: string): Promise<InstanceOverlayRow[]> {
  const params = new URLSearchParams({
    select: 'public_id,layer,layer_key,base_fingerprint,geo_targets',
    public_id: `eq.${publicId}`,
    order: 'layer.asc,layer_key.asc',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase overlay list failed (${res.status}) ${text}`.trim());
  }
  return ((await res.json().catch(() => [])) as InstanceOverlayRow[]).filter(Boolean);
}

function assertLayerIndexShape(payload: any, publicId: string): LayerIndex {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('[tokyo] layer index must be an object');
  }
  if (payload.v !== 1) {
    throw new Error('[tokyo] layer index.v must be 1');
  }
  const pid = typeof payload.publicId === 'string' ? payload.publicId.trim() : '';
  if (pid && pid !== publicId) {
    throw new Error('[tokyo] layer index.publicId mismatch');
  }
  const rawLayers = payload.layers;
  if (!rawLayers || typeof rawLayers !== 'object' || Array.isArray(rawLayers)) {
    throw new Error('[tokyo] layer index.layers must be an object');
  }

  const layers: Record<string, LayerIndexEntry> = {};
  for (const [rawLayer, rawEntry] of Object.entries(rawLayers)) {
    const layer = normalizeLayer(rawLayer);
    if (!layer || !rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    const entryRecord = rawEntry as Record<string, unknown>;
    const rawKeys = Array.isArray(entryRecord.keys) ? entryRecord.keys : [];
    const keys: string[] = [];
    for (const candidate of rawKeys) {
      const normalized = normalizeLayerKey(layer, String(candidate ?? ''));
      if (!normalized || keys.includes(normalized)) continue;
      keys.push(normalized);
    }
    if (!keys.length) continue;
    keys.sort((a, b) => a.localeCompare(b));

    const entry: LayerIndexEntry = { keys };

    const rawFingerprints = entryRecord.lastPublishedFingerprint;
    if (rawFingerprints && typeof rawFingerprints === 'object' && !Array.isArray(rawFingerprints)) {
      const mapped: Record<string, string> = {};
      for (const [rawKey, rawFingerprint] of Object.entries(rawFingerprints as Record<string, unknown>)) {
        const normalizedKey = normalizeLayerKey(layer, rawKey);
        const fingerprint = normalizeSha256Hex(rawFingerprint);
        if (!normalizedKey || !fingerprint) continue;
        mapped[normalizedKey] = fingerprint;
      }
      if (Object.keys(mapped).length) {
        entry.lastPublishedFingerprint = mapped;
      }
    }

    if (layer === 'locale') {
      const rawGeoTargets = entryRecord.geoTargets;
      if (rawGeoTargets && typeof rawGeoTargets === 'object' && !Array.isArray(rawGeoTargets)) {
        const mapped: Record<string, string[]> = {};
        for (const [rawKey, rawCountries] of Object.entries(rawGeoTargets as Record<string, unknown>)) {
          const normalizedKey = normalizeLayerKey(layer, rawKey);
          const normalizedGeo = normalizeGeoCountries(rawCountries);
          if (!normalizedKey || !normalizedGeo) continue;
          mapped[normalizedKey] = normalizedGeo;
        }
        if (Object.keys(mapped).length) {
          entry.geoTargets = mapped;
        }
      }
    }

    layers[layer] = entry;
  }

  return { v: 1, publicId, layers };
}

async function loadLayerIndexDirect(env: Env, publicId: string): Promise<LayerIndex | null> {
  const obj = await env.TOKYO_R2.get(layerIndexPath(publicId));
  if (!obj) return null;
  const payload = (await obj.json().catch(() => null)) as any;
  if (!payload) return null;
  return assertLayerIndexShape(payload, publicId);
}

async function putLayerIndexDirect(env: Env, index: LayerIndex): Promise<void> {
  await env.TOKYO_R2.put(layerIndexPath(index.publicId), prettyStableJson(index), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=300, stale-while-revalidate=600',
    },
  });
}

async function deleteLayerIndexDirect(env: Env, publicId: string): Promise<void> {
  await env.TOKYO_R2.delete(layerIndexPath(publicId));
}

async function removeLayerIndexEntryDirect(env: Env, publicId: string, layer: string, layerKey: string): Promise<void> {
  const index = await loadLayerIndexDirect(env, publicId);
  if (!index?.layers?.[layer]) return;
  const current = index.layers[layer]!;
  const nextKeys = current.keys.filter((key) => key !== layerKey);
  if (!nextKeys.length) {
    delete index.layers[layer];
  } else {
    const nextEntry: LayerIndexEntry = { ...current, keys: nextKeys };
    if (nextEntry.lastPublishedFingerprint) {
      const fp = { ...nextEntry.lastPublishedFingerprint };
      delete fp[layerKey];
      if (!Object.keys(fp).length) {
        delete nextEntry.lastPublishedFingerprint;
      } else {
        nextEntry.lastPublishedFingerprint = fp;
      }
    }
    if (layer === 'locale' && nextEntry.geoTargets) {
      const geo = { ...nextEntry.geoTargets };
      delete geo[layerKey];
      if (!Object.keys(geo).length) {
        delete nextEntry.geoTargets;
      } else {
        nextEntry.geoTargets = geo;
      }
    }
    index.layers[layer] = nextEntry;
  }

  if (!Object.keys(index.layers).length) {
    await deleteLayerIndexDirect(env, publicId);
    return;
  }
  await putLayerIndexDirect(env, index);
}

async function deleteLayerIndex(env: Env, publicId: string): Promise<void> {
  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(`${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/index`, {
      method: 'DELETE',
      headers: buildL10nBridgeHeaders(env),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP index delete failed (${res.status}): ${detail}`);
    }
    return;
  }
  await deleteLayerIndexDirect(env, publicId);
}

async function publishLayerIndex(env: Env, publicId: string): Promise<void> {
  const overlays = await loadInstanceOverlaysForPublicId(env, publicId);
  const layers: Record<string, LayerIndexEntry> = {};

  function ensureLayerEntry(layer: string): LayerIndexEntry {
    if (!layers[layer]) {
      layers[layer] = { keys: [] };
    }
    return layers[layer]!;
  }

  function addLayerKey(layer: string, key: string, baseFingerprint?: string | null, geoTargets?: string[] | null) {
    const entry = ensureLayerEntry(layer);
    if (!entry.keys.includes(key)) {
      entry.keys.push(key);
    }
    if (baseFingerprint && /^[a-f0-9]{64}$/i.test(baseFingerprint)) {
      if (!entry.lastPublishedFingerprint) entry.lastPublishedFingerprint = {};
      entry.lastPublishedFingerprint[key] = baseFingerprint;
    }
    if (geoTargets && layer === 'locale') {
      if (!entry.geoTargets) entry.geoTargets = {};
      entry.geoTargets[key] = geoTargets;
    }
  }

  for (const row of overlays) {
    const layer = normalizeLayer(row.layer);
    const layerKey = layer ? normalizeLayerKey(layer, row.layer_key) : null;
    if (!layer || !layerKey) continue;
    addLayerKey(layer, layerKey, row.base_fingerprint ?? null, row.geo_targets ?? null);
  }

  for (const entry of Object.values(layers)) {
    entry.keys.sort((a, b) => a.localeCompare(b));
  }

  if (!Object.keys(layers).length) {
    await deleteLayerIndex(env, publicId);
    return;
  }

  const index: LayerIndex = { v: 1, publicId, layers };

  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(`${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/index`, {
      method: 'POST',
      headers: buildL10nBridgeHeaders(env, { 'content-type': 'application/json' }),
      body: prettyStableJson(index),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP index publish failed (${res.status}): ${detail}`);
    }
    return;
  }

  await putLayerIndexDirect(env, index);
}

async function handlePutL10nOverlay(
  req: Request,
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string
): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }, { status: 422 });
  }

  let overlay: L10nOverlay;
  try {
    overlay = assertOverlayShape(payload);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid', detail } }, { status: 422 });
  }

  const outName = await putLayerOverlayArtifactDirect(env, publicId, layer, layerKey, overlay, { cleanupOld: true });
  return json({ publicId, layer, layerKey, file: outName }, { status: 200 });
}

async function handleDeleteL10nOverlay(
  req: Request,
  env: Env,
  publicId: string,
  layer: string,
  layerKey: string,
): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;
  const deleted = await deleteLayerArtifactsDirectWithResult(env, publicId, layer, layerKey);
  await removeLayerIndexEntryDirect(env, publicId, layer, layerKey);
  return json({ publicId, layer, layerKey, deleted }, { status: 200 });
}

async function handlePutL10nLayerIndex(req: Request, env: Env, publicId: string): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }, { status: 422 });
  }

  let index: LayerIndex;
  try {
    index = assertLayerIndexShape(payload, publicId);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid', detail } }, { status: 422 });
  }

  if (!Object.keys(index.layers).length) {
    await deleteLayerIndexDirect(env, publicId);
    return json({ publicId, layers: {} }, { status: 200 });
  }

  await putLayerIndexDirect(env, index);
  return json({ publicId, layers: index.layers }, { status: 200 });
}

async function handleDeleteL10nLayerIndex(req: Request, env: Env, publicId: string): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;
  await deleteLayerIndexDirect(env, publicId);
  return json({ publicId, deleted: true }, { status: 200 });
}

export type { InstanceOverlayRow, L10nOverlay, L10nPublishQueueJob, L10nPublishRequest, L10nPublishResult, L10nPublishStateRow };
export { assertOverlayShape, deleteLayerArtifacts, handleDeleteL10nLayerIndex, handleDeleteL10nOverlay, handlePutL10nLayerIndex, handlePutL10nOverlay, loadInstanceOverlayRow, loadL10nBaseSnapshot, normalizeLayer, normalizeLayerKey, normalizePublicId, publishBaseSnapshotArtifact, publishLayerIndex, publishLayerOverlayArtifacts, putBaseSnapshotArtifactDirect };

import { getEntitlementsMatrix } from '@clickeen/ck-policy';
import { normalizeLocaleToken } from '@clickeen/l10n';

type Env = {
  TOKYO_DEV_JWT: string;
  TOKYO_R2: R2Bucket;
  USAGE_KV?: KVNamespace;
  L10N_PUBLISH_QUEUE?: Queue<L10nPublishQueueJob>;
  RENDER_SNAPSHOT_QUEUE?: Queue<RenderSnapshotQueueJob>;
  VENICE_BASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TOKYO_L10N_HTTP_BASE?: string;
};

function json(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}

function asBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;
  return token.trim() || null;
}

function requireDevAuth(req: Request, env: Env): Response | null {
  const expected = (env.TOKYO_DEV_JWT || '').trim();
  if (!expected) {
    return json({ error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.misconfigured' } }, { status: 500 });
  }
  const token = asBearerToken(req.headers.get('authorization'));
  if (!token) return json({ error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } }, { status: 401 });
  if (token !== expected) return json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 });
  return null;
}

function requireSupabaseEnv(env: Env, key: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = env[key];
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error(`[tokyo] Missing required env var: ${key}`);
  }
  return value.trim();
}

function resolveL10nHttpBase(env: Env): string | null {
  const raw = typeof env.TOKYO_L10N_HTTP_BASE === 'string' ? env.TOKYO_L10N_HTTP_BASE.trim() : '';
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

const TOKYO_L10N_BRIDGE_HEADER = 'x-tokyo-l10n-bridge';

function buildL10nBridgeHeaders(env: Env, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set(TOKYO_L10N_BRIDGE_HEADER, '1');
  const token = (env.TOKYO_DEV_JWT || '').trim();
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return headers;
}

async function supabaseFetch(env: Env, pathnameWithQuery: string, init?: RequestInit) {
  const baseUrl = requireSupabaseEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const key = requireSupabaseEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const headers = new Headers(init?.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
  return fetch(`${baseUrl}${pathnameWithQuery}`, { ...init, headers });
}

function isUuid(value: string): boolean {
  // Dev/staging tolerate non-v4 UUIDs (e.g. deterministic ck-dev workspace ids).
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function extFromMime(mime: string): string | null {
  const mt = String(mime || '').toLowerCase();
  if (mt === 'image/png') return 'png';
  if (mt === 'image/jpeg') return 'jpg';
  if (mt === 'image/webp') return 'webp';
  if (mt === 'image/gif') return 'gif';
  if (mt === 'image/svg+xml') return 'svg';
  if (mt === 'video/mp4') return 'mp4';
  if (mt === 'video/webm') return 'webm';
  if (mt === 'application/pdf') return 'pdf';
  return null;
}

function pickExtension(filename: string | null, contentType: string | null): string {
  const rawName = String(filename || '').trim();
  const fromName = rawName ? rawName.split('.').pop()?.toLowerCase() : '';
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const fromMime = extFromMime(String(contentType || '').trim());
  if (fromMime) return fromMime;
  return 'bin';
}

function sanitizeUploadFilename(filename: string | null, ext: string): string {
  const raw = String(filename || '').trim();
  const basename = raw.split(/[\\/]/).pop() || '';
  const stripped = basename.split('?')[0].split('#')[0];
  const stemRaw = stripped.replace(/\.[^.]+$/, '');
  const normalizedStem = stemRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const safeStem = (normalizedStem || 'upload').slice(0, 64);
  const safeExt = String(ext || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'bin';
  return `${safeStem}.${safeExt}`;
}

function guessContentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'css':
      return 'text/css; charset=utf-8';
    case 'js':
      return 'text/javascript; charset=utf-8';
    case 'html':
      return 'text/html; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'svg':
      return 'image/svg+xml; charset=utf-8';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  headers.set(
    'access-control-allow-headers',
    'authorization, content-type, x-account-id, x-workspace-id, x-filename, x-variant, x-public-id, x-widget-type, x-source, x-tokyo-l10n-bridge',
  );
  return new Response(res.body, { status: res.status, headers });
}

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

type RenderSnapshotQueueJob = {
  v: 1;
  kind: 'render-snapshot';
  publicId: string;
  action?: 'upsert' | 'delete';
  locales?: string[];
};

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

function normalizePublicId(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const okMain = /^wgt_main_[a-z0-9][a-z0-9_-]*$/i.test(value);
  const okCurated =
    /^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/i.test(value);
  const okUser = /^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$/i.test(value);
  if (!okMain && !okCurated && !okUser) return null;
  return value;
}

function normalizeCuratedPublicId(raw: string): string | null {
  const value = normalizePublicId(raw);
  if (!value) return null;
  if (value.startsWith('wgt_curated_') || value.startsWith('wgt_main_')) return value;
  return null;
}

function normalizeWidgetType(raw: string): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) return null;
  return value;
}

function normalizeLocale(raw: unknown): string | null {
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

function prettyStableJson(value: any): string {
  const parsed = JSON.parse(stableStringify(value));
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

function normalizeSha256Hex(raw: unknown): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!SHA256_HEX_RE.test(value)) return null;
  return value;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
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

const L10N_VERSION_CAP_KEY = 'l10n.versions.max';
const DEFAULT_L10N_VERSION_LIMIT = 1;
const UPLOAD_SIZE_CAP_KEY = 'uploads.size.max';
const UPLOADS_COUNT_BUDGET_KEY = 'budget.uploads.count';
const DEFAULT_UPLOAD_SIZE_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_UPLOADS_COUNT_MAX = 5;
const UPLOADS_BYTES_BUDGET_KEY = 'budget.uploads.bytes';
const DEFAULT_UPLOADS_BYTES_MAX = DEFAULT_UPLOAD_SIZE_MAX_BYTES * DEFAULT_UPLOADS_COUNT_MAX;

function getUtcPeriodKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

async function readKvCounter(kv: KVNamespace, key: string): Promise<number> {
  const raw = await kv.get(key);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

async function consumeWorkspaceBudget(args: {
  env: Env;
  workspaceId: string;
  budgetKey: string;
  max: number | null;
  amount?: number;
}): Promise<
  | { ok: true; used: number; nextUsed: number }
  | { ok: false; used: number; max: number; reasonKey: 'coreui.upsell.reason.budgetExceeded'; detail: string }
> {
  const amount = typeof args.amount === 'number' ? args.amount : 1;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('[tokyo] consumeWorkspaceBudget amount must be positive');
  if (args.max == null) return { ok: true, used: 0, nextUsed: amount };
  const max = Math.max(0, Math.floor(args.max));
  const kv = args.env.USAGE_KV;
  if (!kv) return { ok: true, used: 0, nextUsed: amount };

  const periodKey = getUtcPeriodKey(new Date());
  const counterKey = `usage.budget.v1.${args.budgetKey}.${periodKey}.ws:${args.workspaceId}`;
  const used = await readKvCounter(kv, counterKey);
  const nextUsed = used + amount;
  if (nextUsed > max) {
    return {
      ok: false,
      used,
      max,
      reasonKey: 'coreui.upsell.reason.budgetExceeded',
      detail: `${args.budgetKey} budget exceeded (max=${max})`,
    };
  }

  await kv.put(counterKey, String(nextUsed), { expirationTtl: 400 * 24 * 60 * 60 });
  return { ok: true, used, nextUsed };
}

async function consumeAccountBudget(args: {
  env: Env;
  accountId: string;
  budgetKey: string;
  max: number | null;
  amount?: number;
}): Promise<
  | { ok: true; used: number; nextUsed: number }
  | { ok: false; used: number; max: number; reasonKey: 'coreui.upsell.reason.budgetExceeded'; detail: string }
> {
  const amount = typeof args.amount === 'number' ? args.amount : 1;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('[tokyo] consumeAccountBudget amount must be positive');
  if (args.max == null) return { ok: true, used: 0, nextUsed: amount };
  const max = Math.max(0, Math.floor(args.max));
  const kv = args.env.USAGE_KV;
  if (!kv) return { ok: true, used: 0, nextUsed: amount };

  const periodKey = getUtcPeriodKey(new Date());
  const counterKey = `usage.budget.v1.${args.budgetKey}.${periodKey}.acct:${args.accountId}`;
  const used = await readKvCounter(kv, counterKey);
  const nextUsed = used + amount;
  if (nextUsed > max) {
    return {
      ok: false,
      used,
      max,
      reasonKey: 'coreui.upsell.reason.budgetExceeded',
      detail: `${args.budgetKey} budget exceeded (max=${max})`,
    };
  }

  await kv.put(counterKey, String(nextUsed), { expirationTtl: 400 * 24 * 60 * 60 });
  return { ok: true, used, nextUsed };
}

function resolveL10nVersionLimit(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[L10N_VERSION_CAP_KEY];
  if (!entry || entry.kind !== 'cap') return DEFAULT_L10N_VERSION_LIMIT;
  const fallback = 'free' as keyof typeof entry.values;
  const profile = (matrix.tiers.includes(tier as typeof matrix.tiers[number])
    ? (tier as typeof matrix.tiers[number])
    : fallback) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_L10N_VERSION_LIMIT;
  return Math.max(1, Math.floor(value));
}

function resolveUploadSizeLimitBytes(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[UPLOAD_SIZE_CAP_KEY];
  if (!entry || entry.kind !== 'cap') return DEFAULT_UPLOAD_SIZE_MAX_BYTES;
  const fallback = 'free' as keyof typeof entry.values;
  const profile = (matrix.tiers.includes(tier as typeof matrix.tiers[number])
    ? (tier as typeof matrix.tiers[number])
    : fallback) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DEFAULT_UPLOAD_SIZE_MAX_BYTES;
  return Math.max(1, Math.floor(value));
}

function resolveUploadsCountBudgetMax(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[UPLOADS_COUNT_BUDGET_KEY];
  if (!entry || entry.kind !== 'budget') return DEFAULT_UPLOADS_COUNT_MAX;
  const fallback = 'free' as keyof typeof entry.values;
  const profile = (matrix.tiers.includes(tier as typeof matrix.tiers[number])
    ? (tier as typeof matrix.tiers[number])
    : fallback) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return DEFAULT_UPLOADS_COUNT_MAX;
  return Math.floor(value);
}

function resolveUploadsBytesBudgetMax(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[UPLOADS_BYTES_BUDGET_KEY];
  if (!entry || entry.kind !== 'budget') return DEFAULT_UPLOADS_BYTES_MAX;
  const fallback = 'free' as keyof typeof entry.values;
  const profile = (matrix.tiers.includes(tier as typeof matrix.tiers[number])
    ? (tier as typeof matrix.tiers[number])
    : fallback) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return DEFAULT_UPLOADS_BYTES_MAX;
  return Math.floor(value);
}

async function loadWorkspaceTier(env: Env, workspaceId: string): Promise<string | null> {
  if (!isUuid(workspaceId)) return null;
  const params = new URLSearchParams({
    select: 'tier',
    id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase workspace read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ tier?: string | null }>;
  return rows?.[0]?.tier ?? null;
}

type WorkspaceUploadContext = {
  tier: string | null;
  accountId: string | null;
};

async function loadWorkspaceUploadContext(env: Env, workspaceId: string): Promise<WorkspaceUploadContext | null> {
  if (!isUuid(workspaceId)) return null;
  const params = new URLSearchParams({
    select: 'tier,account_id',
    id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase workspace read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{
    tier?: string | null;
    account_id?: string | null;
  }>;
  const row = rows?.[0];
  if (!row) return null;
  return {
    tier: typeof row.tier === 'string' ? row.tier : null,
    accountId: typeof row.account_id === 'string' ? row.account_id : null,
  };
}

type AccountAssetSource = 'bob.publish' | 'bob.export' | 'devstudio' | 'promotion' | 'api';

function normalizeAccountAssetSource(raw: string | null): AccountAssetSource | null {
  const value = String(raw || '').trim();
  if (!value) return 'api';
  if (value === 'bob.publish' || value === 'bob.export' || value === 'devstudio' || value === 'promotion' || value === 'api') {
    return value;
  }
  return null;
}

type AccountUploadProfile = {
  status: 'active' | 'disabled';
  isPlatform: boolean;
};

async function loadAccountUploadProfile(env: Env, accountId: string): Promise<AccountUploadProfile | null> {
  if (!isUuid(accountId)) return null;
  const params = new URLSearchParams({
    select: 'status,is_platform',
    id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/accounts?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ status?: unknown; is_platform?: unknown }>;
  const row = rows?.[0];
  if (!row) return null;
  const status = row.status === 'disabled' ? 'disabled' : row.status === 'active' ? 'active' : null;
  if (!status) return null;
  return {
    status,
    isPlatform: row.is_platform === true,
  };
}

async function persistAccountAssetMetadata(args: {
  env: Env;
  accountId: string;
  assetId: string;
  variant: string;
  key: string;
  source: AccountAssetSource;
  originalFilename: string;
  normalizedFilename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  workspaceId?: string | null;
  publicId?: string | null;
  widgetType?: string | null;
}): Promise<void> {
  const assetRow = {
    asset_id: args.assetId,
    account_id: args.accountId,
    workspace_id: args.workspaceId ?? null,
    public_id: args.publicId ?? null,
    widget_type: args.widgetType ?? null,
    source: args.source,
    original_filename: args.originalFilename,
    normalized_filename: args.normalizedFilename,
    content_type: args.contentType,
    size_bytes: args.sizeBytes,
    sha256: args.sha256,
  };
  const assetRes = await supabaseFetch(args.env, '/rest/v1/account_assets', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(assetRow),
  });
  if (!assetRes.ok) {
    const text = await assetRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_assets insert failed (${assetRes.status}) ${text}`.trim());
  }

  const variantRow = {
    asset_id: args.assetId,
    account_id: args.accountId,
    variant: args.variant,
    r2_key: args.key,
    filename: args.normalizedFilename,
    content_type: args.contentType,
    size_bytes: args.sizeBytes,
  };
  const variantRes = await supabaseFetch(args.env, '/rest/v1/account_asset_variants', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(variantRow),
  });
  if (!variantRes.ok) {
    const text = await variantRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_variants insert failed (${variantRes.status}) ${text}`.trim());
  }
}

type DeletedAccountAssetRow = {
  asset_id: string;
  account_id: string;
  deleted_at: string;
};

type DeletedAccountAssetVariantRow = {
  asset_id: string;
  r2_key: string;
};

function parseBooleanFlag(raw: string | null): boolean {
  const value = String(raw || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

async function loadDeletedAccountAssetsForPurge(env: Env, cutoffIso: string, limit: number): Promise<DeletedAccountAssetRow[]> {
  const params = new URLSearchParams({
    select: 'asset_id,account_id,deleted_at',
    deleted_at: `lte.${cutoffIso}`,
    order: 'deleted_at.asc',
    limit: String(limit),
  });
  const res = await supabaseFetch(env, `/rest/v1/account_assets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase deleted account_assets list failed (${res.status}) ${text}`.trim());
  }
  return ((await res.json().catch(() => [])) as DeletedAccountAssetRow[]).filter(
    (row) => Boolean(row?.asset_id && row?.account_id),
  );
}

async function loadDeletedAccountAssetVariantKeys(
  env: Env,
  assetIds: string[],
): Promise<DeletedAccountAssetVariantRow[]> {
  if (!assetIds.length) return [];
  const params = new URLSearchParams({
    select: 'asset_id,r2_key',
    asset_id: `in.(${assetIds.join(',')})`,
    limit: String(Math.max(200, assetIds.length * 8)),
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_variants?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_variants list failed (${res.status}) ${text}`.trim());
  }
  return ((await res.json().catch(() => [])) as DeletedAccountAssetVariantRow[]).filter((row) =>
    Boolean(row?.asset_id && row?.r2_key),
  );
}

async function deleteDeletedAccountAssetsAndVariants(env: Env, assetIds: string[], cutoffIso: string): Promise<void> {
  if (!assetIds.length) return;

  const variantsDeleteParams = new URLSearchParams({
    asset_id: `in.(${assetIds.join(',')})`,
  });
  const deleteVariantsRes = await supabaseFetch(env, `/rest/v1/account_asset_variants?${variantsDeleteParams.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!deleteVariantsRes.ok) {
    const text = await deleteVariantsRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_variants delete failed (${deleteVariantsRes.status}) ${text}`.trim());
  }

  const assetsDeleteParams = new URLSearchParams({
    asset_id: `in.(${assetIds.join(',')})`,
    deleted_at: `lte.${cutoffIso}`,
  });
  const deleteAssetsRes = await supabaseFetch(env, `/rest/v1/account_assets?${assetsDeleteParams.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!deleteAssetsRes.ok) {
    const text = await deleteAssetsRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_assets delete failed (${deleteAssetsRes.status}) ${text}`.trim());
  }
}

async function handlePurgeDeletedAccountAssets(req: Request, env: Env): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const dryRun = parseBooleanFlag(url.searchParams.get('dryRun'));
  const limit = parseBoundedInt(url.searchParams.get('limit'), 100, 1, 200);
  const retentionDays = parseBoundedInt(url.searchParams.get('retentionDays'), 30, 1, 365);
  const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const candidates = await loadDeletedAccountAssetsForPurge(env, cutoffIso, limit);
  if (!candidates.length) {
    return json({
      ok: true,
      dryRun,
      retentionDays,
      cutoffIso,
      candidates: 0,
      purgedAssets: 0,
      purgedObjects: 0,
    });
  }

  const assetIds = candidates.map((candidate) => candidate.asset_id);
  const variantRows = await loadDeletedAccountAssetVariantKeys(env, assetIds);

  if (dryRun) {
    return json({
      ok: true,
      dryRun: true,
      retentionDays,
      cutoffIso,
      candidates: candidates.length,
      candidateAssetIds: assetIds,
      candidateObjects: variantRows.length,
    });
  }

  for (const row of variantRows) {
    await env.TOKYO_R2.delete(row.r2_key);
  }

  await deleteDeletedAccountAssetsAndVariants(env, assetIds, cutoffIso);
  return json({
    ok: true,
    dryRun: false,
    retentionDays,
    cutoffIso,
    candidates: candidates.length,
    purgedAssets: assetIds.length,
    purgedObjects: variantRows.length,
  });
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

async function handleUploadAccountAsset(req: Request, env: Env): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  const accountId = (req.headers.get('x-account-id') || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }

  const account = await loadAccountUploadProfile(env, accountId);
  if (!account) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } }, { status: 404 });
  }
  if (account.status !== 'active') {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.account.disabled' } }, { status: 403 });
  }

  const source = normalizeAccountAssetSource(req.headers.get('x-source'));
  if (!source) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.source.invalid' } }, { status: 422 });
  }

  const workspaceId = (req.headers.get('x-workspace-id') || '').trim();
  let tier: string | null = account.isPlatform ? 'devstudio' : null;
  if (workspaceId) {
    if (!isUuid(workspaceId)) {
      return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }, { status: 422 });
    }
    const workspace = await loadWorkspaceUploadContext(env, workspaceId);
    if (!workspace) {
      return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }, { status: 422 });
    }
    if (!workspace.accountId || workspace.accountId !== accountId) {
      return json(
        { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.account.workspaceMismatch' } },
        { status: 422 },
      );
    }
    tier = workspace.tier ?? tier;
  }

  const publicIdRaw = (req.headers.get('x-public-id') || '').trim();
  const publicId = publicIdRaw ? normalizePublicId(publicIdRaw) : null;
  if (publicIdRaw && !publicId) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } }, { status: 422 });
  }

  const widgetTypeRaw = (req.headers.get('x-widget-type') || '').trim();
  const widgetType = widgetTypeRaw ? normalizeWidgetType(widgetTypeRaw) : null;
  if (widgetTypeRaw && !widgetType) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } }, { status: 422 });
  }

  const variant = (req.headers.get('x-variant') || '').trim() || 'original';
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(variant)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.variant.invalid' } }, { status: 422 });
  }

  const filename = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const ext = pickExtension(filename, contentType);
  const safeFilename = sanitizeUploadFilename(filename, ext);

  const maxBytes = resolveUploadSizeLimitBytes(tier);
  const contentLengthRaw = (req.headers.get('content-length') || '').trim();
  const contentLength = contentLengthRaw ? Number.parseInt(contentLengthRaw, 10) : NaN;
  if (maxBytes != null && Number.isFinite(contentLength) && contentLength > maxBytes) {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.capReached',
          upsell: 'UP',
          detail: `${UPLOAD_SIZE_CAP_KEY}=${maxBytes}`,
        },
      },
      { status: 413 },
    );
  }

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }
  if (maxBytes != null && body.byteLength > maxBytes) {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.capReached',
          upsell: 'UP',
          detail: `${UPLOAD_SIZE_CAP_KEY}=${maxBytes}`,
        },
      },
      { status: 413 },
    );
  }

  const uploadsMax = account.isPlatform ? null : resolveUploadsCountBudgetMax(tier);
  const uploadsBytesMax = account.isPlatform ? null : resolveUploadsBytesBudgetMax(tier);

  const bytesBudget = await consumeAccountBudget({
    env,
    accountId,
    budgetKey: UPLOADS_BYTES_BUDGET_KEY,
    max: uploadsBytesMax,
    amount: body.byteLength,
  });
  if (!bytesBudget.ok) {
    return json(
      { error: { kind: 'DENY', reasonKey: bytesBudget.reasonKey, upsell: 'UP', detail: bytesBudget.detail } },
      { status: 403 },
    );
  }

  const uploadBudget = await consumeAccountBudget({
    env,
    accountId,
    budgetKey: UPLOADS_COUNT_BUDGET_KEY,
    max: uploadsMax,
    amount: 1,
  });
  if (!uploadBudget.ok) {
    return json(
      { error: { kind: 'DENY', reasonKey: uploadBudget.reasonKey, upsell: 'UP', detail: uploadBudget.detail } },
      { status: 403 },
    );
  }

  const assetId = crypto.randomUUID();
  const key = `assets/accounts/${accountId}/${assetId}/${variant}/${safeFilename}`;
  await env.TOKYO_R2.put(key, body, { httpMetadata: { contentType } });

  try {
    await persistAccountAssetMetadata({
      env,
      accountId,
      assetId,
      variant,
      key,
      source,
      originalFilename: filename,
      normalizedFilename: safeFilename,
      contentType,
      sizeBytes: body.byteLength,
      sha256: await sha256Hex(body),
      workspaceId: workspaceId || null,
      publicId,
      widgetType,
    });
  } catch (error) {
    await env.TOKYO_R2.delete(key);
    const detail = error instanceof Error ? error.message : String(error);
    return json(
      { error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.assets.metadataWriteFailed', detail } },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const url = `${origin}/${key}`;
  return json(
    {
      accountId,
      assetId,
      variant,
      filename: safeFilename,
      ext,
      contentType,
      sizeBytes: body.byteLength,
      key,
      url,
      source,
      workspaceId: workspaceId || null,
      publicId: publicId ?? null,
      widgetType: widgetType ?? null,
    },
    { status: 200 },
  );
}

async function handleUploadWorkspaceAsset(req: Request, env: Env): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  const workspaceId = (req.headers.get('x-workspace-id') || '').trim();
  if (!workspaceId || !isUuid(workspaceId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }, { status: 422 });
  }

  const tier = await loadWorkspaceTier(env, workspaceId).catch(() => null);

  const variant = (req.headers.get('x-variant') || '').trim() || 'original';
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(variant)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.variant.invalid' } }, { status: 422 });
  }

  const filename = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const ext = pickExtension(filename, contentType);
  const safeFilename = sanitizeUploadFilename(filename, ext);

  const maxBytes = resolveUploadSizeLimitBytes(tier);
  const contentLengthRaw = (req.headers.get('content-length') || '').trim();
  const contentLength = contentLengthRaw ? Number.parseInt(contentLengthRaw, 10) : NaN;
  if (maxBytes != null && Number.isFinite(contentLength) && contentLength > maxBytes) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'coreui.upsell.reason.capReached', upsell: 'UP', detail: `${UPLOAD_SIZE_CAP_KEY}=${maxBytes}` } },
      { status: 413 },
    );
  }

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }
  if (maxBytes != null && body.byteLength > maxBytes) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'coreui.upsell.reason.capReached', upsell: 'UP', detail: `${UPLOAD_SIZE_CAP_KEY}=${maxBytes}` } },
      { status: 413 },
    );
  }

  const uploadsMax = resolveUploadsCountBudgetMax(tier);
  const uploadsBytesMax = resolveUploadsBytesBudgetMax(tier);

  const bytesBudget = await consumeWorkspaceBudget({
    env,
    workspaceId,
    budgetKey: UPLOADS_BYTES_BUDGET_KEY,
    max: uploadsBytesMax,
    amount: body.byteLength,
  });
  if (!bytesBudget.ok) {
    return json({ error: { kind: 'DENY', reasonKey: bytesBudget.reasonKey, upsell: 'UP', detail: bytesBudget.detail } }, { status: 403 });
  }

  const uploadBudget = await consumeWorkspaceBudget({
    env,
    workspaceId,
    budgetKey: UPLOADS_COUNT_BUDGET_KEY,
    max: uploadsMax,
    amount: 1,
  });
  if (!uploadBudget.ok) {
    return json({ error: { kind: 'DENY', reasonKey: uploadBudget.reasonKey, upsell: 'UP', detail: uploadBudget.detail } }, { status: 403 });
  }

  const assetId = crypto.randomUUID();
  const key = `workspace-assets/${workspaceId}/${assetId}/${variant}/${safeFilename}`;
  await env.TOKYO_R2.put(key, body, { httpMetadata: { contentType } });

  const origin = new URL(req.url).origin;
  const url = `${origin}/${key}`;
  return json({ workspaceId, assetId, variant, ext, key, url }, { status: 200 });
}

async function handleUploadCuratedAsset(req: Request, env: Env): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  const publicId = normalizeCuratedPublicId(req.headers.get('x-public-id') || '');
  if (!publicId) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } }, { status: 422 });
  }

  const widgetType = normalizeWidgetType(req.headers.get('x-widget-type') || '');
  if (!widgetType) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } }, { status: 422 });
  }

  const variant = (req.headers.get('x-variant') || '').trim() || 'original';
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(variant)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.variant.invalid' } }, { status: 422 });
  }

  const filename = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const ext = pickExtension(filename, contentType);
  const safeFilename = sanitizeUploadFilename(filename, ext);

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }

  const assetId = crypto.randomUUID();
  const key = `curated-assets/${widgetType}/${publicId}/${assetId}/${variant}/${safeFilename}`;
  await env.TOKYO_R2.put(key, body, { httpMetadata: { contentType } });

  const origin = new URL(req.url).origin;
  const url = `${origin}/${key}`;
  return json({ publicId, widgetType, assetId, variant, ext, key, url }, { status: 200 });
}

async function handleGetWorkspaceAsset(req: Request, env: Env, key: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { status: 200, headers });
}

async function handleGetCuratedAsset(req: Request, env: Env, key: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { status: 200, headers });
}

type RenderIndexEntry = { e: string; r: string; meta: string };

type RenderIndex = {
  v: 1;
  publicId: string;
  current: Record<string, RenderIndexEntry>;
};

type InstanceEnforcementState = {
  mode: 'frozen';
  periodKey: string;
  frozenAt: string;
  resetAt: string;
};

async function loadInstanceEnforcement(env: Env, publicId: string): Promise<InstanceEnforcementState | null> {
  try {
    const params = new URLSearchParams({
      select: 'public_id,mode,period_key,frozen_at,reset_at',
      public_id: `eq.${publicId}`,
      limit: '1',
    });
    const res = await supabaseFetch(env, `/rest/v1/instance_enforcement_state?${params.toString()}`, { method: 'GET' });
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => null)) as Array<{
      public_id?: unknown;
      mode?: unknown;
      period_key?: unknown;
      frozen_at?: unknown;
      reset_at?: unknown;
    }> | null;
    const row = rows?.[0];
    if (!row) return null;
    if (row.mode !== 'frozen') return null;
    const resetAt = typeof row.reset_at === 'string' ? row.reset_at : '';
    const resetMs = resetAt ? Date.parse(resetAt) : NaN;
    if (!Number.isFinite(resetMs) || resetMs <= Date.now()) return null;
    const periodKey = typeof row.period_key === 'string' ? row.period_key : '';
    const frozenAt = typeof row.frozen_at === 'string' ? row.frozen_at : '';
    return {
      mode: 'frozen',
      periodKey,
      frozenAt,
      resetAt,
    };
  } catch {
    return null;
  }
}

function resolveVeniceBase(env: Env): string {
  const raw = typeof env.VENICE_BASE_URL === 'string' ? env.VENICE_BASE_URL.trim() : '';
  if (!raw) throw new Error('[tokyo] Missing VENICE_BASE_URL for render snapshot generation');
  return raw.replace(/\/+$/, '');
}

function isRenderSnapshotJob(value: unknown): value is RenderSnapshotQueueJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const job = value as any;
  if (job.v !== 1) return false;
  if (job.kind !== 'render-snapshot') return false;
  return typeof job.publicId === 'string';
}

function normalizeRenderLocales(locales: unknown): string[] {
  if (!Array.isArray(locales)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  locales.forEach((raw) => {
    const normalized = normalizeLocale(raw);
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

function renderIndexKey(publicId: string): string {
  return `renders/instances/${publicId}/index.json`;
}

function renderArtifactKey(publicId: string, fingerprint: string, filename: 'e.html' | 'r.json' | 'meta.json'): string {
  return `renders/instances/${publicId}/${fingerprint}/${filename}`;
}

function assertRenderIndexShape(payload: any, publicId: string): RenderIndex {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('[tokyo] render index must be an object');
  }
  if (payload.v !== 1) throw new Error('[tokyo] render index.v must be 1');
  const pid = typeof payload.publicId === 'string' ? payload.publicId.trim() : '';
  if (pid && pid !== publicId) throw new Error('[tokyo] render index.publicId mismatch');
  const current = payload.current;
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    throw new Error('[tokyo] render index.current must be an object');
  }

  const normalized: Record<string, RenderIndexEntry> = {};
  for (const [rawLocale, entry] of Object.entries(current)) {
    const locale = normalizeLocale(rawLocale);
    if (!locale || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const e = normalizeSha256Hex((entry as any).e);
    const r = normalizeSha256Hex((entry as any).r);
    const meta = normalizeSha256Hex((entry as any).meta);
    if (!e || !r || !meta) continue;
    normalized[locale] = { e, r, meta };
  }

  return { v: 1, publicId, current: normalized };
}

async function loadRenderIndex(env: Env, publicId: string): Promise<RenderIndex | null> {
  const obj = await env.TOKYO_R2.get(renderIndexKey(publicId));
  if (!obj) return null;
  const json = (await obj.json().catch(() => null)) as any;
  if (!json) return null;
  return assertRenderIndexShape(json, publicId);
}

async function putRenderIndex(env: Env, publicId: string, index: RenderIndex): Promise<void> {
  await env.TOKYO_R2.put(renderIndexKey(publicId), prettyStableJson(index), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function deleteRenderIndex(env: Env, publicId: string): Promise<void> {
  await env.TOKYO_R2.delete(renderIndexKey(publicId));
}

async function fetchVeniceBytes(
  env: Env,
  pathnameWithQuery: string,
  opts?: { headers?: Record<string, string> },
): Promise<{ bytes: ArrayBuffer; contentType: string | null; effectiveLocale: string | null; l10nStatus: string | null }> {
  const base = resolveVeniceBase(env);
  const headers: Record<string, string> = {
    'X-Request-ID': crypto.randomUUID(),
    ...opts?.headers,
  };
  const res = await fetch(`${base}${pathnameWithQuery.startsWith('/') ? pathnameWithQuery : `/${pathnameWithQuery}`}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[tokyo] Venice snapshot fetch failed (${res.status}) ${detail}`.trim());
  }
  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get('content-type');
  const effectiveLocale = res.headers.get('x-ck-l10n-effective-locale') ?? res.headers.get('X-Ck-L10n-Effective-Locale');
  const l10nStatus = res.headers.get('x-ck-l10n-status') ?? res.headers.get('X-Ck-L10n-Status');
  return { bytes, contentType, effectiveLocale: effectiveLocale ? effectiveLocale.trim() : null, l10nStatus: l10nStatus ? l10nStatus.trim() : null };
}

async function putImmutableRenderArtifact(args: {
  env: Env;
  publicId: string;
  filename: 'e.html' | 'r.json' | 'meta.json';
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<string> {
  const fingerprint = await sha256Hex(args.bytes);
  const key = renderArtifactKey(args.publicId, fingerprint, args.filename);
  await args.env.TOKYO_R2.put(key, args.bytes, {
    httpMetadata: { contentType: args.contentType },
  });
  return fingerprint;
}

async function generateRenderSnapshots(args: {
  env: Env;
  publicId: string;
  locales: string[];
}): Promise<void> {
  const { env, publicId } = args;
  const enforcement = await loadInstanceEnforcement(env, publicId);
  const requestedLocales = args.locales.length ? args.locales : ['en'];
  const locales = enforcement ? ['en'] : Array.from(new Set(['en', ...requestedLocales]));
  const existing = enforcement ? null : await loadRenderIndex(env, publicId).catch(() => null);
  const nextCurrent: Record<string, RenderIndexEntry> = existing?.current ? { ...existing.current } : {};

  for (const locale of locales) {
    const bypassHeaders = { 'X-Ck-Snapshot-Bypass': '1' };
    const enforcementQuery = enforcement
      ? `&enforcement=frozen&frozenAt=${encodeURIComponent(enforcement.frozenAt)}&resetAt=${encodeURIComponent(
          enforcement.resetAt,
        )}`
      : '';
    const e = await fetchVeniceBytes(
      env,
      `/e/${encodeURIComponent(publicId)}?locale=${encodeURIComponent(locale)}${enforcementQuery}`,
      {
      headers: bypassHeaders,
      },
    );
    const effectiveLocale = normalizeLocale(e.effectiveLocale);
    if (locale !== 'en' && effectiveLocale !== locale) {
      delete nextCurrent[locale];
      continue;
    }
    const r = await fetchVeniceBytes(
      env,
      `/r/${encodeURIComponent(publicId)}?locale=${encodeURIComponent(locale)}${enforcementQuery}`,
      {
      headers: bypassHeaders,
      },
    );
    const meta = await fetchVeniceBytes(
      env,
      `/r/${encodeURIComponent(publicId)}?locale=${encodeURIComponent(locale)}&meta=1${enforcementQuery}`,
      {
      headers: bypassHeaders,
      },
    );

    const eFp = await putImmutableRenderArtifact({
      env,
      publicId,
      filename: 'e.html',
      bytes: e.bytes,
      contentType: e.contentType || 'text/html; charset=utf-8',
    });
    const rFp = await putImmutableRenderArtifact({
      env,
      publicId,
      filename: 'r.json',
      bytes: r.bytes,
      contentType: r.contentType || 'application/json; charset=utf-8',
    });
    const metaFp = await putImmutableRenderArtifact({
      env,
      publicId,
      filename: 'meta.json',
      bytes: meta.bytes,
      contentType: meta.contentType || 'application/json; charset=utf-8',
    });

    nextCurrent[locale] = { e: eFp, r: rFp, meta: metaFp };
  }

  const index: RenderIndex = { v: 1, publicId, current: nextCurrent };
  await putRenderIndex(env, publicId, index);
}

async function handleGetRenderObject(env: Env, key: string, cacheControl: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  return new Response(obj.body, { status: 200, headers });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'OPTIONS') {
        return withCors(new Response(null, { status: 204 }));
      }

      if (pathname === '/healthz') {
        return withCors(json({ up: true }, { status: 200 }));
      }

      const renderIndexMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/index\.json$/);
      if (renderIndexMatch) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(renderIndexMatch[1]));
        if (!publicId) return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        return withCors(await handleGetRenderObject(env, renderIndexKey(publicId), 'public, max-age=60, s-maxage=60'));
      }

      const renderArtifactMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/([^/]+)\/(e\.html|r\.json|meta\.json)$/);
      if (renderArtifactMatch) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(renderArtifactMatch[1]));
        const fingerprint = normalizeSha256Hex(decodeURIComponent(renderArtifactMatch[2]));
        const filename = renderArtifactMatch[3] as 'e.html' | 'r.json' | 'meta.json';
        if (!publicId || !fingerprint) {
          return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        }
        return withCors(
          await handleGetRenderObject(
            env,
            renderArtifactKey(publicId, fingerprint, filename),
            'public, max-age=31536000, immutable',
          ),
        );
      }

      const renderSnapshotMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/snapshot$/);
      if (renderSnapshotMatch) {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const authError = requireDevAuth(req, env);
        if (authError) return withCors(authError);
        const publicId = normalizePublicId(decodeURIComponent(renderSnapshotMatch[1]));
        if (!publicId) return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        let payload: { action?: string; locales?: unknown } | null = null;
        try {
          payload = (await req.json()) as any;
        } catch {
          payload = null;
        }
        const action = payload?.action === 'delete' ? 'delete' : 'upsert';
        if (action === 'delete') {
          await deleteRenderIndex(env, publicId);
          return withCors(json({ ok: true, publicId, action }, { status: 200 }));
        }
        const locales = normalizeRenderLocales(payload?.locales);
        await generateRenderSnapshots({ env, publicId, locales: locales.length ? locales : ['en'] });
        return withCors(json({ ok: true, publicId, action, locales: locales.length ? locales : ['en'] }, { status: 200 }));
      }

      if (pathname === '/l10n/publish') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handlePublishLocaleRequest(req, env));
      }

      if (pathname === '/assets/purge-deleted') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handlePurgeDeletedAccountAssets(req, env));
      }

      if (pathname === '/workspace-assets/upload') {
        return withCors(
          json(
            { error: { kind: 'DENY', reasonKey: 'tokyo.errors.assets.legacyUploadRemoved', detail: 'Use POST /assets/upload' } },
            { status: 410 },
          ),
        );
      }

      if (pathname === '/assets/upload') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handleUploadAccountAsset(req, env));
      }

      if (pathname.startsWith('/assets/accounts/')) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const key = pathname.replace(/^\//, '');
        return withCors(await handleGetWorkspaceAsset(req, env, key));
      }

      if (pathname.startsWith('/workspace-assets/')) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const key = pathname.replace(/^\//, '');
        return withCors(await handleGetWorkspaceAsset(req, env, key));
      }

      if (pathname === '/curated-assets/upload') {
        return withCors(
          json(
            { error: { kind: 'DENY', reasonKey: 'tokyo.errors.assets.legacyUploadRemoved', detail: 'Use POST /assets/upload' } },
            { status: 410 },
          ),
        );
      }

      if (pathname.startsWith('/curated-assets/')) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const key = pathname.replace(/^\//, '');
        return withCors(await handleGetCuratedAsset(req, env, key));
      }

      const l10nIndexMatch = pathname.match(/^\/l10n\/instances\/([^/]+)\/index$/);
      if (l10nIndexMatch) {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        }
        const publicId = normalizePublicId(decodeURIComponent(l10nIndexMatch[1]));
        if (!publicId) {
          return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        }
        if (req.method === 'POST') {
          return withCors(await handlePutL10nLayerIndex(req, env, publicId));
        }
        return withCors(await handleDeleteL10nLayerIndex(req, env, publicId));
      }

      const l10nBaseSnapshotMatch = pathname.match(/^\/l10n\/instances\/([^/]+)\/bases\/([^/]+)$/);
      if (l10nBaseSnapshotMatch) {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(l10nBaseSnapshotMatch[1]));
        const baseFingerprint = normalizeSha256Hex(decodeURIComponent(l10nBaseSnapshotMatch[2]));
        if (!publicId || !baseFingerprint) {
          return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        }
        return withCors(await handlePutL10nBaseSnapshot(req, env, publicId, baseFingerprint));
      }

      const l10nLayerMatch = pathname.match(/^\/l10n\/instances\/([^/]+)\/([^/]+)\/([^/]+)$/);
      if (l10nLayerMatch) {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        }
        const publicId = normalizePublicId(decodeURIComponent(l10nLayerMatch[1]));
        const layer = normalizeLayer(decodeURIComponent(l10nLayerMatch[2]));
        const layerKey = layer ? normalizeLayerKey(layer, decodeURIComponent(l10nLayerMatch[3])) : null;
        if (!publicId || !layer || !layerKey) {
          return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        }
        if (req.method === 'POST') {
          return withCors(await handlePutL10nOverlay(req, env, publicId, layer, layerKey));
        }
        return withCors(await handleDeleteL10nOverlay(req, env, publicId, layer, layerKey));
      }

      const l10nVersionedMatch = pathname.match(/^\/l10n\/v\/[^/]+\/(.+)$/);
      if (l10nVersionedMatch) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const rest = l10nVersionedMatch[1];
        const key = `l10n/${rest}`;
        return withCors(await handleGetL10nAsset(env, key));
      }

      if (pathname.startsWith('/l10n/')) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const key = pathname.replace(/^\//, '');
        return withCors(await handleGetL10nAsset(env, key));
      }

      return withCors(new Response('Not found', { status: 404 }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return withCors(json({ error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.internal', detail: message } }, { status: 500 }));
    }
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const body = msg.body;
      if (isRenderSnapshotJob(body)) {
        const publicId = normalizePublicId(body.publicId);
        if (!publicId) continue;
        const action = body.action === 'delete' ? 'delete' : 'upsert';
        try {
          if (action === 'delete') {
            await deleteRenderIndex(env, publicId);
          } else {
            const locales = normalizeRenderLocales(body.locales);
            await generateRenderSnapshots({ env, publicId, locales: locales.length ? locales : ['en'] });
          }
        } catch (err) {
          console.error('[tokyo] render snapshot job failed', err);
        }
        continue;
      }

      if (!isPublishJob(body)) continue;
      const publicId = normalizePublicId(body.publicId);
      if (!publicId) continue;
      const layer = normalizeLayer(body.layer);
      const layerKey = layer ? normalizeLayerKey(layer, body.layerKey) : null;
      if (!layer || !layerKey) continue;
      try {
        const action = body.action === 'delete' ? 'delete' : 'upsert';
        if (action === 'delete') {
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
      } catch (err) {
        console.error('[tokyo] publish job failed', err);
        try {
          const stateRow = await loadPublishStateRow(env, publicId, layer, layerKey);
          const baseFingerprint = stateRow?.base_fingerprint ?? '';
          if (baseFingerprint) {
            const detail = err instanceof Error ? err.message : String(err);
            await markPublishStateFailed(env, publicId, layer, layerKey, baseFingerprint, detail);
          }
        } catch (markErr) {
          console.error('[tokyo] publish state update failed', markErr);
        }
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          if (!env.L10N_PUBLISH_QUEUE) return;
          const rows = await listDirtyPublishStates(env);
          for (const row of rows) {
            await env.L10N_PUBLISH_QUEUE.send({
              v: 2,
              publicId: row.public_id,
              layer: row.layer,
              layerKey: row.layer_key,
              action: 'upsert',
            });
          }
        } catch (err) {
          console.error('[tokyo] scheduled publish failed', err);
        }
      })(),
    );
  },
};

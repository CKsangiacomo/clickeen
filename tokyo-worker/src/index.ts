import { getEntitlementsMatrix } from '@clickeen/ck-policy';
import { normalizeLocaleToken } from '@clickeen/l10n';

type Env = {
  TOKYO_DEV_JWT: string;
  TOKYO_R2: R2Bucket;
  L10N_PUBLISH_QUEUE?: Queue<L10nPublishQueueJob>;
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
  headers.set('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
  headers.set('access-control-allow-headers', 'authorization, content-type, x-workspace-id, x-filename, x-variant');
  return new Response(res.body, { status: res.status, headers });
}

const L10N_PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

type L10nOverlay = {
  v: 1;
  baseUpdatedAt?: string | null;
  baseFingerprint?: string | null;
  ops: Array<{ op: 'set'; path: string; value: unknown }>;
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

function normalizeLocale(raw: string): string | null {
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
  if (!/^[a-f0-9]{64}$/i.test(baseFingerprint)) {
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

async function deleteLayerArtifacts(env: Env, publicId: string, layer: string, layerKey: string): Promise<void> {
  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(
      `${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(layer)}/${encodeURIComponent(
        layerKey
      )}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP delete failed (${res.status}): ${detail}`);
    }
    return;
  }

  await cleanOldLayerOutputs(env, publicId, layer, layerKey, '');
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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...overlay,
        }),
      }
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

  const stable = prettyStableJson(overlay);
  const fingerprint = overlay.baseFingerprint ?? '';
  if (!/^[a-f0-9]{64}$/i.test(fingerprint)) {
    throw new Error('[tokyo] Missing baseFingerprint for deterministic l10n path');
  }
  const outName = `${fingerprint}.ops.json`;
  const key = `l10n/instances/${publicId}/${layer}/${layerKey}/${outName}`;

  await env.TOKYO_R2.put(key, stable, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  return outName;
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

async function deleteLayerIndex(env: Env, publicId: string): Promise<void> {
  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(`${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/index`, { method: 'DELETE' });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP index delete failed (${res.status}): ${detail}`);
    }
    return;
  }
  await env.TOKYO_R2.delete(`l10n/instances/${publicId}/index.json`);
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
  const payload = prettyStableJson(index);

  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(`${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/index`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP index publish failed (${res.status}): ${detail}`);
    }
    return;
  }

  await env.TOKYO_R2.put(`l10n/instances/${publicId}/index.json`, payload, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=300, stale-while-revalidate=600',
    },
  });
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

  const outName = await publishLayerOverlayArtifacts(env, publicId, layer, layerKey, overlay);
  return json({ publicId, layer, layerKey, file: outName }, { status: 200 });
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
    return json({ error: 'INVALID_JSON' }, { status: 422 });
  }
  if (!payload || typeof payload !== 'object') {
    return json({ error: 'INVALID_PAYLOAD' }, { status: 422 });
  }

  const { publicId: rawPublicId, layer: rawLayer, layerKey: rawLayerKey, action } = payload as L10nPublishRequest;
  const publicId = normalizePublicId(String(rawPublicId || ''));
  const layer = normalizeLayer(String(rawLayer || ''));
  const layerKey = layer ? normalizeLayerKey(layer, String(rawLayerKey || '')) : null;
  if (!publicId || !layer || !layerKey) {
    return json({ error: 'INVALID_L10N_PATH' }, { status: 422 });
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

async function handleUploadWorkspaceAsset(req: Request, env: Env): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  const workspaceId = (req.headers.get('x-workspace-id') || '').trim();
  if (!workspaceId || !isUuid(workspaceId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }, { status: 422 });
  }

  const variant = (req.headers.get('x-variant') || '').trim() || 'original';
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(variant)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.variant.invalid' } }, { status: 422 });
  }

  const filename = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const ext = pickExtension(filename, contentType);

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }

  const assetId = crypto.randomUUID();
  const key = `workspace-assets/${workspaceId}/${assetId}/${variant}.${ext}`;
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

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }

  const assetId = crypto.randomUUID();
  const key = `curated-assets/${widgetType}/${publicId}/${assetId}/${variant}.${ext}`;
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

      if (pathname === '/l10n/publish') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handlePublishLocaleRequest(req, env));
      }

      if (pathname === '/workspace-assets/upload') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handleUploadWorkspaceAsset(req, env));
      }

      if (pathname.startsWith('/workspace-assets/')) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const key = pathname.replace(/^\//, '');
        return withCors(await handleGetWorkspaceAsset(req, env, key));
      }

      if (pathname === '/curated-assets/upload') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handleUploadCuratedAsset(req, env));
      }

      if (pathname.startsWith('/curated-assets/')) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const key = pathname.replace(/^\//, '');
        return withCors(await handleGetCuratedAsset(req, env, key));
      }

      const l10nLayerMatch = pathname.match(/^\/l10n\/instances\/([^/]+)\/([^/]+)\/([^/]+)$/);
      if (l10nLayerMatch) {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(l10nLayerMatch[1]));
        const layer = normalizeLayer(decodeURIComponent(l10nLayerMatch[2]));
        const layerKey = layer ? normalizeLayerKey(layer, decodeURIComponent(l10nLayerMatch[3])) : null;
        if (!publicId || !layer || !layerKey) {
          return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        }
        return withCors(await handlePutL10nOverlay(req, env, publicId, layer, layerKey));
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

  async queue(batch: MessageBatch<L10nPublishQueueJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const body = msg.body;
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

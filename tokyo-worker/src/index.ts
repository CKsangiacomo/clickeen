import { normalizeLocaleToken } from '@clickeen/l10n';

type Env = {
  TOKYO_DEV_JWT: string;
  TOKYO_R2: R2Bucket;
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
  ops: Array<{ op: 'set'; path: string; value: string }>;
};

type L10nManifest = {
  v: 1;
  gitSha: string;
  instances: Record<string, Record<string, { file: string; baseUpdatedAt?: string | null; geoCountries?: string[] | null }>>;
};

type L10nPublishJob = {
  v: 1;
  publicId: string;
  locale: string;
  action?: 'upsert' | 'delete';
};

type L10nPublishRequest = {
  publicId: string;
  locale: string;
  action?: 'upsert' | 'delete';
};

type InstanceLocaleRow = {
  public_id: string;
  locale: string;
  ops: Array<{ op: 'set'; path: string; value: string }>;
  base_updated_at?: string | null;
  base_fingerprint?: string | null;
  geo_countries?: string[] | null;
};

function normalizePublicId(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const okLegacy = /^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$/i.test(value);
  const okWebsiteCreative =
    /^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/i.test(value);
  if (!okLegacy && !okWebsiteCreative) return null;
  return value;
}

function normalizeLocale(raw: string): string | null {
  return normalizeLocaleToken(raw);
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

async function sha8(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8);
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
    if (typeof op.value !== 'string') throw new Error(`[tokyo] overlay.ops[${index}].value must be string`);
    return { op: 'set' as const, path, value: op.value };
  });

  const baseFingerprint = typeof payload.baseFingerprint === 'string' ? payload.baseFingerprint.trim() : '';
  if (!/^[a-f0-9]{64}$/i.test(baseFingerprint)) {
    throw new Error('[tokyo] overlay.baseFingerprint must be a sha256 hex string');
  }
  return { v: 1, baseUpdatedAt: payload.baseUpdatedAt ?? null, baseFingerprint, ops };
}

async function loadL10nManifest(env: Env): Promise<L10nManifest> {
  const key = 'l10n/manifest.json';
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) {
    return { v: 1, gitSha: 'runtime', instances: {} };
  }
  const text = await obj.text();
  const json = JSON.parse(text);
  if (!json || typeof json !== 'object' || json.v !== 1 || typeof json.gitSha !== 'string' || typeof json.instances !== 'object') {
    throw new Error('[tokyo] invalid l10n manifest');
  }
  return json as L10nManifest;
}

async function saveL10nManifest(env: Env, manifest: L10nManifest): Promise<void> {
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  await env.TOKYO_R2.put('l10n/manifest.json', body, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=60, must-revalidate',
    },
  });
}

async function cleanOldL10nOutputs(env: Env, publicId: string, locale: string, keepKey: string): Promise<void> {
  const prefix = `l10n/instances/${publicId}/${locale}.`;
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

async function deleteLocaleArtifacts(env: Env, publicId: string, locale: string): Promise<void> {
  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(
      `${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(locale)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[tokyo] HTTP delete failed (${res.status}): ${detail}`);
    }
    return;
  }

  await cleanOldL10nOutputs(env, publicId, locale, '');
  const manifest = await loadL10nManifest(env);
  const entries = manifest.instances?.[publicId];
  if (!entries || typeof entries !== 'object') return;
  if (!entries[locale]) return;
  delete entries[locale];
  if (Object.keys(entries).length === 0) {
    delete manifest.instances[publicId];
  }
  await saveL10nManifest(env, manifest);
}

async function publishOverlayArtifacts(
  env: Env,
  publicId: string,
  locale: string,
  overlay: L10nOverlay,
  geoCountries?: string[] | null,
): Promise<string> {
  const httpBase = resolveL10nHttpBase(env);
  if (httpBase) {
    const res = await fetch(
      `${httpBase}/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(locale)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...overlay,
          geoCountries: Array.isArray(geoCountries) ? geoCountries : undefined,
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
  const hash = await sha8(stable);
  const outName = `${locale}.${hash}.ops.json`;
  const key = `l10n/instances/${publicId}/${outName}`;

  await env.TOKYO_R2.put(key, stable, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  await cleanOldL10nOutputs(env, publicId, locale, key);

  const manifest = await loadL10nManifest(env);
  manifest.instances[publicId] = manifest.instances[publicId] || {};
  manifest.instances[publicId][locale] = {
    file: outName,
    baseUpdatedAt: overlay.baseUpdatedAt ?? null,
    geoCountries: Array.isArray(geoCountries) && geoCountries.length ? geoCountries : undefined,
  };
  await saveL10nManifest(env, manifest);

  return outName;
}

async function loadInstanceLocaleRow(env: Env, publicId: string, locale: string): Promise<InstanceLocaleRow | null> {
  const params = new URLSearchParams({
    select: 'public_id,locale,ops,base_updated_at,base_fingerprint,geo_countries',
    public_id: `eq.${publicId}`,
    locale: `eq.${locale}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instance_locales?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as InstanceLocaleRow[];
  return rows?.[0] ?? null;
}

async function handlePutL10nOverlay(req: Request, env: Env, publicId: string, locale: string): Promise<Response> {
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

  const outName = await publishOverlayArtifacts(env, publicId, locale, overlay);
  return json({ publicId, locale, file: outName }, { status: 200 });
}

function isPublishJob(value: unknown): value is L10nPublishJob {
  if (!value || typeof value !== 'object') return false;
  const job = value as L10nPublishJob;
  if (job.v !== 1 || typeof job.publicId !== 'string' || typeof job.locale !== 'string') return false;
  if (job.action && job.action !== 'upsert' && job.action !== 'delete') return false;
  return true;
}

async function publishLocaleFromSupabase(env: Env, publicId: string, locale: string): Promise<void> {
  const row = await loadInstanceLocaleRow(env, publicId, locale);
  if (!row) return;
  await publishLocaleRow(env, row);
}

async function publishLocaleRow(env: Env, row: InstanceLocaleRow): Promise<void> {
  const publicId = normalizePublicId(row.public_id);
  const locale = normalizeLocale(row.locale);
  if (!publicId || !locale) return;
  let overlay: L10nOverlay;
  try {
    overlay = assertOverlayShape({
      v: 1,
      baseUpdatedAt: row.base_updated_at ?? null,
      baseFingerprint: row.base_fingerprint ?? null,
      ops: row.ops,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`[tokyo] Invalid overlay row: ${detail}`);
  }
  await publishOverlayArtifacts(env, publicId, locale, overlay, row.geo_countries ?? null);
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

  const { publicId: rawPublicId, locale: rawLocale, action } = payload as L10nPublishRequest;
  const publicId = normalizePublicId(String(rawPublicId || ''));
  const locale = normalizeLocale(String(rawLocale || ''));
  if (!publicId || !locale) {
    return json({ error: 'INVALID_L10N_PATH' }, { status: 422 });
  }

  const resolvedAction = action === 'delete' ? 'delete' : 'upsert';
  if (resolvedAction === 'delete') {
    await deleteLocaleArtifacts(env, publicId, locale);
  } else {
    await publishLocaleFromSupabase(env, publicId, locale);
  }

  return json({ publicId, locale, action: resolvedAction }, { status: 200 });
}

async function listInstanceLocales(env: Env): Promise<InstanceLocaleRow[]> {
  const rows: InstanceLocaleRow[] = [];
  const limit = 1000;
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      select: 'public_id,locale,ops,base_updated_at,base_fingerprint,geo_countries',
      limit: String(limit),
      offset: String(offset),
      order: 'public_id.asc,locale.asc',
    });
    const res = await supabaseFetch(env, `/rest/v1/widget_instance_locales?${params.toString()}`, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`[tokyo] Supabase list failed (${res.status}) ${text}`.trim());
    }
    const batch = (await res.json().catch(() => [])) as InstanceLocaleRow[];
    if (!batch.length) break;
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += batch.length;
  }
  return rows;
}

async function handleGetL10nAsset(env: Env, key: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  headers.set('content-type', obj.httpMetadata?.contentType || 'application/json; charset=utf-8');
  if (key.endsWith('/manifest.json')) {
    headers.set('cache-control', 'public, max-age=60, must-revalidate');
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

      const l10nMatch = pathname.match(/^\/l10n\/instances\/([^/]+)\/([^/]+)$/);
      if (l10nMatch) {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(l10nMatch[1]));
        const locale = normalizeLocale(decodeURIComponent(l10nMatch[2]));
        if (!publicId || !locale) {
          return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        }
        return withCors(await handlePutL10nOverlay(req, env, publicId, locale));
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

  async queue(batch: MessageBatch<L10nPublishJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const body = msg.body;
      if (!isPublishJob(body)) continue;
      const publicId = normalizePublicId(body.publicId);
      const locale = normalizeLocale(body.locale);
      if (!publicId || !locale) continue;
      try {
        const action = body.action === 'delete' ? 'delete' : 'upsert';
        if (action === 'delete') {
          await deleteLocaleArtifacts(env, publicId, locale);
        } else {
          await publishLocaleFromSupabase(env, publicId, locale);
        }
      } catch (err) {
        console.error('[tokyo] publish job failed', err);
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const rows = await listInstanceLocales(env);
          for (const row of rows) {
            try {
              await publishLocaleRow(env, row);
            } catch (err) {
              console.error('[tokyo] publish row failed', err);
            }
          }
        } catch (err) {
          console.error('[tokyo] scheduled publish failed', err);
        }
      })(),
    );
  },
};

import { getEntitlementsMatrix } from '@clickeen/ck-policy';
import {
  ASSET_POINTER_PATH_RE,
  isUuid,
  normalizeWidgetPublicId,
  toCanonicalAssetPointerPath,
} from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetPointer,
  handleReplaceAccountAssetContent,
  handleUploadAccountAsset,
} from './domains/assets';
import {
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
  type L10nPublishQueueJob,
} from './domains/l10n';
import {
  deleteRenderIndex,
  generateRenderSnapshots,
  handleGetRenderObject,
  isRenderSnapshotJob,
  normalizeRenderLocales,
  normalizeRenderRevision,
  renderArtifactKey,
  renderIndexKey,
  renderPublishedPointerKey,
  renderRevisionIndexKey,
  type RenderSnapshotQueueJob,
} from './domains/render';

export type Env = {
  TOKYO_DEV_JWT: string;
  TOKYO_R2: R2Bucket;
  USAGE_KV?: KVNamespace;
  L10N_PUBLISH_QUEUE?: Queue<L10nPublishQueueJob>;
  RENDER_SNAPSHOT_QUEUE?: Queue<RenderSnapshotQueueJob>;
  VENICE_BASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_JWT_ISSUER?: string;
  SUPABASE_JWT_AUDIENCE?: string;
  TOKYO_L10N_HTTP_BASE?: string;
  VENICE_INTERNAL_BYPASS_TOKEN?: string;
};

export function json(payload: unknown, init?: ResponseInit) {
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

type JwtClaims = Record<string, unknown> & {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
};

type UploadPrincipal = {
  token: string;
  userId: string;
};

type UploadAuthResult =
  | { ok: true; trusted: true }
  | { ok: true; trusted: false; principal: UploadPrincipal }
  | { ok: false; response: Response };

function decodeJwtPayload(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payloadPart = parts[1];
  if (!payloadPart) return null;
  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as JwtClaims;
  } catch {
    return null;
  }
}

function claimAsString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function claimAsNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function audienceMatches(claim: unknown, expected: string): boolean {
  if (typeof claim === 'string') return claim.trim() === expected;
  if (Array.isArray(claim)) return claim.some((item) => typeof item === 'string' && item.trim() === expected);
  return false;
}

function resolveSupabaseIssuer(env: Env): string {
  const configured = (typeof env.SUPABASE_JWT_ISSUER === 'string' ? env.SUPABASE_JWT_ISSUER.trim() : '') || null;
  if (configured) return configured.replace(/\/+$/, '');
  const base = requireSupabaseEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  return `${base}/auth/v1`;
}

function resolveSupabaseAudience(env: Env): string {
  const configured = (typeof env.SUPABASE_JWT_AUDIENCE === 'string' ? env.SUPABASE_JWT_AUDIENCE.trim() : '') || null;
  return configured || 'authenticated';
}

async function fetchSupabaseUserId(token: string, env: Env): Promise<string | null> {
  const baseUrl = requireSupabaseEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const serviceKey = requireSupabaseEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Supabase auth lookup failed (${response.status})`);
  const parsed = (await response.json().catch(() => null)) as { id?: unknown } | null;
  const userId = typeof parsed?.id === 'string' ? parsed.id.trim() : '';
  if (!userId || !isUuid(userId)) return null;
  return userId;
}

export async function assertUploadAuth(req: Request, env: Env): Promise<UploadAuthResult> {
  const token = asBearerToken(req.headers.get('authorization'));
  if (!token) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } }, { status: 401 }) };
  }

  const trustedToken = (env.TOKYO_DEV_JWT || '').trim();
  if (trustedToken && token === trustedToken) {
    return { ok: true, trusted: true };
  }

  const claims = decodeJwtPayload(token);
  if (!claims) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const issuer = resolveSupabaseIssuer(env);
  const audience = resolveSupabaseAudience(env);
  const iss = claimAsString(claims.iss);
  if (!iss || iss !== issuer) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 }) };
  }
  if (!audienceMatches(claims.aud, audience)) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 }) };
  }
  const exp = claimAsNumber(claims.exp);
  if (!exp || exp <= nowSec) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_EXPIRED' } }, { status: 401 }) };
  }
  const nbf = claimAsNumber(claims.nbf);
  if (nbf && nbf > nowSec) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 }) };
  }

  let userId: string | null = null;
  try {
    userId = await fetchSupabaseUserId(token, env);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: json({ error: { kind: 'INTERNAL', reasonKey: 'AUTH_PROVIDER_UNAVAILABLE', detail } }, { status: 502 }) };
  }
  if (!userId) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 }) };
  }

  const sub = claimAsString(claims.sub);
  if (sub && sub !== userId) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 }) };
  }

  return { ok: true, trusted: false, principal: { token, userId } };
}

export function requireDevAuth(req: Request, env: Env): Response | null {
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

export function resolveL10nHttpBase(env: Env): string | null {
  const raw = typeof env.TOKYO_L10N_HTTP_BASE === 'string' ? env.TOKYO_L10N_HTTP_BASE.trim() : '';
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

const TOKYO_L10N_BRIDGE_HEADER = 'x-tokyo-l10n-bridge';

export function buildL10nBridgeHeaders(env: Env, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set(TOKYO_L10N_BRIDGE_HEADER, '1');
  const token = (env.TOKYO_DEV_JWT || '').trim();
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function supabaseFetch(env: Env, pathnameWithQuery: string, init?: RequestInit) {
  const baseUrl = requireSupabaseEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const key = requireSupabaseEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const headers = new Headers(init?.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
  return fetch(`${baseUrl}${pathnameWithQuery}`, { ...init, headers });
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

export function pickExtension(filename: string | null, contentType: string | null): string {
  const rawName = String(filename || '').trim();
  const fromName = rawName ? rawName.split('.').pop()?.toLowerCase() : '';
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const fromMime = extFromMime(String(contentType || '').trim());
  if (fromMime) return fromMime;
  return 'bin';
}

export function sanitizeUploadFilename(filename: string | null, ext: string, variant?: string | null): string {
  const raw = String(filename || '').trim();
  const basename = raw.split(/[\\/]/).pop() || '';
  const stripped = basename.split('?')[0].split('#')[0];
  const stemRaw = stripped.replace(/\.[^.]+$/, '');
  const normalizedStem = stemRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const variantStem = String(variant || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeStemBase = normalizedStem || 'upload';
  const safeStem = (safeStemBase === variantStem ? 'file' : safeStemBase).slice(0, 64);
  const safeExt = String(ext || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'bin';
  return `${safeStem}.${safeExt}`;
}

const ACCOUNT_ASSET_CANONICAL_PREFIX = 'arsenale/o/';

export function buildAccountAssetKey(accountId: string, assetId: string, variant: string, filename: string): string {
  const normalizedVariant = String(variant || '').trim().toLowerCase();
  if (normalizedVariant === 'original') {
    return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/${assetId}/${filename}`;
  }
  return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/${assetId}/${normalizedVariant}/${filename}`;
}

export function buildAccountAssetReplaceKey(
  accountId: string,
  assetId: string,
  variant: string,
  filename: string,
  contentSha256: string,
): string {
  const digest = String(contentSha256 || '').trim().toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 12) || 'replace';
  const safeName = `${digest}-${filename}`;
  return buildAccountAssetKey(accountId, assetId, variant, safeName);
}

function normalizeCanonicalAccountAssetSuffix(suffix: string): string | null {
  const parts = String(suffix || '')
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length === 3) {
    const [accountId, assetId, filename] = parts;
    return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/${assetId}/${filename}`;
  }
  if (parts.length === 4) {
    const [accountId, assetId, variant, filename] = parts;
    if (variant.toLowerCase() === 'original') {
      return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/${assetId}/${filename}`;
    }
    return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/${assetId}/${variant}/${filename}`;
  }
  return null;
}

export function normalizeAccountAssetReadKey(pathname: string): string | null {
  const key = String(pathname || '').replace(/^\/+/, '');
  if (!key.startsWith(ACCOUNT_ASSET_CANONICAL_PREFIX)) return null;
  return normalizeCanonicalAccountAssetSuffix(key.slice(ACCOUNT_ASSET_CANONICAL_PREFIX.length));
}

type AccountAssetIdentity = { accountId: string; assetId: string };

export function buildAccountAssetPointerPath(accountId: string, assetId: string): string {
  const pointerPath = toCanonicalAssetPointerPath(accountId, assetId);
  if (!pointerPath) throw new Error('[tokyo] invalid account asset identity for pointer path');
  return pointerPath;
}

export function parseAccountAssetIdentityFromKey(key: string): AccountAssetIdentity | null {
  const normalized = normalizeAccountAssetReadKey(key.startsWith('/') ? key : `/${key}`);
  if (!normalized) return null;
  const suffix = normalized.slice(ACCOUNT_ASSET_CANONICAL_PREFIX.length);
  const parts = suffix.split('/').filter(Boolean);
  if (parts.length !== 3 && parts.length !== 4) return null;
  const accountId = parts[0];
  const assetId = parts[1];
  if (!accountId || !assetId || !isUuid(accountId) || !isUuid(assetId)) return null;
  return { accountId, assetId };
}

export function guessContentTypeFromExt(ext: string): string {
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
    case 'woff2':
      return 'font/woff2';
    case 'woff':
      return 'font/woff';
    case 'otf':
      return 'font/otf';
    case 'ttf':
      return 'font/ttf';
    default:
      return 'application/octet-stream';
  }
}

function normalizeTokyoFontKey(pathname: string): string | null {
  const normalized = String(pathname || '').replace(/^\/+/, '');
  if (!normalized.startsWith('fonts/')) return null;
  const segments = normalized.split('/');
  if (segments.length < 2) return null;
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return normalized;
}

async function handleGetTokyoFontAsset(env: Env, pathname: string): Promise<Response> {
  const key = normalizeTokyoFontKey(pathname);
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  headers.set('cdn-cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  headers.set('cloudflare-cdn-cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  return new Response(obj.body, { status: 200, headers });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  headers.set(
    'access-control-allow-headers',
    'authorization, content-type, x-account-id, x-workspace-id, x-filename, x-variant, x-public-id, x-widget-type, x-source, idempotency-key, x-tokyo-l10n-bridge',
  );
  return new Response(res.body, { status: res.status, headers });
}

export const normalizePublicId = normalizeWidgetPublicId;

export function normalizeWidgetType(raw: string): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) return null;
  return value;
}

export function normalizeLocale(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = normalizeLocaleToken(raw);
  if (!value) return null;
  return value;
}

export function normalizeSha256Hex(raw: unknown): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  return value;
}

function stableStringify(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function prettyStableJson(value: any): string {
  const normalized = stableStringify(value);
  const parsed = JSON.parse(normalized);
  return JSON.stringify(parsed, null, 2);
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

      const renderPublishedPointerMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/published\.json$/);
      if (renderPublishedPointerMatch) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(renderPublishedPointerMatch[1]));
        if (!publicId) return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        return withCors(
          await handleGetRenderObject(
            env,
            renderPublishedPointerKey(publicId),
            'no-store',
          ),
        );
      }

      const renderRevisionIndexMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/revisions\/([^/]+)\/index\.json$/);
      if (renderRevisionIndexMatch) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(renderRevisionIndexMatch[1]));
        const revision = normalizeRenderRevision(decodeURIComponent(renderRevisionIndexMatch[2]));
        if (!publicId || !revision) {
          return withCors(json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } }, { status: 422 }));
        }
        return withCors(
          await handleGetRenderObject(
            env,
            renderRevisionIndexKey(publicId, revision),
            'public, max-age=31536000, immutable',
          ),
        );
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

      if (pathname === '/assets/upload') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handleUploadAccountAsset(req, env));
      }

      const accountAssetMatch = pathname.match(/^\/assets\/([^/]+)\/([^/]+)$/);
      if (accountAssetMatch) {
        const accountId = decodeURIComponent(accountAssetMatch[1] || '');
        const assetId = decodeURIComponent(accountAssetMatch[2] || '');
        if (req.method === 'PUT') {
          return withCors(await handleReplaceAccountAssetContent(req, env, accountId, assetId));
        }
        if (req.method === 'DELETE') {
          return withCors(await handleDeleteAccountAsset(req, env, ctx, accountId, assetId));
        }
        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const accountAssetPointerMatch = pathname.match(ASSET_POINTER_PATH_RE);
      if (accountAssetPointerMatch) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(
          await handleGetAccountAssetPointer(
            env,
            decodeURIComponent(accountAssetPointerMatch[1] || ''),
            decodeURIComponent(accountAssetPointerMatch[2] || ''),
          ),
        );
      }

      if (pathname.startsWith('/arsenale/o/')) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const key = pathname.replace(/^\//, '');
        return withCors(await handleGetAccountAsset(env, key));
      }

      if (pathname.startsWith('/fonts/')) {
        if (req.method !== 'GET') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handleGetTokyoFontAsset(env, pathname));
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

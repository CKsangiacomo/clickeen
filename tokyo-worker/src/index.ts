import { getEntitlementsMatrix } from '@clickeen/ck-policy';
import {
  isUuid,
  normalizeWidgetPublicId,
  parseCanonicalAssetRef,
  toCanonicalAssetVersionPath,
} from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetIdentityIntegrity,
  handleGetAccountAssetMirrorIntegrity,
  handleUploadAccountAsset,
  upsertInstanceRenderHealth,
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
  renderPublishedPointerKey,
  renderRevisionIndexKey,
  type RenderSnapshotQueueJob,
} from './domains/render';

export { generateRenderSnapshots };

export type Env = {
  TOKYO_DEV_JWT: string;
  TOKYO_R2: R2Bucket;
  USAGE_KV?: KVNamespace;
  L10N_PUBLISH_QUEUE?: Queue<L10nPublishQueueJob>;
  RENDER_SNAPSHOT_QUEUE?: Queue<RenderSnapshotQueueJob>;
  VENICE_BASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  BERLIN_BASE_URL?: string;
  BERLIN_JWKS_URL?: string;
  BERLIN_ISSUER?: string;
  BERLIN_AUDIENCE?: string;
  TOKYO_L10N_HTTP_BASE?: string;
  VENICE_INTERNAL_BYPASS_TOKEN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
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

type BerlinJwksCacheEntry = {
  fetchedAt: number;
  expiresAt: number;
  keys: Record<string, CryptoKey>;
};

type BerlinJwksStore = {
  cacheByUrl: Record<string, BerlinJwksCacheEntry | undefined>;
};

const BERLIN_JWKS_CACHE_KEY = '__CK_TOKYO_BERLIN_JWKS_CACHE_V1__';
const BERLIN_JWKS_CACHE_TTL_MS = 5 * 60_000;

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

function resolveBerlinIssuer(env: Env): string {
  const configured = (typeof env.BERLIN_ISSUER === 'string' ? env.BERLIN_ISSUER.trim() : '') || null;
  if (configured) return configured.replace(/\/+$/, '');
  const base = requireEnvString(env.BERLIN_BASE_URL, 'BERLIN_BASE_URL').replace(/\/+$/, '');
  return base;
}

function resolveBerlinAudience(env: Env): string {
  const configured = (typeof env.BERLIN_AUDIENCE === 'string' ? env.BERLIN_AUDIENCE.trim() : '') || null;
  return configured || 'clickeen.product';
}

function resolveBerlinJwksUrl(env: Env): string {
  const configured = (typeof env.BERLIN_JWKS_URL === 'string' ? env.BERLIN_JWKS_URL.trim() : '') || null;
  if (configured) return configured;
  const base = requireEnvString(env.BERLIN_BASE_URL, 'BERLIN_BASE_URL').replace(/\/+$/, '');
  return `${base}/.well-known/jwks.json`;
}

function isBerlinJwksStore(value: unknown): value is BerlinJwksStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cacheByUrl = record.cacheByUrl;
  return Boolean(cacheByUrl && typeof cacheByUrl === 'object' && !Array.isArray(cacheByUrl));
}

function resolveBerlinJwksStore(): BerlinJwksStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[BERLIN_JWKS_CACHE_KEY];
  if (isBerlinJwksStore(existing)) return existing;
  const next: BerlinJwksStore = { cacheByUrl: {} };
  scope[BERLIN_JWKS_CACHE_KEY] = next;
  return next;
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer;
  }
  const cloned = new Uint8Array(bytes.byteLength);
  cloned.set(bytes);
  return cloned.buffer;
}

function jwkKid(value: JsonWebKey): string | null {
  const raw = (value as Record<string, unknown>).kid;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function decodeJwtHeader(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const headerPart = parts[0];
  if (!headerPart) return null;
  try {
    const normalized = headerPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function importBerlinJwk(key: JsonWebKey): Promise<CryptoKey | null> {
  if (key.kty !== 'RSA') return null;
  if (!jwkKid(key)) return null;
  if (typeof key.n !== 'string' || typeof key.e !== 'string') return null;
  try {
    return await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
      'verify',
    ]);
  } catch {
    return null;
  }
}

async function fetchBerlinJwks(url: string): Promise<BerlinJwksCacheEntry> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Berlin JWKS lookup failed (${response.status})`);

  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Berlin JWKS response is malformed');
  }
  const keysRaw = (parsed as Record<string, unknown>).keys;
  if (!Array.isArray(keysRaw)) throw new Error('Berlin JWKS keys missing');

  const keys: Record<string, CryptoKey> = {};
  for (const item of keysRaw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const jwk = item as JsonWebKey;
    const kid = jwkKid(jwk) || '';
    if (!kid) continue;
    const imported = await importBerlinJwk(jwk);
    if (!imported) continue;
    keys[kid] = imported;
  }

  const now = Date.now();
  return {
    fetchedAt: now,
    expiresAt: now + BERLIN_JWKS_CACHE_TTL_MS,
    keys,
  };
}

async function resolveBerlinVerifyKey(env: Env, kid: string): Promise<CryptoKey | null> {
  const url = resolveBerlinJwksUrl(env);
  const store = resolveBerlinJwksStore();
  const now = Date.now();
  const cached = store.cacheByUrl[url];
  if (cached && cached.expiresAt > now && cached.keys[kid]) {
    return cached.keys[kid] || null;
  }

  const fresh = await fetchBerlinJwks(url);
  store.cacheByUrl[url] = fresh;
  return fresh.keys[kid] || null;
}

async function verifyBerlinJwtSignature(
  token: string,
  env: Env,
): Promise<{ ok: true; claims: JwtClaims } | { ok: false; reason: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed_jwt' };

  const header = decodeJwtHeader(token);
  const claims = decodeJwtPayload(token);
  if (!header || !claims) return { ok: false, reason: 'malformed_jwt' };

  const alg = claimAsString(header.alg);
  if (!alg || alg !== 'RS256') return { ok: false, reason: 'unsupported_alg' };

  const kid = claimAsString(header.kid);
  if (!kid) return { ok: false, reason: 'missing_kid' };

  let key: CryptoKey | null = null;
  try {
    key = await resolveBerlinVerifyKey(env, kid);
  } catch {
    return { ok: false, reason: 'jwks_unavailable' };
  }
  if (!key) return { ok: false, reason: 'unknown_kid' };

  const signature = fromBase64Url(parts[2] || '');
  if (!signature) return { ok: false, reason: 'malformed_signature' };

  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    toArrayBuffer(signature),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) return { ok: false, reason: 'invalid_signature' };

  return { ok: true, claims };
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

  const signature = await verifyBerlinJwtSignature(token, env);
  if (!signature.ok) {
    const status = signature.reason === 'jwks_unavailable' ? 502 : 403;
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: signature.reason === 'jwks_unavailable' ? 'INTERNAL' : 'DENY',
            reasonKey: signature.reason === 'jwks_unavailable' ? 'AUTH_PROVIDER_UNAVAILABLE' : 'AUTH_INVALID',
            ...(signature.reason === 'jwks_unavailable' ? { detail: signature.reason } : {}),
          },
        },
        { status },
      ),
    };
  }
  const claims = signature.claims;

  const nowSec = Math.floor(Date.now() / 1000);
  const issuer = resolveBerlinIssuer(env);
  const audience = resolveBerlinAudience(env);
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

  const userId = claimAsString(claims.sub);
  if (!userId || !isUuid(userId)) {
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

function requireEnvString(value: string | undefined, key: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`[tokyo] Missing required env var: ${key}`);
  return normalized;
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

const ACCOUNT_ASSET_CANONICAL_PREFIX = 'assets/versions/';

export function buildAccountAssetKey(accountId: string, assetId: string, variant: string, filename: string): string {
  const normalizedVariant = String(variant || '').trim().toLowerCase();
  if (normalizedVariant === 'original') {
    return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/${assetId}/${filename}`;
  }
  return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/${assetId}/${normalizedVariant}/${filename}`;
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

export function buildAccountAssetVersionPath(versionKey: string): string {
  const versionPath = toCanonicalAssetVersionPath(versionKey);
  if (!versionPath) throw new Error('[tokyo] invalid account asset version key');
  return versionPath;
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

function extractSnapshotLocalesFromL10nIndex(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ['en'];
  const layers = (payload as any).layers;
  if (!layers || typeof layers !== 'object' || Array.isArray(layers)) return ['en'];

  const out: string[] = ['en'];
  const seen = new Set<string>(out);
  const appendLayerLocales = (layerName: 'locale' | 'user') => {
    const layer = (layers as any)[layerName];
    const keys = Array.isArray(layer?.keys) ? layer.keys : [];
    for (const raw of keys) {
      const key = typeof raw === 'string' ? raw.trim() : '';
      if (!key) continue;
      if (layerName === 'user' && key === 'global') continue;
      const normalized = normalizeLocale(key);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  };

  appendLayerLocales('locale');
  appendLayerLocales('user');
  return out;
}

export async function loadSnapshotLocalesFromL10nIndex(args: {
  env: Env;
  publicId: string;
  changedLayerKey?: string | null;
}): Promise<string[]> {
  const fallback = ['en'];
  const changedLocale = normalizeLocale(args.changedLayerKey ?? null);
  if (changedLocale && changedLocale !== 'en') fallback.push(changedLocale);

  try {
    const key = `l10n/instances/${args.publicId}/index.json`;
    const obj = await args.env.TOKYO_R2.get(key);
    if (!obj) return fallback;
    const raw = await obj.text();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const locales = extractSnapshotLocalesFromL10nIndex(parsed);
    if (changedLocale && !locales.includes(changedLocale)) locales.push(changedLocale);
    return locales.length ? locales : fallback;
  } catch {
    return fallback;
  }
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

      const renderLegacyIndexMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/index\.json$/);
      if (renderLegacyIndexMatch) {
        return withCors(
          json(
            {
              error: {
                kind: 'VALIDATION',
                reasonKey: 'tokyo.errors.render.legacyIndexUnsupported',
                detail:
                  'Legacy /renders/instances/{publicId}/index.json is not supported. Use /published.json + /revisions/{revision}/index.json.',
              },
            },
            { status: 410 },
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
        try {
          const locales = normalizeRenderLocales(payload?.locales);
          const resolvedLocales = locales.length
            ? locales
            : await loadSnapshotLocalesFromL10nIndex({
                env,
                publicId,
              });
          await generateRenderSnapshots({ env, publicId, locales: resolvedLocales });
          try {
            await upsertInstanceRenderHealth(env, {
              publicId,
              status: 'healthy',
              reason: 'snapshot_revision_published',
              detail: null,
            });
          } catch (healthErr) {
            console.error('[tokyo] render health update failed (manual snapshot success)', healthErr);
          }
          return withCors(json({ ok: true, publicId, action, locales: resolvedLocales }, { status: 200 }));
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          try {
            await upsertInstanceRenderHealth(env, {
              publicId,
              status: 'error',
              reason: 'snapshot_generation_failed',
              detail,
            });
          } catch (healthErr) {
            console.error('[tokyo] render health update failed (manual snapshot failure)', healthErr);
          }
          throw error;
        }
      }

      if (pathname === '/l10n/publish') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handlePublishLocaleRequest(req, env));
      }

      if (pathname === '/assets/upload') {
        if (req.method !== 'POST') return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handleUploadAccountAsset(req, env));
      }

      const accountAssetVersion = parseCanonicalAssetRef(pathname);
      if (accountAssetVersion) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        }
        const response = await handleGetAccountAsset(env, accountAssetVersion.versionKey);
        if (req.method === 'HEAD') {
          return withCors(new Response(null, { status: response.status, headers: response.headers }));
        }
        return withCors(response);
      }

      const accountAssetMatch = pathname.match(/^\/assets\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/i);
      if (accountAssetMatch) {
        const accountId = decodeURIComponent(accountAssetMatch[1] || '');
        const assetId = decodeURIComponent(accountAssetMatch[2] || '');
        if (req.method === 'DELETE') {
          return withCors(await handleDeleteAccountAsset(req, env, accountId, assetId));
        }
        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const accountAssetIntegrityMatch = pathname.match(/^\/assets\/integrity\/([0-9a-f-]{36})$/i);
      if (accountAssetIntegrityMatch) {
        const accountId = decodeURIComponent(accountAssetIntegrityMatch[1] || '');
        if (req.method === 'GET') {
          return withCors(await handleGetAccountAssetMirrorIntegrity(req, env, accountId));
        }
        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const accountAssetIdentityIntegrityMatch = pathname.match(/^\/assets\/integrity\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/i);
      if (accountAssetIdentityIntegrityMatch) {
        const accountId = decodeURIComponent(accountAssetIdentityIntegrityMatch[1] || '');
        const assetId = decodeURIComponent(accountAssetIdentityIntegrityMatch[2] || '');
        if (req.method === 'GET') {
          return withCors(await handleGetAccountAssetIdentityIntegrity(req, env, accountId, assetId));
        }
        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
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
            const resolvedLocales = locales.length
              ? locales
              : await loadSnapshotLocalesFromL10nIndex({
                  env,
                  publicId,
                });
            await generateRenderSnapshots({ env, publicId, locales: resolvedLocales });
            try {
              await upsertInstanceRenderHealth(env, {
                publicId,
                status: 'healthy',
                reason: 'snapshot_revision_published',
                detail: null,
              });
            } catch (healthErr) {
              console.error('[tokyo] render health update failed (snapshot queue success)', healthErr);
            }
          }
        } catch (err) {
          console.error('[tokyo] render snapshot job failed', err);
          const detail = err instanceof Error ? err.message : String(err);
          try {
            await upsertInstanceRenderHealth(env, {
              publicId,
              status: 'error',
              reason: 'snapshot_generation_failed',
              detail,
            });
          } catch (healthErr) {
            console.error('[tokyo] render health update failed (snapshot queue failure)', healthErr);
          }
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
          const locales = await loadSnapshotLocalesFromL10nIndex({
            env,
            publicId,
            changedLayerKey: layerKey,
          });
          await env.RENDER_SNAPSHOT_QUEUE.send({
            v: 1,
            kind: 'render-snapshot',
            publicId,
            locales,
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

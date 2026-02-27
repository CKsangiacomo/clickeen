import type { Env } from './types';
import { json } from './http';
import { isRecord, isUuid } from './validation';

type JwtClaims = Record<string, unknown> & {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  email?: string;
  role?: string;
  sid?: string;
};

export type SupabaseAuthPrincipal = {
  token: string;
  userId: string;
  email: string | null;
  role: string | null;
  claims: JwtClaims;
};

const INTERNAL_SERVICE_HEADER = 'x-ck-internal-service';
const INTERNAL_SERVICE_ALLOWLIST = new Set(['sanfrancisco', 'sanfrancisco.l10n']);

const BERLIN_PRINCIPAL_CACHE_KEY = '__CK_PARIS_BERLIN_PRINCIPAL_CACHE_V1__';
const BERLIN_PRINCIPAL_CACHE_TTL_MS = 5 * 60_000;
const BERLIN_JWKS_CACHE_KEY = '__CK_PARIS_BERLIN_JWKS_CACHE_V1__';
const BERLIN_JWKS_CACHE_TTL_MS = 5 * 60_000;

type BerlinPrincipalCacheEntry = {
  principal: SupabaseAuthPrincipal;
  expiresAt: number;
};

type BerlinPrincipalStore = {
  cache: Record<string, BerlinPrincipalCacheEntry | undefined>;
};

type BerlinJwksCacheEntry = {
  fetchedAt: number;
  expiresAt: number;
  keys: Record<string, CryptoKey>;
};

type BerlinJwksStore = {
  cacheByUrl: Record<string, BerlinJwksCacheEntry | undefined>;
};

function normalizeInternalServiceId(value: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export function isTrustedInternalServiceRequest(req: Request, env: Env): boolean {
  const marker = normalizeInternalServiceId(req.headers.get(INTERNAL_SERVICE_HEADER));
  if (!marker || !INTERNAL_SERVICE_ALLOWLIST.has(marker)) return false;
  const expected = typeof env.PARIS_DEV_JWT === 'string' ? env.PARIS_DEV_JWT.trim() : '';
  if (!expected) return false;
  const token = asBearerToken(req.headers.get('Authorization'));
  if (!token) return false;
  return token === expected;
}

function isBerlinPrincipalStore(value: unknown): value is BerlinPrincipalStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cache = record.cache;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;
  return true;
}

function resolveBerlinPrincipalStore(): BerlinPrincipalStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[BERLIN_PRINCIPAL_CACHE_KEY];
  if (isBerlinPrincipalStore(existing)) return existing;
  const next: BerlinPrincipalStore = { cache: {} };
  scope[BERLIN_PRINCIPAL_CACHE_KEY] = next;
  return next;
}

function readCachedBerlinPrincipal(token: string): SupabaseAuthPrincipal | null {
  const store = resolveBerlinPrincipalStore();
  const entry = store.cache[token];
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    delete store.cache[token];
    return null;
  }
  return entry.principal;
}

function writeCachedBerlinPrincipal(
  token: string,
  principal: SupabaseAuthPrincipal,
  tokenExpSec: number,
): SupabaseAuthPrincipal {
  const store = resolveBerlinPrincipalStore();
  const nowMs = Date.now();
  const tokenExpMs = tokenExpSec * 1000;
  const boundedExpiryMs = Math.min(nowMs + BERLIN_PRINCIPAL_CACHE_TTL_MS, tokenExpMs);
  const expiresAt = Math.max(nowMs + 1_000, boundedExpiryMs);
  store.cache[token] = { principal, expiresAt };
  return principal;
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

export function requireEnv(env: Env, key: keyof Env) {
  const value = env[key];
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error(`[ParisWorker] Missing required env var: ${key}`);
  }
  return value.trim();
}

export function asBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;
  return token.trim() || null;
}

export async function assertDevAuth(
  req: Request,
  env: Env,
): Promise<
  | { ok: true; principal?: SupabaseAuthPrincipal; source: 'dev' | 'berlin' }
  | { ok: false; response: Response }
> {
  if (isTrustedInternalServiceRequest(req, env)) {
    return { ok: true as const, source: 'dev' };
  }

  const berlin = await assertSupabaseAuth(req, env);
  if ('response' in berlin) {
    return { ok: false as const, response: berlin.response };
  }

  return { ok: true as const, source: 'berlin', principal: berlin.principal };
}

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
    if (!isRecord(parsed)) return null;
    return parsed as JwtClaims;
  } catch {
    return null;
  }
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
    if (!isRecord(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveBerlinIssuer(env: Env): string {
  const configured = (typeof env.BERLIN_ISSUER === 'string' ? env.BERLIN_ISSUER.trim() : '') || null;
  if (configured) return configured.replace(/\/+$/, '');
  const base = requireEnv(env, 'BERLIN_BASE_URL').replace(/\/+$/, '');
  return base;
}

function resolveBerlinAudience(env: Env): string {
  const configured = (typeof env.BERLIN_AUDIENCE === 'string' ? env.BERLIN_AUDIENCE.trim() : '') || null;
  return configured || 'clickeen.product';
}

function resolveBerlinJwksUrl(env: Env): string {
  const configured = (typeof env.BERLIN_JWKS_URL === 'string' ? env.BERLIN_JWKS_URL.trim() : '') || null;
  if (configured) return configured;
  const base = requireEnv(env, 'BERLIN_BASE_URL').replace(/\/+$/, '');
  return `${base}/.well-known/jwks.json`;
}

function claimAsNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function claimAsString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function audienceMatches(claim: unknown, expected: string): boolean {
  if (typeof claim === 'string') return claim.trim() === expected;
  if (Array.isArray(claim)) return claim.some((item) => typeof item === 'string' && item.trim() === expected);
  return false;
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

async function importBerlinJwk(key: JsonWebKey): Promise<CryptoKey | null> {
  if (key.kty !== 'RSA') return null;
  if (typeof key.kid !== 'string' || !key.kid.trim()) return null;
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
  if (!response.ok) {
    throw new Error(`Berlin JWKS lookup failed (${response.status})`);
  }

  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.keys)) {
    throw new Error('Berlin JWKS response is malformed');
  }

  const keys: Record<string, CryptoKey> = {};
  for (const item of parsed.keys) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const jwk = item as JsonWebKey;
    const kid = typeof jwk.kid === 'string' ? jwk.kid.trim() : '';
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
  const cached = store.cacheByUrl[url];
  const now = Date.now();

  if (cached && cached.expiresAt > now && cached.keys[kid]) {
    return cached.keys[kid] || null;
  }

  const fresh = await fetchBerlinJwks(url);
  store.cacheByUrl[url] = fresh;
  return fresh.keys[kid] || null;
}

async function verifyBerlinJwtSignature(token: string, env: Env): Promise<{ ok: true; claims: JwtClaims } | { ok: false; reason: string }> {
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

  const encoder = new TextEncoder();
  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    signature,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) return { ok: false, reason: 'invalid_signature' };

  return { ok: true, claims };
}

export async function assertSupabaseAuth(req: Request, env: Env): Promise<
  | {
      ok: true;
      principal: SupabaseAuthPrincipal;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const token = asBearerToken(req.headers.get('Authorization'));
  if (!token) {
    return { ok: false, response: json({ error: 'AUTH_REQUIRED' }, { status: 401 }) };
  }

  const cachedPrincipal = readCachedBerlinPrincipal(token);
  if (cachedPrincipal) {
    return { ok: true, principal: cachedPrincipal };
  }

  const signature = await verifyBerlinJwtSignature(token, env);
  if (!signature.ok) {
    const status = signature.reason === 'jwks_unavailable' ? 502 : 403;
    const error = signature.reason === 'jwks_unavailable' ? 'AUTH_PROVIDER_UNAVAILABLE' : 'AUTH_INVALID';
    return { ok: false, response: json({ error, reason: signature.reason }, { status }) };
  }

  const claims = signature.claims;
  const issuer = resolveBerlinIssuer(env);
  const audience = resolveBerlinAudience(env);
  const nowSec = Math.floor(Date.now() / 1000);

  const iss = claimAsString(claims.iss);
  if (!iss || iss !== issuer) {
    return { ok: false, response: json({ error: 'AUTH_INVALID', reason: 'issuer_mismatch' }, { status: 403 }) };
  }
  if (!audienceMatches(claims.aud, audience)) {
    return { ok: false, response: json({ error: 'AUTH_INVALID', reason: 'audience_mismatch' }, { status: 403 }) };
  }

  const exp = claimAsNumber(claims.exp);
  if (!exp || exp <= nowSec) {
    return { ok: false, response: json({ error: 'AUTH_EXPIRED' }, { status: 401 }) };
  }
  const nbf = claimAsNumber(claims.nbf);
  if (nbf && nbf > nowSec) {
    return { ok: false, response: json({ error: 'AUTH_INVALID', reason: 'token_not_yet_valid' }, { status: 403 }) };
  }

  const sub = claimAsString(claims.sub);
  if (!sub || !isUuid(sub)) {
    return { ok: false, response: json({ error: 'AUTH_INVALID', reason: 'subject_invalid' }, { status: 403 }) };
  }

  const principal = writeCachedBerlinPrincipal(
    token,
    {
      token,
      userId: sub,
      email: claimAsString(claims.email),
      role: claimAsString(claims.role),
      claims,
    },
    exp,
  );

  return {
    ok: true,
    principal,
  };
}

import { isUuid } from '@clickeen/ck-contracts';
import { json } from './http';
import type { Env } from './types';

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

export const INTERNAL_SERVICE_HEADER = 'x-ck-internal-service';
export const TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL = 'devstudio.local';
export const TOKYO_INTERNAL_SERVICE_PARIS_LOCAL = 'paris.local';

type UploadAuthResult =
  | { ok: true; principal: UploadPrincipal }
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
const DEFAULT_BERLIN_BASE_URL = 'https://berlin-dev.clickeen.workers.dev';

function asBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;
  return token.trim() || null;
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
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
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
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function claimAsString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeInternalServiceId(value: string | null): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
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
  if (Array.isArray(claim)) {
    return claim.some((item) => typeof item === 'string' && item.trim() === expected);
  }
  return false;
}

function resolveBerlinBaseUrl(env: Env): string {
  const configured = typeof env.BERLIN_BASE_URL === 'string' ? env.BERLIN_BASE_URL.trim() : '';
  return (configured || DEFAULT_BERLIN_BASE_URL).replace(/\/+$/, '');
}

function resolveBerlinIssuer(env: Env): string {
  const configured = (typeof env.BERLIN_ISSUER === 'string' ? env.BERLIN_ISSUER.trim() : '') || null;
  if (configured) return configured.replace(/\/+$/, '');
  return resolveBerlinBaseUrl(env);
}

function resolveBerlinAudience(env: Env): string {
  const configured = (typeof env.BERLIN_AUDIENCE === 'string' ? env.BERLIN_AUDIENCE.trim() : '') || null;
  return configured || 'clickeen.product';
}

function resolveBerlinJwksUrl(env: Env): string {
  const configured = (typeof env.BERLIN_JWKS_URL === 'string' ? env.BERLIN_JWKS_URL.trim() : '') || null;
  if (configured) return configured;
  return `${resolveBerlinBaseUrl(env)}/.well-known/jwks.json`;
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
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
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

async function importBerlinJwk(key: JsonWebKey): Promise<CryptoKey | null> {
  if (key.kty !== 'RSA') return null;
  if (!jwkKid(key)) return null;
  if (typeof key.n !== 'string' || typeof key.e !== 'string') return null;
  try {
    return await crypto.subtle.importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
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
    const bodySnippet = (await response.text().catch(() => '')).slice(0, 160);
    throw new Error(
      `Berlin JWKS lookup failed (${response.status}) url=${url}${bodySnippet ? ` body=${bodySnippet}` : ''}`,
    );
  }

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
): Promise<{ ok: true; claims: JwtClaims } | { ok: false; reason: string; detail?: string }> {
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: 'jwks_unavailable', detail };
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
    return {
      ok: false,
      response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } }, { status: 401 }),
    };
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
            ...(signature.reason === 'jwks_unavailable' ? { detail: signature.detail || signature.reason } : {}),
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
  return { ok: true, principal: { token, userId } };
}

export function requireDevAuth(
  req: Request,
  env: Env,
  options?: { allowTrustedInternalServices?: readonly string[] },
): Response | null {
  const expected = (env.TOKYO_DEV_JWT || '').trim();
  if (!expected) {
    return json({ error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.misconfigured' } }, { status: 500 });
  }
  const token = asBearerToken(req.headers.get('authorization'));
  if (!token) return json({ error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } }, { status: 401 });
  const internalServiceId = normalizeInternalServiceId(req.headers.get(INTERNAL_SERVICE_HEADER));
  if (
    token !== expected ||
    !internalServiceId ||
    !(options?.allowTrustedInternalServices ?? []).includes(internalServiceId)
  ) {
    return json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 });
  }
  return null;
}

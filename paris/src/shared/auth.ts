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
};

type SupabaseUserProfile = {
  id: string;
  email?: string | null;
  role?: string | null;
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

const SUPABASE_PRINCIPAL_CACHE_KEY = '__CK_PARIS_SUPABASE_PRINCIPAL_CACHE_V1__';
const SUPABASE_PRINCIPAL_CACHE_TTL_MS = 5 * 60_000;

type SupabasePrincipalCacheEntry = {
  principal: SupabaseAuthPrincipal;
  expiresAt: number;
};

type SupabasePrincipalStore = {
  cache: Record<string, SupabasePrincipalCacheEntry | undefined>;
};

function isSupabasePrincipalStore(value: unknown): value is SupabasePrincipalStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cache = record.cache;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;
  return true;
}

function resolveSupabasePrincipalStore(): SupabasePrincipalStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[SUPABASE_PRINCIPAL_CACHE_KEY];
  if (isSupabasePrincipalStore(existing)) return existing;
  const next: SupabasePrincipalStore = {
    cache: {},
  };
  scope[SUPABASE_PRINCIPAL_CACHE_KEY] = next;
  return next;
}

function readCachedSupabasePrincipal(token: string): SupabaseAuthPrincipal | null {
  const store = resolveSupabasePrincipalStore();
  const entry = store.cache[token];
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    delete store.cache[token];
    return null;
  }
  return entry.principal;
}

function writeCachedSupabasePrincipal(
  token: string,
  principal: SupabaseAuthPrincipal,
  tokenExpSec: number,
): SupabaseAuthPrincipal {
  const store = resolveSupabasePrincipalStore();
  const nowMs = Date.now();
  const tokenExpMs = tokenExpSec * 1000;
  const boundedExpiryMs = Math.min(nowMs + SUPABASE_PRINCIPAL_CACHE_TTL_MS, tokenExpMs);
  const expiresAt = Math.max(nowMs + 1_000, boundedExpiryMs);
  store.cache[token] = {
    principal,
    expiresAt,
  };
  return principal;
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
  | { ok: true; principal?: SupabaseAuthPrincipal; source: 'dev' | 'supabase' }
  | { ok: false; response: Response }
> {
  if (isTrustedInternalServiceRequest(req, env)) {
    return { ok: true as const, source: 'dev' };
  }

  const supabase = await assertSupabaseAuth(req, env);
  if ('response' in supabase) {
    return { ok: false as const, response: supabase.response };
  }

  return { ok: true as const, source: 'supabase', principal: supabase.principal };
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

function resolveSupabaseIssuer(env: Env): string {
  const configured = (typeof env.SUPABASE_JWT_ISSUER === 'string' ? env.SUPABASE_JWT_ISSUER.trim() : '') || null;
  if (configured) return configured.replace(/\/+$/, '');
  const base = requireEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  return `${base}/auth/v1`;
}

function resolveSupabaseAudience(env: Env): string {
  const configured = (typeof env.SUPABASE_JWT_AUDIENCE === 'string' ? env.SUPABASE_JWT_AUDIENCE.trim() : '') || null;
  return configured || 'authenticated';
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

async function fetchSupabaseUserProfile(token: string, env: Env): Promise<SupabaseUserProfile | null> {
  const baseUrl = requireEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const serviceKey = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
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
  if (!response.ok) {
    throw new Error(`Supabase auth lookup failed (${response.status})`);
  }

  const parsed = (await response.json()) as unknown;
  if (!isRecord(parsed)) return null;
  if (typeof parsed.id !== 'string') return null;
  return {
    id: parsed.id,
    email: typeof parsed.email === 'string' ? parsed.email : null,
    role: typeof parsed.role === 'string' ? parsed.role : null,
  };
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

  const claims = decodeJwtPayload(token);
  if (!claims) {
    return { ok: false, response: json({ error: 'AUTH_INVALID', reason: 'malformed_jwt' }, { status: 403 }) };
  }

  const issuer = resolveSupabaseIssuer(env);
  const audience = resolveSupabaseAudience(env);
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

  const cachedPrincipal = readCachedSupabasePrincipal(token);
  if (cachedPrincipal) {
    const sub = claimAsString(claims.sub);
    if (!sub || sub === cachedPrincipal.userId) {
      return { ok: true, principal: cachedPrincipal };
    }
  }

  let profile: SupabaseUserProfile | null = null;
  try {
    profile = await fetchSupabaseUserProfile(token, env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      response: json({ error: 'AUTH_PROVIDER_UNAVAILABLE', message }, { status: 502 }),
    };
  }
  if (!profile || !isUuid(profile.id)) {
    return { ok: false, response: json({ error: 'AUTH_INVALID' }, { status: 403 }) };
  }

  const sub = claimAsString(claims.sub);
  if (sub && sub !== profile.id) {
    return { ok: false, response: json({ error: 'AUTH_INVALID', reason: 'subject_mismatch' }, { status: 403 }) };
  }

  const principal = writeCachedSupabasePrincipal(
    token,
    {
      token,
      userId: profile.id,
      email: profile.email ?? null,
      role: profile.role ?? null,
      claims,
    },
    exp,
  );

  return {
    ok: true,
    principal,
  };
}

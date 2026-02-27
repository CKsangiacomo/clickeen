type Env = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  BERLIN_ISSUER?: string;
  BERLIN_AUDIENCE?: string;
  BERLIN_REFRESH_SECRET?: string;
  BERLIN_OAUTH_STATE_SECRET?: string;
  BERLIN_ALLOWED_PROVIDERS?: string;
  BERLIN_ACCESS_PRIVATE_KEY_PEM?: string;
  BERLIN_ACCESS_PUBLIC_KEY_PEM?: string;
  BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM?: string;
  BERLIN_ACCESS_PREVIOUS_KID?: string;
  BERLIN_SESSION_KV?: KVNamespace;
};

type JwtHeader = {
  alg?: string;
  typ?: string;
  kid?: string;
};

type AccessClaims = Record<string, unknown> & {
  sub?: string;
  sid?: string;
  ver?: number;
  iat?: number;
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
};

type SupabaseIdentity = {
  id?: string;
  identity_id?: string;
  provider?: string;
  identity_data?: {
    sub?: string;
  };
};

type SupabaseTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string;
    role?: string;
    identities?: SupabaseIdentity[];
  };
};

type SupabaseUserResponse = {
  id?: string;
  email?: string;
  role?: string;
  identities?: SupabaseIdentity[];
};

type RefreshPayloadV1 = {
  v: 1;
  sid: string;
  rti: string;
  ver: number;
  userId: string;
  supabaseRefreshToken: string;
  exp: number;
};

type RefreshPayloadV2 = {
  v: 2;
  sid: string;
  rti: string;
  ver: number;
  userId: string;
  exp: number;
};

type RefreshPayload = RefreshPayloadV1 | RefreshPayloadV2;

type SessionState = {
  sid: string;
  currentRti: string;
  userId: string;
  ver: number;
  revoked: boolean;
  supabaseRefreshToken: string;
  supabaseAccessToken?: string;
  supabaseAccessExp?: number;
  createdAt: number;
  updatedAt: number;
};

type SignedStatePayload = {
  v: 1;
  flow: 'login' | 'link';
  provider: string;
  codeVerifier: string;
  iat: number;
  exp: number;
  sid?: string;
  userId?: string;
};

type SessionIssueArgs = {
  sid?: string;
  ver?: number;
  userId: string;
  supabaseRefreshToken: string;
  supabaseAccessToken?: string | null;
  supabaseAccessExp?: number | null;
};

type SessionIssueResult = {
  sid: string;
  ver: number;
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
  expiresAt: string;
};

type RefreshResult =
  | { ok: true; payload: RefreshPayload }
  | { ok: false; reason: string };

type SigningPublic = {
  kid: string;
  publicKey: CryptoKey;
  publicJwk: PublicJwk;
};

type PublicJwk = JsonWebKey & {
  kid: string;
  alg: string;
  use: string;
};

type SigningContext = {
  kid: string;
  privateKey: CryptoKey;
  current: SigningPublic;
  previous?: SigningPublic;
};

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_TOKEN_SKEW_SECONDS = 30;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const REFRESH_TOKEN_PREFIX = 'ckr';
const DEFAULT_AUDIENCE = 'clickeen.product';
const DEFAULT_ISSUER = 'berlin.local';
const DEFAULT_REFRESH_SECRET = 'berlin-local-refresh-secret-change-me';

const SESSION_STORE_KEY = '__CK_BERLIN_SESSION_STORE_V2__';
const SESSION_USER_INDEX_STORE_KEY = '__CK_BERLIN_SESSION_USER_INDEX_V2__';
const SIGNING_CONTEXT_KEY = '__CK_BERLIN_SIGNING_CONTEXT_V2__';
const REFRESH_KEY_CACHE = '__CK_BERLIN_REFRESH_KEY_V2__';
const OAUTH_STATE_KEY_CACHE = '__CK_BERLIN_OAUTH_STATE_KEY_V1__';

const SESSION_KV_PREFIX = 'berlin:session:v1';
const USER_INDEX_KV_PREFIX = 'berlin:user-sessions:v1';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
} as const;

const enc = new TextEncoder();
const dec = new TextDecoder();

function json(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      ...CACHE_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function authError(reasonKey: string, status = 401, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'AUTH',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status },
  );
}

function validationError(reasonKey: string, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'VALIDATION',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status: 422 },
  );
}

function conflictError(reasonKey: string, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'AUTH',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status: 409 },
  );
}

function internalError(reasonKey: string, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'INTERNAL',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status: 500 },
  );
}

function methodNotAllowed(): Response {
  return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
}

function asBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;
  const trimmed = token.trim();
  return trimmed || null;
}

function normalizePem(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.includes('\\n') ? trimmed.replace(/\\n/g, '\n') : trimmed;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

function encodeJsonBase64Url(value: unknown): string {
  return toBase64Url(enc.encode(JSON.stringify(value)));
}

function decodeJsonBase64Url<T>(value: string): T | null {
  const bytes = fromBase64Url(value);
  if (!bytes) return null;
  try {
    return JSON.parse(dec.decode(bytes)) as T;
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

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function audienceMatches(claim: unknown, expected: string): boolean {
  if (typeof claim === 'string') return claim.trim() === expected;
  if (Array.isArray(claim)) return claim.some((item) => typeof item === 'string' && item.trim() === expected);
  return false;
}

function normalizeProvider(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function parseAllowedProviders(env: Env): Set<string> {
  const configured = (typeof env.BERLIN_ALLOWED_PROVIDERS === 'string' ? env.BERLIN_ALLOWED_PROVIDERS.trim() : '') ||
    'google';
  const values = configured
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values);
}

function resolveIssuer(env: Env): string {
  const configured = typeof env.BERLIN_ISSUER === 'string' ? env.BERLIN_ISSUER.trim() : '';
  return (configured || DEFAULT_ISSUER).replace(/\/+$/, '');
}

function resolveAudience(env: Env): string {
  const configured = typeof env.BERLIN_AUDIENCE === 'string' ? env.BERLIN_AUDIENCE.trim() : '';
  return configured || DEFAULT_AUDIENCE;
}

function resolveSupabaseConfig(env: Env): { baseUrl: string; anonKey: string } | null {
  const baseUrl = (typeof env.SUPABASE_URL === 'string' ? env.SUPABASE_URL.trim() : '').replace(/\/+$/, '');
  const anonKey = typeof env.SUPABASE_ANON_KEY === 'string' ? env.SUPABASE_ANON_KEY.trim() : '';
  if (!baseUrl || !anonKey) return null;
  return { baseUrl, anonKey };
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizePassword(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  return decodeJsonBase64Url<Record<string, unknown>>(parts[1] || '');
}

function resolveUserIdFromSupabaseResponse(payload: SupabaseTokenResponse): string | null {
  const fromUser = claimAsString(payload.user?.id);
  if (fromUser) return fromUser;
  const accessToken = claimAsString(payload.access_token);
  if (!accessToken) return null;
  const decoded = decodeJwtPayload(accessToken);
  if (!decoded) return null;
  return claimAsString(decoded.sub);
}

function resolveSupabaseAccessExp(nowSec: number, payload: SupabaseTokenResponse): number | null {
  const expiresIn = claimAsNumber(payload.expires_in);
  if (!expiresIn || expiresIn <= 0) return null;
  return nowSec + expiresIn;
}

function parseCookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const entries = header.split(';');
  for (const entry of entries) {
    const [rawName, ...rest] = entry.trim().split('=');
    if (!rawName || rawName !== name) continue;
    const joined = rest.join('=').trim();
    if (!joined) return null;
    try {
      return decodeURIComponent(joined);
    } catch {
      return joined;
    }
  }
  return null;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const parsed = (await request.json().catch(() => null)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function resolveSessionMemoryStore(): Map<string, SessionState> {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[SESSION_STORE_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, SessionState>;
  }
  const next = new Map<string, SessionState>();
  scope[SESSION_STORE_KEY] = next;
  return next;
}

function resolveUserSessionIndexMemoryStore(): Map<string, Set<string>> {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[SESSION_USER_INDEX_STORE_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, Set<string>>;
  }
  const next = new Map<string, Set<string>>();
  scope[SESSION_USER_INDEX_STORE_KEY] = next;
  return next;
}

function sessionKvKey(sid: string): string {
  return `${SESSION_KV_PREFIX}:${sid}`;
}

function userSessionIndexKvKey(userId: string): string {
  return `${USER_INDEX_KV_PREFIX}:${userId}`;
}

function toSessionState(value: unknown): SessionState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sid = claimAsString(record.sid);
  const currentRti = claimAsString(record.currentRti);
  const userId = claimAsString(record.userId);
  const ver = claimAsNumber(record.ver);
  const revoked = Boolean(record.revoked);
  const supabaseRefreshToken = claimAsString(record.supabaseRefreshToken);
  const supabaseAccessToken = claimAsString(record.supabaseAccessToken);
  const supabaseAccessExp = claimAsNumber(record.supabaseAccessExp);
  const createdAt = claimAsNumber(record.createdAt) || Date.now();
  const updatedAt = claimAsNumber(record.updatedAt) || Date.now();
  if (!sid || !currentRti || !userId || !ver || !supabaseRefreshToken) return null;
  return {
    sid,
    currentRti,
    userId,
    ver,
    revoked,
    supabaseRefreshToken,
    supabaseAccessToken: supabaseAccessToken || undefined,
    supabaseAccessExp: supabaseAccessExp || undefined,
    createdAt,
    updatedAt,
  };
}

async function loadSessionState(env: Env, sid: string): Promise<SessionState | null> {
  const memory = resolveSessionMemoryStore();
  const existing = memory.get(sid) || null;
  if (existing) return existing;

  const kv = env.BERLIN_SESSION_KV;
  if (!kv) return null;

  const raw = await kv.get(sessionKvKey(sid), 'json').catch(() => null);
  const parsed = toSessionState(raw);
  if (!parsed) return null;

  memory.set(sid, parsed);
  return parsed;
}

async function saveSessionState(env: Env, state: SessionState): Promise<void> {
  const next: SessionState = {
    ...state,
    updatedAt: Date.now(),
  };
  resolveSessionMemoryStore().set(next.sid, next);
  const kv = env.BERLIN_SESSION_KV;
  if (!kv) return;

  await kv.put(sessionKvKey(next.sid), JSON.stringify(next), {
    expirationTtl: REFRESH_TOKEN_TTL_SECONDS,
  });
}

async function loadUserSessionIds(env: Env, userId: string): Promise<string[]> {
  const memory = resolveUserSessionIndexMemoryStore();
  const fromMemory = memory.get(userId);
  if (fromMemory) return [...fromMemory];

  const kv = env.BERLIN_SESSION_KV;
  if (!kv) return [];

  const raw = await kv.get(userSessionIndexKvKey(userId), 'json').catch(() => null);
  if (!Array.isArray(raw)) return [];
  const ids = raw.map((value) => claimAsString(value)).filter((value): value is string => Boolean(value));
  memory.set(userId, new Set(ids));
  return ids;
}

async function saveUserSessionIds(env: Env, userId: string, sessionIds: string[]): Promise<void> {
  const unique = [...new Set(sessionIds.filter(Boolean))];
  resolveUserSessionIndexMemoryStore().set(userId, new Set(unique));

  const kv = env.BERLIN_SESSION_KV;
  if (!kv) return;

  await kv.put(userSessionIndexKvKey(userId), JSON.stringify(unique), {
    expirationTtl: REFRESH_TOKEN_TTL_SECONDS,
  });
}

async function addUserSessionId(env: Env, userId: string, sid: string): Promise<void> {
  const ids = await loadUserSessionIds(env, userId);
  if (ids.includes(sid)) return;
  ids.push(sid);
  await saveUserSessionIds(env, userId, ids);
}

async function revokeSessionBySid(env: Env, sid: string): Promise<void> {
  const state = await loadSessionState(env, sid);
  if (!state) return;
  if (state.revoked) return;
  await saveSessionState(env, { ...state, revoked: true });
}

async function revokeSessionsByUserId(env: Env, userId: string): Promise<number> {
  const ids = await loadUserSessionIds(env, userId);
  if (ids.length === 0) return 0;

  let count = 0;
  for (const sid of ids) {
    const state = await loadSessionState(env, sid);
    if (!state || state.revoked) continue;
    await saveSessionState(env, { ...state, revoked: true });
    count += 1;
  }
  return count;
}

async function importRsaPrivateKeyFromPem(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function importRsaPublicKeyFromPem(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify'],
  );
}

async function buildKid(publicJwk: JsonWebKey): Promise<string> {
  const payload = JSON.stringify({
    kty: publicJwk.kty,
    n: publicJwk.n,
    e: publicJwk.e,
  });
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(payload));
  return `berlin-${toBase64Url(new Uint8Array(digest)).slice(0, 16)}`;
}

async function exportSigningPublic(publicKey: CryptoKey, preferredKid?: string | null): Promise<SigningPublic> {
  const publicJwk = (await crypto.subtle.exportKey('jwk', publicKey)) as JsonWebKey;
  const kid = (preferredKid && preferredKid.trim()) || (await buildKid(publicJwk));
  const normalizedJwk: PublicJwk = {
    ...publicJwk,
    alg: 'RS256',
    use: 'sig',
    kid,
  };
  return {
    kid,
    publicKey,
    publicJwk: normalizedJwk,
  };
}

async function resolveSigningContext(env: Env): Promise<SigningContext> {
  const scope = globalThis as Record<string, unknown>;
  const cached = scope[SIGNING_CONTEXT_KEY];
  if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
    const record = cached as Partial<SigningContext>;
    if (record.privateKey && record.kid && record.current) {
      return record as SigningContext;
    }
  }

  const privatePem = normalizePem(env.BERLIN_ACCESS_PRIVATE_KEY_PEM || '');
  const publicPem = normalizePem(env.BERLIN_ACCESS_PUBLIC_KEY_PEM || '');

  let privateKey: CryptoKey;
  let publicKey: CryptoKey;

  if (privatePem && publicPem) {
    privateKey = await importRsaPrivateKeyFromPem(privatePem);
    publicKey = await importRsaPublicKeyFromPem(publicPem);
  } else {
    const generated = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    privateKey = generated.privateKey;
    publicKey = generated.publicKey;
  }

  const current = await exportSigningPublic(publicKey, null);

  let previous: SigningPublic | undefined;
  const previousPublicPem = normalizePem(env.BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM || '');
  if (previousPublicPem) {
    const previousPublicKey = await importRsaPublicKeyFromPem(previousPublicPem);
    previous = await exportSigningPublic(previousPublicKey, claimAsString(env.BERLIN_ACCESS_PREVIOUS_KID) || null);
    if (previous.kid === current.kid) previous = undefined;
  }

  const context: SigningContext = {
    kid: current.kid,
    privateKey,
    current,
    ...(previous ? { previous } : {}),
  };
  scope[SIGNING_CONTEXT_KEY] = context;
  return context;
}

async function resolveRefreshHmacKey(env: Env): Promise<CryptoKey> {
  const scope = globalThis as Record<string, unknown>;
  const cached = scope[REFRESH_KEY_CACHE];
  if (cached instanceof CryptoKey) return cached;

  const secret = (typeof env.BERLIN_REFRESH_SECRET === 'string' ? env.BERLIN_REFRESH_SECRET.trim() : '') ||
    DEFAULT_REFRESH_SECRET;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
  scope[REFRESH_KEY_CACHE] = key;
  return key;
}

async function resolveOauthStateHmacKey(env: Env): Promise<CryptoKey> {
  const scope = globalThis as Record<string, unknown>;
  const cached = scope[OAUTH_STATE_KEY_CACHE];
  if (cached instanceof CryptoKey) return cached;

  const secret =
    (typeof env.BERLIN_OAUTH_STATE_SECRET === 'string' ? env.BERLIN_OAUTH_STATE_SECRET.trim() : '') ||
    (typeof env.BERLIN_REFRESH_SECRET === 'string' ? env.BERLIN_REFRESH_SECRET.trim() : '') ||
    `${DEFAULT_REFRESH_SECRET}:oauth-state`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
  scope[OAUTH_STATE_KEY_CACHE] = key;
  return key;
}

async function signAccessToken(claims: AccessClaims, env: Env): Promise<string> {
  const context = await resolveSigningContext(env);
  const header: JwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
    kid: context.current.kid,
  };
  const encodedHeader = encodeJsonBase64Url(header);
  const encodedPayload = encodeJsonBase64Url(claims);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    context.privateKey,
    enc.encode(signingInput),
  );
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyAccessToken(token: string, env: Env): Promise<{ ok: true; claims: AccessClaims } | { ok: false; reason: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed_jwt' };

  const header = decodeJsonBase64Url<JwtHeader>(parts[0] || '');
  const claims = decodeJsonBase64Url<AccessClaims>(parts[1] || '');
  if (!header || !claims) return { ok: false, reason: 'malformed_jwt' };
  if (header.alg !== 'RS256') return { ok: false, reason: 'unsupported_alg' };

  const context = await resolveSigningContext(env);
  const keyByKid = new Map<string, CryptoKey>();
  keyByKid.set(context.current.kid, context.current.publicKey);
  if (context.previous) keyByKid.set(context.previous.kid, context.previous.publicKey);

  const requestedKid = claimAsString(header.kid);
  if (!requestedKid) return { ok: false, reason: 'missing_kid' };
  const verifyKey = keyByKid.get(requestedKid) || null;
  if (!verifyKey) return { ok: false, reason: 'unknown_kid' };

  const signature = fromBase64Url(parts[2] || '');
  if (!signature) return { ok: false, reason: 'malformed_signature' };

  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    verifyKey,
    toArrayBuffer(signature),
    enc.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) return { ok: false, reason: 'invalid_signature' };

  const nowSec = Math.floor(Date.now() / 1000);
  const issuer = resolveIssuer(env);
  const audience = resolveAudience(env);

  const iss = claimAsString(claims.iss);
  if (!iss || iss !== issuer) return { ok: false, reason: 'issuer_mismatch' };
  if (!audienceMatches(claims.aud, audience)) return { ok: false, reason: 'audience_mismatch' };

  const exp = claimAsNumber(claims.exp);
  if (!exp || exp <= nowSec - ACCESS_TOKEN_SKEW_SECONDS) return { ok: false, reason: 'token_expired' };

  const nbf = claimAsNumber(claims.nbf);
  if (nbf && nbf > nowSec + ACCESS_TOKEN_SKEW_SECONDS) return { ok: false, reason: 'token_not_yet_valid' };

  const sub = claimAsString(claims.sub);
  const sid = claimAsString(claims.sid);
  if (!sub || !sid) return { ok: false, reason: 'missing_subject' };

  const state = await loadSessionState(env, sid);
  if (state?.revoked) return { ok: false, reason: 'session_revoked' };

  return { ok: true, claims };
}

async function signRefreshToken(payload: RefreshPayloadV2, env: Env): Promise<string> {
  const key = await resolveRefreshHmacKey(env);
  const encodedPayload = encodeJsonBase64Url(payload);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(encodedPayload));
  return `${REFRESH_TOKEN_PREFIX}.${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyRefreshToken(token: string, env: Env, options: { allowExpired?: boolean } = {}): Promise<RefreshResult> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed_refresh' };
  if (parts[0] !== REFRESH_TOKEN_PREFIX) return { ok: false, reason: 'invalid_refresh_prefix' };

  const signatureBytes = fromBase64Url(parts[2] || '');
  if (!signatureBytes) return { ok: false, reason: 'invalid_refresh_signature' };

  const key = await resolveRefreshHmacKey(env);
  const verified = await crypto.subtle.verify('HMAC', key, toArrayBuffer(signatureBytes), enc.encode(parts[1] || ''));
  if (!verified) return { ok: false, reason: 'invalid_refresh_signature' };

  const payloadRaw = decodeJsonBase64Url<Record<string, unknown>>(parts[1] || '');
  if (!payloadRaw) return { ok: false, reason: 'invalid_refresh_payload' };

  const version = claimAsNumber(payloadRaw.v);
  const sid = claimAsString(payloadRaw.sid);
  const rti = claimAsString(payloadRaw.rti);
  const userId = claimAsString(payloadRaw.userId);
  const ver = claimAsNumber(payloadRaw.ver);
  const exp = claimAsNumber(payloadRaw.exp);
  if (!version || !sid || !rti || !userId || !ver || !exp) {
    return { ok: false, reason: 'invalid_refresh_payload' };
  }

  let payload: RefreshPayload;
  if (version === 1) {
    const supabaseRefreshToken = claimAsString(payloadRaw.supabaseRefreshToken);
    if (!supabaseRefreshToken) return { ok: false, reason: 'invalid_refresh_payload' };
    payload = {
      v: 1,
      sid,
      rti,
      userId,
      ver,
      supabaseRefreshToken,
      exp,
    };
  } else if (version === 2) {
    payload = {
      v: 2,
      sid,
      rti,
      userId,
      ver,
      exp,
    };
  } else {
    return { ok: false, reason: 'invalid_refresh_payload' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!options.allowExpired && payload.exp <= nowSec) {
    return { ok: false, reason: 'refresh_expired' };
  }

  return { ok: true, payload };
}

async function encodeSignedState(payload: SignedStatePayload, env: Env): Promise<string> {
  const body = encodeJsonBase64Url(payload);
  const key = await resolveOauthStateHmacKey(env);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

async function decodeSignedState(value: string, env: Env): Promise<SignedStatePayload | null> {
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const body = parts[0] || '';
  const signature = fromBase64Url(parts[1] || '');
  if (!signature) return null;

  const key = await resolveOauthStateHmacKey(env);
  const verified = await crypto.subtle.verify('HMAC', key, toArrayBuffer(signature), enc.encode(body));
  if (!verified) return null;

  const payload = decodeJsonBase64Url<SignedStatePayload>(body);
  if (!payload || payload.v !== 1) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) return null;
  if (!payload.iat || payload.iat > nowSec + ACCESS_TOKEN_SKEW_SECONDS) return null;
  if (!payload.provider || !payload.codeVerifier || !payload.flow) return null;

  return payload;
}

function createPkceCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

async function createPkceCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(codeVerifier));
  return toBase64Url(new Uint8Array(digest));
}

async function requestSupabasePasswordGrant(
  env: Env,
  email: string,
  password: string,
): Promise<{ ok: true; payload: SupabaseTokenResponse } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json().catch(() => null)) as SupabaseTokenResponse | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).msg === 'string'
        ? String((payload as Record<string, unknown>).msg)
        : '';
    const invalid = response.status === 400 || response.status === 401 || message.includes('Invalid login credentials');
    return {
      ok: false,
      status: invalid ? 401 : 502,
      reason: invalid ? 'coreui.errors.auth.invalid_credentials' : 'coreui.errors.auth.login_failed',
      detail: message || undefined,
    };
  }

  if (!payload || typeof payload !== 'object') {
    return { ok: false, status: 502, reason: 'coreui.errors.auth.login_failed' };
  }

  return { ok: true, payload };
}

async function requestSupabaseRefreshGrant(
  env: Env,
  refreshToken: string,
): Promise<{ ok: true; payload: SupabaseTokenResponse } | { ok: false; status: number; reason: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const payload = (await response.json().catch(() => null)) as SupabaseTokenResponse | null;
  if (!response.ok || !payload || typeof payload !== 'object') {
    return { ok: false, status: response.status === 401 ? 401 : 502, reason: 'coreui.errors.auth.required' };
  }

  return { ok: true, payload };
}

async function requestSupabasePkceGrant(
  env: Env,
  authCode: string,
  codeVerifier: string,
): Promise<{ ok: true; payload: SupabaseTokenResponse } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
  });

  const payload = (await response.json().catch(() => null)) as SupabaseTokenResponse | null;
  if (!response.ok || !payload || typeof payload !== 'object') {
    const detail = payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).msg === 'string'
      ? String((payload as Record<string, unknown>).msg)
      : undefined;
    return { ok: false, status: response.status === 401 ? 401 : 502, reason: 'coreui.errors.auth.provider.exchangeFailed', detail };
  }

  return { ok: true, payload };
}

async function requestSupabaseOAuthUrl(
  env: Env,
  args: {
    provider: string;
    redirectTo: string;
    state: string;
    codeChallenge: string;
    scopes?: string;
    jwt?: string;
    link?: boolean;
  },
): Promise<{ ok: true; url: string } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const params = new URLSearchParams();
  params.set('provider', args.provider);
  params.set('redirect_to', args.redirectTo);
  params.set('state', args.state);
  params.set('code_challenge', args.codeChallenge);
  params.set('code_challenge_method', 's256');
  params.set('skip_http_redirect', 'true');
  if (args.scopes) params.set('scopes', args.scopes);

  const endpoint = args.link ? '/auth/v1/user/identities/authorize' : '/auth/v1/authorize';
  const headers: Record<string, string> = {
    apikey: config.anonKey,
    accept: 'application/json',
  };
  if (args.jwt) headers.authorization = `Bearer ${args.jwt}`;

  const response = await fetch(`${config.baseUrl}${endpoint}?${params.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload) {
    const detail = payload && typeof payload.msg === 'string' ? payload.msg : undefined;
    return {
      ok: false,
      status: response.status === 401 ? 401 : 502,
      reason: args.link ? 'coreui.errors.auth.provider.linkFailed' : 'coreui.errors.auth.provider.notEnabled',
      detail,
    };
  }

  const url = claimAsString(payload.url);
  if (!url) {
    return { ok: false, status: 502, reason: 'coreui.errors.auth.provider.notEnabled', detail: 'missing_oauth_url' };
  }

  return { ok: true, url };
}

async function requestSupabaseUser(
  env: Env,
  supabaseAccessToken: string,
): Promise<{ ok: true; user: SupabaseUserResponse } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${supabaseAccessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as SupabaseUserResponse | null;
  if (!response.ok || !payload || typeof payload !== 'object') {
    return { ok: false, status: response.status === 401 ? 401 : 502, reason: 'coreui.errors.auth.required' };
  }

  return { ok: true, user: payload };
}

async function requestSupabaseUnlinkIdentity(
  env: Env,
  supabaseAccessToken: string,
  identityId: string,
): Promise<{ ok: true } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/user/identities/${encodeURIComponent(identityId)}`, {
    method: 'DELETE',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${supabaseAccessToken}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });

  if (response.ok) return { ok: true };

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const detail = payload && typeof payload.msg === 'string' ? payload.msg : undefined;
  return {
    ok: false,
    status: response.status === 401 ? 401 : 502,
    reason: 'coreui.errors.auth.provider.unlinkFailed',
    detail,
  };
}

async function issueSession(env: Env, args: SessionIssueArgs): Promise<SessionIssueResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  const sid = args.sid || crypto.randomUUID();
  const existing = args.sid ? await loadSessionState(env, sid) : null;
  const ver = Number.isFinite(args.ver) && (args.ver as number) > 0 ? (args.ver as number) : existing?.ver || 1;
  const rti = crypto.randomUUID();

  const claims: AccessClaims = {
    sub: args.userId,
    sid,
    ver,
    iat: nowSec,
    exp: nowSec + ACCESS_TOKEN_TTL_SECONDS,
    iss: resolveIssuer(env),
    aud: resolveAudience(env),
  };

  const refreshPayload: RefreshPayloadV2 = {
    v: 2,
    sid,
    rti,
    ver,
    userId: args.userId,
    exp: nowSec + REFRESH_TOKEN_TTL_SECONDS,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(claims, env),
    signRefreshToken(refreshPayload, env),
  ]);

  const nextState: SessionState = {
    sid,
    currentRti: rti,
    userId: args.userId,
    ver,
    revoked: false,
    supabaseRefreshToken: args.supabaseRefreshToken,
    supabaseAccessToken: claimAsString(args.supabaseAccessToken) || undefined,
    supabaseAccessExp: args.supabaseAccessExp && args.supabaseAccessExp > nowSec ? args.supabaseAccessExp : undefined,
    createdAt: existing?.createdAt || nowMs,
    updatedAt: nowMs,
  };

  await saveSessionState(env, nextState);
  await addUserSessionId(env, args.userId, sid);

  return {
    sid,
    ver,
    accessToken,
    refreshToken,
    accessTokenMaxAge: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenMaxAge: REFRESH_TOKEN_TTL_SECONDS,
    expiresAt: new Date((nowSec + ACCESS_TOKEN_TTL_SECONDS) * 1000).toISOString(),
  };
}

function resolveRefreshTokenFromRequest(request: Request, body: Record<string, unknown> | null): string | null {
  const fromBody = claimAsString(body?.refreshToken);
  if (fromBody) return fromBody;

  const fromCookie = parseCookieValue(request, 'ck-refresh-token');
  if (fromCookie) return fromCookie;

  const bearer = asBearerToken(request.headers.get('authorization'));
  if (bearer && bearer.startsWith(`${REFRESH_TOKEN_PREFIX}.`)) return bearer;

  return null;
}

function resolveAccessTokenFromRequest(request: Request): string | null {
  const fromBearer = asBearerToken(request.headers.get('authorization'));
  if (fromBearer && !fromBearer.startsWith(`${REFRESH_TOKEN_PREFIX}.`)) return fromBearer;

  const fromCookie = parseCookieValue(request, 'ck-access-token');
  if (fromCookie) return fromCookie;

  return null;
}

async function resolvePrincipalSession(
  request: Request,
  env: Env,
): Promise<
  | { ok: true; userId: string; sid: string; session: SessionState }
  | { ok: false; response: Response }
> {
  const token = resolveAccessTokenFromRequest(request);
  if (!token) return { ok: false, response: authError('coreui.errors.auth.required', 401) };

  const verified = await verifyAccessToken(token, env);
  if (!verified.ok) return { ok: false, response: authError('coreui.errors.auth.required', 401, verified.reason) };

  const userId = claimAsString(verified.claims.sub);
  const sid = claimAsString(verified.claims.sid);
  if (!userId || !sid) return { ok: false, response: authError('coreui.errors.auth.required', 401, 'missing_subject') };

  const session = await loadSessionState(env, sid);
  if (!session || session.revoked) return { ok: false, response: authError('coreui.errors.auth.required', 401, 'session_revoked') };
  if (session.userId !== userId) return { ok: false, response: authError('coreui.errors.auth.required', 401, 'session_subject_mismatch') };

  return { ok: true, userId, sid, session };
}

async function ensureSupabaseAccessToken(
  env: Env,
  session: SessionState,
): Promise<
  | { ok: true; session: SessionState; accessToken: string }
  | { ok: false; response: Response }
> {
  const nowSec = Math.floor(Date.now() / 1000);
  const currentAccess = claimAsString(session.supabaseAccessToken);
  const currentExp = claimAsNumber(session.supabaseAccessExp);

  if (currentAccess && currentExp && currentExp > nowSec + 60) {
    return { ok: true, session, accessToken: currentAccess };
  }

  const grant = await requestSupabaseRefreshGrant(env, session.supabaseRefreshToken);
  if (!grant.ok) {
    await saveSessionState(env, { ...session, revoked: true });
    return { ok: false, response: authError('coreui.errors.auth.required', grant.status, grant.reason) };
  }

  const refreshedUserId = resolveUserIdFromSupabaseResponse(grant.payload);
  const refreshedAccess = claimAsString(grant.payload.access_token);
  const refreshedRefresh = claimAsString(grant.payload.refresh_token);
  if (!refreshedUserId || !refreshedAccess || !refreshedRefresh || refreshedUserId !== session.userId) {
    await saveSessionState(env, { ...session, revoked: true });
    return { ok: false, response: authError('coreui.errors.auth.required', 401, 'refresh_subject_mismatch') };
  }

  const refreshedExp = resolveSupabaseAccessExp(nowSec, grant.payload);
  const nextSession: SessionState = {
    ...session,
    supabaseRefreshToken: refreshedRefresh,
    supabaseAccessToken: refreshedAccess,
    supabaseAccessExp: refreshedExp || undefined,
    updatedAt: Date.now(),
  };
  await saveSessionState(env, nextSession);

  return { ok: true, session: nextSession, accessToken: refreshedAccess };
}

function toIdentityRecord(identity: SupabaseIdentity): { identityId: string; provider: string; providerSubject: string | null } | null {
  const identityId = claimAsString(identity.identity_id) || claimAsString(identity.id);
  const provider = normalizeProvider(identity.provider);
  const providerSubject = claimAsString(identity.identity_data?.sub);
  if (!identityId || !provider) return null;
  return {
    identityId,
    provider,
    providerSubject,
  };
}

async function handlePasswordLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body?.email);
  const password = normalizePassword(body?.password);
  if (!email || !password) {
    return validationError('coreui.errors.auth.invalid_credentials');
  }

  const grant = await requestSupabasePasswordGrant(env, email, password);
  if (!grant.ok) return authError(grant.reason, grant.status, grant.detail);

  const nowSec = Math.floor(Date.now() / 1000);
  const supabaseAccessToken = claimAsString(grant.payload.access_token);
  const supabaseRefreshToken = claimAsString(grant.payload.refresh_token);
  const userId = resolveUserIdFromSupabaseResponse(grant.payload);
  if (!supabaseAccessToken || !supabaseRefreshToken || !userId) {
    return authError('coreui.errors.auth.login_failed', 502);
  }

  const session = await issueSession(env, {
    userId,
    supabaseRefreshToken,
    supabaseAccessToken,
    supabaseAccessExp: resolveSupabaseAccessExp(nowSec, grant.payload),
  });

  return json({
    ok: true,
    sessionId: session.sid,
    userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
  });
}

async function handleProviderLoginStart(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const provider = normalizeProvider(body?.provider);
  if (!provider) return validationError('coreui.errors.auth.provider.invalid');

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(provider)) {
    return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${provider}`);
  }

  const codeVerifier = createPkceCodeVerifier();
  const codeChallenge = await createPkceCodeChallenge(codeVerifier);
  const nowSec = Math.floor(Date.now() / 1000);
  const statePayload: SignedStatePayload = {
    v: 1,
    flow: 'login',
    provider,
    codeVerifier,
    iat: nowSec,
    exp: nowSec + OAUTH_STATE_TTL_SECONDS,
  };
  const state = await encodeSignedState(statePayload, env);

  const callbackUrl = `${resolveIssuer(env)}/auth/login/provider/callback`;
  const oauth = await requestSupabaseOAuthUrl(env, {
    provider,
    redirectTo: callbackUrl,
    state,
    codeChallenge,
  });
  if (!oauth.ok) return authError(oauth.reason, oauth.status, oauth.detail);

  return json({
    ok: true,
    provider,
    url: oauth.url,
    expiresAt: new Date(statePayload.exp * 1000).toISOString(),
  });
}

async function handleProviderLoginCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const error = claimAsString(url.searchParams.get('error'));
  const errorDescription = claimAsString(url.searchParams.get('error_description'));
  if (error) {
    return authError('coreui.errors.auth.provider.denied', 401, `${error}${errorDescription ? `: ${errorDescription}` : ''}`);
  }

  const authCode = claimAsString(url.searchParams.get('code'));
  const stateToken = claimAsString(url.searchParams.get('state'));
  if (!authCode || !stateToken) return validationError('coreui.errors.auth.provider.invalidCallback');

  const state = await decodeSignedState(stateToken, env);
  if (!state || state.flow !== 'login') return validationError('coreui.errors.auth.provider.invalidCallback');

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(state.provider)) return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${state.provider}`);

  const grant = await requestSupabasePkceGrant(env, authCode, state.codeVerifier);
  if (!grant.ok) return authError(grant.reason, grant.status, grant.detail);

  const nowSec = Math.floor(Date.now() / 1000);
  const supabaseAccessToken = claimAsString(grant.payload.access_token);
  const supabaseRefreshToken = claimAsString(grant.payload.refresh_token);
  const userId = resolveUserIdFromSupabaseResponse(grant.payload);
  if (!supabaseAccessToken || !supabaseRefreshToken || !userId) {
    return authError('coreui.errors.auth.provider.exchangeFailed', 502);
  }

  const session = await issueSession(env, {
    userId,
    supabaseRefreshToken,
    supabaseAccessToken,
    supabaseAccessExp: resolveSupabaseAccessExp(nowSec, grant.payload),
  });

  return json({
    ok: true,
    provider: state.provider,
    sessionId: session.sid,
    userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
  });
}

async function handleLinkStart(request: Request, env: Env): Promise<Response> {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return principal.response;

  const body = await readJsonBody(request);
  const provider = normalizeProvider(body?.provider);
  if (!provider) return validationError('coreui.errors.auth.provider.invalid');

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(provider)) {
    return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${provider}`);
  }

  const supabaseAuth = await ensureSupabaseAccessToken(env, principal.session);
  if (!supabaseAuth.ok) return supabaseAuth.response;

  const userLookup = await requestSupabaseUser(env, supabaseAuth.accessToken);
  if (!userLookup.ok) return authError(userLookup.reason, userLookup.status, userLookup.detail);

  const identities = Array.isArray(userLookup.user.identities)
    ? userLookup.user.identities.map(toIdentityRecord).filter((value): value is NonNullable<typeof value> => Boolean(value))
    : [];
  if (identities.some((identity) => identity.provider === provider)) {
    return conflictError('coreui.errors.auth.provider.alreadyLinked', `provider=${provider}`);
  }

  const codeVerifier = createPkceCodeVerifier();
  const codeChallenge = await createPkceCodeChallenge(codeVerifier);
  const nowSec = Math.floor(Date.now() / 1000);
  const statePayload: SignedStatePayload = {
    v: 1,
    flow: 'link',
    provider,
    codeVerifier,
    sid: principal.sid,
    userId: principal.userId,
    iat: nowSec,
    exp: nowSec + OAUTH_STATE_TTL_SECONDS,
  };
  const state = await encodeSignedState(statePayload, env);

  const callbackUrl = `${resolveIssuer(env)}/auth/link/callback`;
  const oauth = await requestSupabaseOAuthUrl(env, {
    provider,
    redirectTo: callbackUrl,
    state,
    codeChallenge,
    jwt: supabaseAuth.accessToken,
    link: true,
  });
  if (!oauth.ok) return authError(oauth.reason, oauth.status, oauth.detail);

  return json({
    ok: true,
    provider,
    url: oauth.url,
    expiresAt: new Date(statePayload.exp * 1000).toISOString(),
  });
}

async function handleLinkCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const error = claimAsString(url.searchParams.get('error'));
  const errorDescription = claimAsString(url.searchParams.get('error_description'));
  if (error) {
    return authError('coreui.errors.auth.provider.linkFailed', 401, `${error}${errorDescription ? `: ${errorDescription}` : ''}`);
  }

  const authCode = claimAsString(url.searchParams.get('code'));
  const stateToken = claimAsString(url.searchParams.get('state'));
  if (!authCode || !stateToken) return validationError('coreui.errors.auth.provider.invalidCallback');

  const state = await decodeSignedState(stateToken, env);
  if (!state || state.flow !== 'link' || !state.sid || !state.userId) {
    return validationError('coreui.errors.auth.provider.invalidCallback');
  }

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(state.provider)) return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${state.provider}`);

  const existing = await loadSessionState(env, state.sid);
  if (!existing || existing.revoked) return authError('coreui.errors.auth.required', 401, 'session_revoked');
  if (existing.userId !== state.userId) return authError('coreui.errors.auth.required', 401, 'session_subject_mismatch');

  const grant = await requestSupabasePkceGrant(env, authCode, state.codeVerifier);
  if (!grant.ok) return authError(grant.reason, grant.status, grant.detail);

  const nowSec = Math.floor(Date.now() / 1000);
  const supabaseAccessToken = claimAsString(grant.payload.access_token);
  const supabaseRefreshToken = claimAsString(grant.payload.refresh_token);
  const userId = resolveUserIdFromSupabaseResponse(grant.payload);
  if (!supabaseAccessToken || !supabaseRefreshToken || !userId) {
    return authError('coreui.errors.auth.provider.linkFailed', 502);
  }

  if (userId !== state.userId) {
    return conflictError('coreui.errors.auth.provider.linkConflict', 'provider_identity_owned_by_another_user');
  }

  const session = await issueSession(env, {
    sid: state.sid,
    ver: existing.ver,
    userId,
    supabaseRefreshToken,
    supabaseAccessToken,
    supabaseAccessExp: resolveSupabaseAccessExp(nowSec, grant.payload),
  });

  return json({
    ok: true,
    provider: state.provider,
    sessionId: session.sid,
    userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
  });
}

async function handleUnlink(request: Request, env: Env): Promise<Response> {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return principal.response;

  const body = await readJsonBody(request);
  const provider = normalizeProvider(body?.provider);
  const requestedIdentityId = claimAsString(body?.identityId);
  if (!provider && !requestedIdentityId) {
    return validationError('coreui.errors.auth.provider.invalid');
  }

  const supabaseAuth = await ensureSupabaseAccessToken(env, principal.session);
  if (!supabaseAuth.ok) return supabaseAuth.response;

  const userLookup = await requestSupabaseUser(env, supabaseAuth.accessToken);
  if (!userLookup.ok) return authError(userLookup.reason, userLookup.status, userLookup.detail);

  const identities = Array.isArray(userLookup.user.identities)
    ? userLookup.user.identities.map(toIdentityRecord).filter((value): value is NonNullable<typeof value> => Boolean(value))
    : [];

  if (identities.length <= 1) {
    return conflictError('coreui.errors.auth.provider.unlink.lastMethod');
  }

  const candidate = identities.find((identity) => {
    if (requestedIdentityId && identity.identityId === requestedIdentityId) return true;
    if (provider && identity.provider === provider) return true;
    return false;
  });

  if (!candidate) {
    return validationError('coreui.errors.auth.provider.unlink.notFound');
  }

  const unlink = await requestSupabaseUnlinkIdentity(env, supabaseAuth.accessToken, candidate.identityId);
  if (!unlink.ok) return authError(unlink.reason, unlink.status, unlink.detail);

  return json({
    ok: true,
    provider: candidate.provider,
    identityId: candidate.identityId,
  });
}

async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const refreshToken = resolveRefreshTokenFromRequest(request, body);
  if (!refreshToken) return authError('coreui.errors.auth.required', 401);

  const verified = await verifyRefreshToken(refreshToken, env);
  if (!verified.ok) return authError('coreui.errors.auth.required', 401, verified.reason);

  const payload = verified.payload;
  let state = await loadSessionState(env, payload.sid);

  if (!state && payload.v === 1) {
    state = {
      sid: payload.sid,
      currentRti: payload.rti,
      userId: payload.userId,
      ver: payload.ver,
      revoked: false,
      supabaseRefreshToken: payload.supabaseRefreshToken,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveSessionState(env, state);
    await addUserSessionId(env, state.userId, state.sid);
  }

  if (!state) return authError('coreui.errors.auth.required', 401, 'session_not_found');
  if (state.revoked) return authError('coreui.errors.auth.required', 401, 'session_revoked');

  if (state.currentRti !== payload.rti) {
    await saveSessionState(env, { ...state, revoked: true });
    return authError('coreui.errors.auth.required', 401, 'refresh_reuse_detected');
  }

  const grant = await requestSupabaseRefreshGrant(env, state.supabaseRefreshToken);
  if (!grant.ok) {
    await saveSessionState(env, { ...state, revoked: true });
    return authError('coreui.errors.auth.required', grant.status, grant.reason);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const userId = resolveUserIdFromSupabaseResponse(grant.payload);
  const supabaseAccessToken = claimAsString(grant.payload.access_token);
  const supabaseRefreshToken = claimAsString(grant.payload.refresh_token);
  if (!userId || !supabaseAccessToken || !supabaseRefreshToken || userId !== state.userId) {
    await saveSessionState(env, { ...state, revoked: true });
    return authError('coreui.errors.auth.required', 401, 'refresh_subject_mismatch');
  }

  const session = await issueSession(env, {
    sid: state.sid,
    ver: state.ver,
    userId,
    supabaseRefreshToken,
    supabaseAccessToken,
    supabaseAccessExp: resolveSupabaseAccessExp(nowSec, grant.payload),
  });

  return json({
    ok: true,
    sessionId: session.sid,
    userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
  });
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const all = body?.all === true || claimAsString(body?.scope) === 'user';

  if (all) {
    const principal = await resolvePrincipalSession(request, env);
    if (!principal.ok) return principal.response;
    const revokedCount = await revokeSessionsByUserId(env, principal.userId);
    return json({ ok: true, revokedScope: 'user', revokedCount });
  }

  const refreshToken = resolveRefreshTokenFromRequest(request, body);
  if (!refreshToken) return json({ ok: true });

  const verified = await verifyRefreshToken(refreshToken, env, { allowExpired: true });
  if (!verified.ok) return json({ ok: true });

  await revokeSessionBySid(env, verified.payload.sid);
  return json({ ok: true, revokedScope: 'sid', sid: verified.payload.sid });
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const bearer = resolveAccessTokenFromRequest(request);
  if (!bearer) return authError('coreui.errors.auth.required', 401);

  const verified = await verifyAccessToken(bearer, env);
  if (!verified.ok) return authError('coreui.errors.auth.required', 401, verified.reason);

  return json({
    ok: true,
    valid: true,
    userId: claimAsString(verified.claims.sub),
    sid: claimAsString(verified.claims.sid),
    exp: claimAsNumber(verified.claims.exp),
    iss: claimAsString(verified.claims.iss),
    aud: verified.claims.aud,
  });
}

async function handleJwks(env: Env): Promise<Response> {
  const signing = await resolveSigningContext(env);
  const keys = [signing.current.publicJwk];
  if (signing.previous) keys.push(signing.previous.publicJwk);
  return json({ keys });
}

function handleHealthz(): Response {
  return json({ ok: true, service: 'berlin' });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (pathname === '/internal/healthz') {
        if (request.method !== 'GET') return methodNotAllowed();
        return handleHealthz();
      }

      if (pathname === '/.well-known/jwks.json') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleJwks(env);
      }

      if (pathname === '/auth/login/password') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handlePasswordLogin(request, env);
      }

      if (pathname === '/auth/login/provider/start') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleProviderLoginStart(request, env);
      }

      if (pathname === '/auth/login/provider/callback') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleProviderLoginCallback(request, env);
      }

      if (pathname === '/auth/link/start') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleLinkStart(request, env);
      }

      if (pathname === '/auth/link/callback') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleLinkCallback(request, env);
      }

      if (pathname === '/auth/unlink') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleUnlink(request, env);
      }

      if (pathname === '/auth/refresh') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleRefresh(request, env);
      }

      if (pathname === '/auth/logout') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleLogout(request, env);
      }

      if (pathname === '/auth/session' || pathname === '/auth/validate') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleSession(request, env);
      }

      return json({ error: 'NOT_FOUND' }, { status: 404 });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return internalError('berlin.errors.unexpected', detail);
    }
  },
};

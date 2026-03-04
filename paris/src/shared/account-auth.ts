import type { MemberRole } from '@clickeen/ck-policy';
import type { AccountRow, Env } from './types';
import type { SupabaseAuthPrincipal } from './auth';
import { assertDevAuth, isTrustedInternalServiceRequest } from './auth';
import { readRomaAuthzCapsuleHeader, verifyRomaAccountAuthzCapsule, type RomaAccountAuthzCapsulePayload } from './authz-capsule';
import { ckError } from './errors';
import { readJson } from './http';
import { supabaseFetch } from './supabase';
import { requireAccount } from './accounts';

type AccountMembershipRow = {
  role: string;
};

type AccountAuthResult =
  | {
      ok: true;
      auth: { source: 'dev' | 'berlin'; principal?: SupabaseAuthPrincipal };
      account: AccountRow;
      role: MemberRole;
    }
  | {
      ok: false;
      response: Response;
    };

function isInternalAccountServicePathAllowed(req: Request): boolean {
  const pathname = new URL(req.url).pathname;
  if (/^\/api\/accounts\/[^/]+\/instance\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/accounts\/[^/]+\/instances\/[^/]+\/layers\/locale\/[^/]+$/.test(pathname)) return true;
  return false;
}

function normalizeRole(value: unknown): MemberRole | null {
  switch (value) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return value;
    default:
      return null;
  }
}

const ACCOUNT_MEMBERSHIP_CACHE_TTL_MS = 20_000;
const ACCOUNT_MEMBERSHIP_STORE_KEY = '__CK_PARIS_ACCOUNT_MEMBERSHIP_CACHE_V1__';

type AccountMembershipCacheEntry = {
  role: MemberRole | null;
  expiresAt: number;
};

type AccountMembershipStore = {
  cache: Record<string, AccountMembershipCacheEntry | undefined>;
  inFlight: Record<string, Promise<MemberRole | null> | undefined>;
};

function isAccountMembershipStore(value: unknown): value is AccountMembershipStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cache = record.cache;
  const inFlight = record.inFlight;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;
  if (!inFlight || typeof inFlight !== 'object' || Array.isArray(inFlight)) return false;
  return true;
}

function resolveAccountMembershipStore(): AccountMembershipStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[ACCOUNT_MEMBERSHIP_STORE_KEY];
  if (isAccountMembershipStore(existing)) return existing;
  const next: AccountMembershipStore = { cache: {}, inFlight: {} };
  scope[ACCOUNT_MEMBERSHIP_STORE_KEY] = next;
  return next;
}

function toMembershipCacheKey(accountId: string, userId: string): string {
  return `${accountId}:${userId}`;
}

function roleRank(role: MemberRole): number {
  switch (role) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'editor':
      return 2;
    case 'viewer':
      return 1;
    default:
      return 0;
  }
}

async function resolveAccountMembershipRole(env: Env, accountId: string, userId: string): Promise<MemberRole | null> {
  const key = toMembershipCacheKey(accountId, userId);
  const store = resolveAccountMembershipStore();
  const cached = store.cache[key];
  if (cached && cached.expiresAt > Date.now()) return cached.role;
  if (cached) delete store.cache[key];

  const existingRequest = store.inFlight[key];
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const params = new URLSearchParams({
      select: 'role',
      user_id: `eq.${userId}`,
      account_id: `eq.${accountId}`,
      limit: '1',
    });
    const res = await supabaseFetch(env, `/rest/v1/account_members?${params.toString()}`, { method: 'GET' });
    if (!res.ok) {
      const details = await readJson(res);
      throw new Error(`[ParisWorker] Failed to resolve account membership (${res.status}): ${JSON.stringify(details)}`);
    }

    const rows = (await res.json().catch(() => null)) as AccountMembershipRow[] | null;
    return normalizeRole(rows?.[0]?.role);
  })();

  store.inFlight[key] = request;
  try {
    const role = await request;
    store.cache[key] = { role, expiresAt: Date.now() + ACCOUNT_MEMBERSHIP_CACHE_TTL_MS };
    return role;
  } finally {
    delete resolveAccountMembershipStore().inFlight[key];
  }
}

function hydrateAccountFromCapsule(payload: RomaAccountAuthzCapsulePayload): AccountRow {
  return {
    id: payload.accountId,
    status: payload.accountStatus,
    is_platform: null,
    tier: payload.profile,
    name: payload.accountName,
    slug: payload.accountSlug,
    website_url: payload.accountWebsiteUrl ?? null,
    l10n_locales: payload.accountL10nLocales,
    l10n_policy: payload.accountL10nPolicy,
  };
}

export async function authorizeAccount(req: Request, env: Env, accountId: string, minRole: MemberRole): Promise<AccountAuthResult> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return { ok: false, response: auth.response };

  if (!auth.principal) {
    const localStage = String(env.ENV_STAGE || '').trim().toLowerCase() === 'local';
    const trustedInternal =
      auth.source === 'dev' &&
      isTrustedInternalServiceRequest(req, env) &&
      (localStage || isInternalAccountServicePathAllowed(req));
    if (!trustedInternal) {
      return { ok: false, response: ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.auth.required' }, 401) };
    }
    const accountResult = await requireAccount(env, accountId);
    if (!accountResult.ok) return { ok: false, response: accountResult.response };
    return { ok: true, auth: { source: auth.source }, account: accountResult.account, role: 'owner' };
  }

  const capsule = readRomaAuthzCapsuleHeader(req);
  if (capsule) {
    const verified = await verifyRomaAccountAuthzCapsule(env, capsule);
    if (!verified.ok) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    const payload = verified.payload;
    if (payload.userId !== auth.principal.userId || payload.accountId !== accountId) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    if (roleRank(payload.role) < roleRank(minRole)) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    return {
      ok: true,
      auth: { source: auth.source, principal: auth.principal },
      account: hydrateAccountFromCapsule(payload),
      role: payload.role,
    };
  }

  const accountResult = await requireAccount(env, accountId);
  if (!accountResult.ok) return { ok: false, response: accountResult.response };

  let role: MemberRole | null = null;
  try {
    role = await resolveAccountMembershipRole(env, accountId, auth.principal.userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500) };
  }

  if (!role || roleRank(role) < roleRank(minRole)) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
  }

  return { ok: true, auth: { source: auth.source, principal: auth.principal }, account: accountResult.account, role };
}


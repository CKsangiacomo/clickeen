import {
  BUDGET_KEYS,
  mintRomaAccountAuthzCapsule,
  resolvePolicy,
  type MemberRole,
  type PolicyProfile,
} from '@clickeen/ck-policy';
import { ensureProductAccountState } from './account-reconcile';
import { ensureSupabaseAccessToken, toIdentityRecord } from './auth-session';
import { internalError, validationError } from './helpers';
import { requestSupabaseUser } from './supabase-client';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env, type SessionState } from './types';

const DEFAULT_ADMIN_ACCOUNT_ID = '00000000-0000-0000-0000-000000000100';
const ROMA_AUTHZ_CAPSULE_TTL_SEC = 15 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type WorkspaceTier = Exclude<PolicyProfile, 'minibob'>;

type UserProfileRow = {
  user_id?: unknown;
  primary_email?: unknown;
  email_verified?: unknown;
  display_name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  preferred_language?: unknown;
  country_code?: unknown;
  timezone?: unknown;
  active_account_id?: unknown;
};

type AccountMembershipRow = {
  account_id?: unknown;
  user_id?: unknown;
  role?: unknown;
  created_at?: unknown;
  accounts?: {
    id?: unknown;
    status?: unknown;
    is_platform?: unknown;
    tier?: unknown;
    name?: unknown;
    slug?: unknown;
    website_url?: unknown;
    l10n_locales?: unknown;
    l10n_policy?: unknown;
    tier_changed_at?: unknown;
    tier_changed_from?: unknown;
    tier_changed_to?: unknown;
    tier_drop_dismissed_at?: unknown;
    tier_drop_email_sent_at?: unknown;
  } | null;
};

type AccountMemberRow = {
  account_id?: unknown;
  user_id?: unknown;
  role?: unknown;
  created_at?: unknown;
};

type UserProfileSummaryRow = {
  user_id?: unknown;
  primary_email?: unknown;
  display_name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  preferred_language?: unknown;
  country_code?: unknown;
  timezone?: unknown;
  email_verified?: unknown;
};

type LifecycleNotice = {
  tierChangedAt: string | null;
  tierChangedFrom: WorkspaceTier | null;
  tierChangedTo: WorkspaceTier | null;
  tierDropDismissedAt: string | null;
  tierDropEmailSentAt: string | null;
};

export type BerlinUserPayload = {
  id: string;
  email: string | null;
  role: string | null;
};

export type BerlinUserProfilePayload = {
  userId: string;
  primaryEmail: string;
  emailVerified: boolean;
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  preferredLanguage: string | null;
  countryCode: string | null;
  timezone: string | null;
};

export type BerlinIdentityPayload = {
  identityId: string;
  provider: string;
  providerSubject: string | null;
};

export type BerlinAccountContext = {
  accountId: string;
  role: MemberRole;
  name: string;
  slug: string;
  status: string;
  tier: WorkspaceTier;
  websiteUrl: string | null;
  membershipVersion: string | null;
  lifecycleNotice: LifecycleNotice;
  l10nLocales: unknown;
  l10nPolicy: unknown;
};

export type BerlinAccountMember = {
  userId: string;
  role: MemberRole;
  createdAt: string | null;
  profile: BerlinUserProfilePayload | null;
};

export type BerlinBootstrapPayload = {
  user: BerlinUserPayload;
  profile: BerlinUserProfilePayload;
  accounts: BerlinAccountContext[];
  defaults: {
    accountId: string | null;
  };
  authz: null | {
    accountCapsule: string;
    accountId: string;
    role: MemberRole;
    profile: WorkspaceTier;
    authzVersion: string;
    issuedAt: string;
    expiresAt: string;
    entitlements: {
      flags: Record<string, boolean>;
      caps: Record<string, number | null>;
      budgets: Record<string, { max: number | null; used: number }>;
    };
  };
};

type NormalizedUserProfile = {
  profile: BerlinUserProfilePayload;
  activeAccountId: string | null;
};

type PrincipalAccountState = {
  user: BerlinUserPayload;
  profile: BerlinUserProfilePayload;
  accounts: BerlinAccountContext[];
  defaultAccount: BerlinAccountContext | null;
  activeAccountId: string | null;
};

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return false;
}

function normalizeRole(value: unknown): MemberRole | null {
  switch (asTrimmedString(value)?.toLowerCase()) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return asTrimmedString(value)?.toLowerCase() as MemberRole;
    default:
      return null;
  }
}

function roleRank(value: unknown): number {
  switch (normalizeRole(value)) {
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

function normalizeTier(value: unknown): WorkspaceTier | null {
  switch (value) {
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return value;
    default:
      return null;
  }
}

function isUuid(value: string | null): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function encodeInFilter(values: string[]): string {
  return values.map((value) => encodeURIComponent(value)).join(',');
}

function resolveAdminAccountId(env: Env): string {
  return asTrimmedString(env.CK_ADMIN_ACCOUNT_ID) ?? DEFAULT_ADMIN_ACCOUNT_ID;
}

function resolveStage(env: Env): string {
  const stage = asTrimmedString(env.ENV_STAGE)?.toLowerCase();
  if (stage) return stage;
  const issuer = asTrimmedString(env.BERLIN_ISSUER)?.toLowerCase() ?? '';
  return issuer.includes('localhost') ? 'local' : 'cloud-dev';
}

function resolveRomaAuthzCapsuleSecret(env: Env): string {
  const explicit = asTrimmedString(env.ROMA_AUTHZ_CAPSULE_SECRET);
  if (explicit) return explicit;
  const aiFallback = asTrimmedString(env.AI_GRANT_HMAC_SECRET);
  if (aiFallback) return aiFallback;
  return asTrimmedString(env.SUPABASE_SERVICE_ROLE_KEY) ?? '';
}

function budgetCounterKey(accountId: string, budgetKey: string, periodKey: string): string {
  return `usage.budget.v1.${budgetKey}.${periodKey}.acct:${accountId}`;
}

function currentBudgetPeriodKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function readBudgetUsed(env: Env, accountId: string, budgetKey: string): Promise<number> {
  const kv = env.USAGE_KV;
  if (!kv) {
    if (resolveStage(env) === 'local') return 0;
    throw new Error('[Berlin] Missing USAGE_KV binding');
  }
  const raw = await kv.get(budgetCounterKey(accountId, budgetKey, currentBudgetPeriodKey()));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function selectDefaultAccount(
  accounts: BerlinAccountContext[],
  env: Env,
  activeAccountId: string | null,
): BerlinAccountContext | null {
  if (accounts.length === 0) return null;

  const preferred = activeAccountId ? accounts.find((entry) => entry.accountId === activeAccountId) ?? null : null;
  if (preferred) return preferred;

  const adminAccountId = resolveAdminAccountId(env);
  const adminAccount = accounts.find((entry) => entry.accountId === adminAccountId) ?? null;
  if (adminAccount) return adminAccount;

  let best: BerlinAccountContext | null = null;
  for (const candidate of accounts) {
    if (!best || roleRank(candidate.role) > roleRank(best.role)) {
      best = candidate;
    }
  }
  return best ?? accounts[0] ?? null;
}

async function loadUserProfileRow(
  env: Env,
  userId: string,
): Promise<Result<UserProfileRow | null>> {
  const params = new URLSearchParams({
    select:
      'user_id,primary_email,email_verified,display_name,given_name,family_name,preferred_language,country_code,timezone,active_account_id',
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/user_profiles?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<UserProfileRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, value: Array.isArray(payload) ? payload[0] || null : null };
}

async function loadAccountMembershipRows(
  env: Env,
  userId: string,
): Promise<Result<AccountMembershipRow[]>> {
  const params = new URLSearchParams({
    select:
      'account_id,user_id,role,created_at,accounts(id,status,is_platform,tier,name,slug,website_url,l10n_locales,l10n_policy,tier_changed_at,tier_changed_from,tier_changed_to,tier_drop_dismissed_at,tier_drop_email_sent_at)',
    user_id: `eq.${userId}`,
    order: 'created_at.asc',
    limit: '1000',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/account_members?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<AccountMembershipRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, value: Array.isArray(payload) ? payload : [] };
}

function normalizeUserProfile(
  userId: string,
  row: UserProfileRow | null,
): NormalizedUserProfile | null {
  const primaryEmail = asTrimmedString(row?.primary_email);
  const displayName = asTrimmedString(row?.display_name);
  if (!primaryEmail || !displayName) return null;

  return {
    profile: {
      userId,
      primaryEmail,
      emailVerified: normalizeBoolean(row?.email_verified),
      displayName,
      givenName: asTrimmedString(row?.given_name),
      familyName: asTrimmedString(row?.family_name),
      preferredLanguage: asTrimmedString(row?.preferred_language),
      countryCode: asTrimmedString(row?.country_code),
      timezone: asTrimmedString(row?.timezone),
    },
    activeAccountId: isUuid(asTrimmedString(row?.active_account_id))
      ? (asTrimmedString(row?.active_account_id) as string)
      : null,
  };
}

function normalizeAccounts(rows: AccountMembershipRow[]): BerlinAccountContext[] {
  const out: BerlinAccountContext[] = [];
  for (const row of rows) {
    const account = row.accounts;
    if (!account) continue;

    const accountId = asTrimmedString(row.account_id);
    const role = normalizeRole(row.role);
    const tier = normalizeTier(account.tier);
    const name = asTrimmedString(account.name);
    const slug = asTrimmedString(account.slug);
    if (!accountId || !role || !tier || !name || !slug) continue;

    out.push({
      accountId,
      role,
      name,
      slug,
      status: asTrimmedString(account.status) ?? 'active',
      tier,
      websiteUrl: asTrimmedString(account.website_url),
      membershipVersion: asTrimmedString(row.created_at),
      lifecycleNotice: {
        tierChangedAt: asTrimmedString(account.tier_changed_at),
        tierChangedFrom: normalizeTier(account.tier_changed_from),
        tierChangedTo: normalizeTier(account.tier_changed_to),
        tierDropDismissedAt: asTrimmedString(account.tier_drop_dismissed_at),
        tierDropEmailSentAt: asTrimmedString(account.tier_drop_email_sent_at),
      },
      l10nLocales: account.l10n_locales ?? null,
      l10nPolicy: account.l10n_policy ?? null,
    });
  }
  return out;
}

async function ensureCanonicalState(
  env: Env,
  session: SessionState,
): Promise<Result<void>> {
  const ensured = await ensureSupabaseAccessToken(env, session);
  if (!ensured.ok) return { ok: false, response: ensured.response };

  const userResponse = await requestSupabaseUser(env, ensured.accessToken);
  if (!userResponse.ok) {
    return {
      ok: false,
      response: internalError(
        'coreui.errors.auth.contextUnavailable',
        userResponse.detail || `supabase_user_status_${userResponse.status}`,
      ),
    };
  }

  const reconciled = await ensureProductAccountState(env, userResponse.user);
  if (!reconciled.ok) return { ok: false, response: reconciled.response };
  return { ok: true, value: undefined };
}

export async function loadPrincipalAccountState(args: {
  env: Env;
  userId: string;
  session: SessionState;
  sessionRole: string | null;
}): Promise<Result<PrincipalAccountState>> {
  let profileResult = await loadUserProfileRow(args.env, args.userId);
  if (!profileResult.ok) return profileResult;

  let accountsResult = await loadAccountMembershipRows(args.env, args.userId);
  if (!accountsResult.ok) return accountsResult;

  let normalizedProfile = normalizeUserProfile(args.userId, profileResult.value);
  let accounts = normalizeAccounts(accountsResult.value);

  if (!normalizedProfile || accounts.length === 0) {
    const reconciled = await ensureCanonicalState(args.env, args.session);
    if (!reconciled.ok) return reconciled;

    profileResult = await loadUserProfileRow(args.env, args.userId);
    if (!profileResult.ok) return profileResult;

    accountsResult = await loadAccountMembershipRows(args.env, args.userId);
    if (!accountsResult.ok) return accountsResult;

    normalizedProfile = normalizeUserProfile(args.userId, profileResult.value);
    accounts = normalizeAccounts(accountsResult.value);
  }

  if (!normalizedProfile) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'profile_missing_after_reconcile'),
    };
  }

  const defaultAccount = selectDefaultAccount(accounts, args.env, normalizedProfile.activeAccountId);

  return {
    ok: true,
    value: {
      user: {
        id: args.userId,
        email: normalizedProfile.profile.primaryEmail,
        role: args.sessionRole,
      },
      profile: normalizedProfile.profile,
      accounts,
      defaultAccount,
      activeAccountId: normalizedProfile.activeAccountId,
    },
  };
}

export async function loadPrincipalIdentities(args: {
  env: Env;
  session: SessionState;
}): Promise<Result<BerlinIdentityPayload[]>> {
  const ensured = await ensureSupabaseAccessToken(args.env, args.session);
  if (!ensured.ok) return { ok: false, response: ensured.response };

  const userResponse = await requestSupabaseUser(args.env, ensured.accessToken);
  if (!userResponse.ok) {
    return {
      ok: false,
      response: internalError(
        'coreui.errors.auth.contextUnavailable',
        userResponse.detail || `supabase_user_status_${userResponse.status}`,
      ),
    };
  }

  const identities = (userResponse.user.identities ?? [])
    .map((identity) => toIdentityRecord(identity))
    .filter((identity): identity is BerlinIdentityPayload => Boolean(identity))
    .sort((left, right) => {
      const providerCompare = left.provider.localeCompare(right.provider);
      if (providerCompare !== 0) return providerCompare;
      return left.identityId.localeCompare(right.identityId);
    });

  return { ok: true, value: identities };
}

export function findAccountContext(
  state: PrincipalAccountState,
  accountId: string,
): BerlinAccountContext | null {
  return state.accounts.find((entry) => entry.accountId === accountId) ?? null;
}

export async function buildBootstrapPayload(args: {
  env: Env;
  state: PrincipalAccountState;
}): Promise<Result<BerlinBootstrapPayload>> {
  const activeAccount = args.state.defaultAccount;
  if (!activeAccount) {
    return {
      ok: true,
      value: {
        user: args.state.user,
        profile: args.state.profile,
        accounts: args.state.accounts,
        defaults: { accountId: null },
        authz: null,
      },
    };
  }

  try {
    const policy = resolvePolicy({ profile: activeAccount.tier, role: activeAccount.role });
    const budgets = Object.fromEntries(
      await Promise.all(
        BUDGET_KEYS.map(async (budgetKey: string) => {
          const used = await readBudgetUsed(args.env, activeAccount.accountId, budgetKey);
          const max = policy.budgets[budgetKey]?.max ?? null;
          return [budgetKey, { max, used }];
        }),
      ),
    );

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresSec = nowSec + ROMA_AUTHZ_CAPSULE_TTL_SEC;
    const authzVersion =
      activeAccount.membershipVersion ||
      `account:${activeAccount.accountId}:role:${activeAccount.role}:profile:${activeAccount.tier}`;

    const capsule = await mintRomaAccountAuthzCapsule(resolveRomaAuthzCapsuleSecret(args.env), {
      sub: args.state.user.id,
      userId: args.state.user.id,
      accountId: activeAccount.accountId,
      accountStatus: activeAccount.status,
      accountName: activeAccount.name,
      accountSlug: activeAccount.slug,
      accountWebsiteUrl: activeAccount.websiteUrl,
      accountL10nLocales: activeAccount.l10nLocales,
      accountL10nPolicy: activeAccount.l10nPolicy,
      role: activeAccount.role,
      profile: activeAccount.tier,
      authzVersion,
      iat: nowSec,
      exp: expiresSec,
    });

    return {
      ok: true,
      value: {
        user: args.state.user,
        profile: args.state.profile,
        accounts: args.state.accounts,
        defaults: { accountId: activeAccount.accountId },
        authz: {
          accountCapsule: capsule.token,
          accountId: activeAccount.accountId,
          role: activeAccount.role,
          profile: activeAccount.tier,
          authzVersion,
          issuedAt: new Date(nowSec * 1000).toISOString(),
          expiresAt: new Date(expiresSec * 1000).toISOString(),
          entitlements: {
            flags: policy.flags,
            caps: policy.caps,
            budgets,
          },
        },
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', detail),
    };
  }
}

async function loadUserProfilesByIds(
  env: Env,
  userIds: string[],
): Promise<Result<Map<string, BerlinUserProfilePayload>>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter((userId) => isUuid(userId))));
  if (uniqueUserIds.length === 0) return { ok: true, value: new Map() };

  const params = new URLSearchParams({
    select:
      'user_id,primary_email,email_verified,display_name,given_name,family_name,preferred_language,country_code,timezone',
    user_id: `in.(${encodeInFilter(uniqueUserIds)})`,
    limit: String(uniqueUserIds.length),
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/user_profiles?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<UserProfileSummaryRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }

  const map = new Map<string, BerlinUserProfilePayload>();
  for (const row of Array.isArray(payload) ? payload : []) {
    const userId = asTrimmedString(row.user_id);
    const primaryEmail = asTrimmedString(row.primary_email);
    const displayName = asTrimmedString(row.display_name);
    if (!userId || !primaryEmail || !displayName) continue;
    map.set(userId, {
      userId,
      primaryEmail,
      emailVerified: normalizeBoolean(row.email_verified),
      displayName,
      givenName: asTrimmedString(row.given_name),
      familyName: asTrimmedString(row.family_name),
      preferredLanguage: asTrimmedString(row.preferred_language),
      countryCode: asTrimmedString(row.country_code),
      timezone: asTrimmedString(row.timezone),
    });
  }

  return { ok: true, value: map };
}

export async function listAccountMembers(
  env: Env,
  accountId: string,
): Promise<Result<BerlinAccountMember[]>> {
  const params = new URLSearchParams({
    select: 'account_id,user_id,role,created_at',
    account_id: `eq.${accountId}`,
    order: 'created_at.asc',
    limit: '500',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/account_members?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<AccountMemberRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }

  const rows = Array.isArray(payload) ? payload : [];
  const userIds = rows
    .map((row) => asTrimmedString(row.user_id))
    .filter((userId): userId is string => isUuid(userId ?? null));
  const profiles = await loadUserProfilesByIds(env, userIds);
  if (!profiles.ok) return profiles;

  return {
    ok: true,
    value: rows.flatMap((row) => {
      const userId = asTrimmedString(row.user_id);
      const role = normalizeRole(row.role);
      if (!userId || !role) return [];
      return [
        {
          userId,
          role,
          createdAt: asTrimmedString(row.created_at),
          profile: profiles.value.get(userId) ?? null,
        } satisfies BerlinAccountMember,
      ];
    }),
  };
}

export function findAccountMember(
  members: BerlinAccountMember[],
  userId: string,
): BerlinAccountMember | null {
  return members.find((entry) => entry.userId === userId) ?? null;
}

export async function persistActiveAccountPreference(args: {
  env: Env;
  userId: string;
  accountId: string;
}): Promise<Result<void>> {
  if (!isUuid(args.accountId)) {
    return { ok: false, response: validationError('coreui.errors.accountId.invalid') };
  }

  const response = await supabaseAdminFetch(
    args.env,
    `/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(args.userId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ active_account_id: args.accountId }),
    },
  );
  if (response.ok) return { ok: true, value: undefined };

  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return {
    ok: false,
    response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
  };
}

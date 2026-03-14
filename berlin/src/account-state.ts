import {
  BUDGET_KEYS,
  mintRomaAccountAuthzCapsule,
  resolvePolicy,
  type MemberRole,
} from '@clickeen/ck-policy';
import { isUserSettingsTimezoneSupported, normalizeUserSettingsCountry } from '@clickeen/ck-contracts';
import { normalizeCanonicalLocalesFile, normalizeLocaleToken } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { ensureProductAccountState } from './account-reconcile';
import type {
  BerlinAccountContext,
  BerlinAccountMember,
  BerlinBootstrapPayload,
  BerlinConnectorSummaryPayload,
  BerlinIdentityPayload,
  BerlinUserPayload,
  BerlinUserProfilePayload,
  WorkspaceTier,
} from './account-state.types';
import { ensureSupabaseAccessToken, toIdentityRecord } from './auth-session';
import { loadUserContactMethods } from './contact-methods';
import { internalError, validationError } from './helpers';
import { requestSupabaseUser } from './supabase-client';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env, type SessionState } from './types';

const ROMA_AUTHZ_CAPSULE_TTL_SEC = 15 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_BYTES_BUDGET_KEY = 'budget.uploads.bytes';
const ACCOUNT_STORAGE_USAGE_PREFIX = 'usage.storage.v1';
const SUPPORTED_LOCALES = new Set(normalizeCanonicalLocalesFile(localesJson).map((entry) => entry.code));

type UserProfileRow = {
  user_id?: unknown;
  primary_email?: unknown;
  email_verified?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  primary_language?: unknown;
  country?: unknown;
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
  given_name?: unknown;
  family_name?: unknown;
  primary_language?: unknown;
  country?: unknown;
  timezone?: unknown;
  email_verified?: unknown;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function normalizeSupportedLocaleToken(raw: unknown): string | null {
  const normalized = normalizeLocaleToken(raw);
  if (!normalized) return null;
  return SUPPORTED_LOCALES.has(normalized) ? normalized : null;
}

function invalidPersistedStateResponse(detail: string): Response {
  console.error('[Berlin] invalid persisted account/profile state', { detail });
  return internalError('coreui.errors.auth.contextUnavailable', detail);
}

function validateProfileLocation(rawCountry: unknown, rawTimezone: unknown, path: string): string[] {
  const country = asTrimmedString(rawCountry);
  const timezone = asTrimmedString(rawTimezone);
  const issues: string[] = [];

  if (!country) {
    if (timezone) issues.push(`${path}.timezone_requires_country`);
    return issues;
  }

  const normalizedCountry = normalizeUserSettingsCountry(country);
  if (!normalizedCountry) {
    issues.push(`${path}.country_invalid`);
    return issues;
  }
  if (timezone && !isUserSettingsTimezoneSupported(normalizedCountry, timezone)) {
    issues.push(`${path}.timezone_invalid_for_country`);
  }
  return issues;
}

function validateAccountLocaleState(rawLocales: unknown, rawPolicy: unknown, path: string): string[] {
  const issues: string[] = [];

  if (rawLocales != null) {
    if (!Array.isArray(rawLocales)) {
      issues.push(`${path}.l10n_locales_invalid_shape`);
    } else {
      rawLocales.forEach((entry, index) => {
        if (!normalizeSupportedLocaleToken(entry)) {
          issues.push(`${path}.l10n_locales[${index}]_invalid`);
        }
      });
    }
  }

  if (!isPlainRecord(rawPolicy)) {
    issues.push(`${path}.l10n_policy_invalid_shape`);
    return issues;
  }
  if (rawPolicy.v !== 1) issues.push(`${path}.l10n_policy.v_invalid`);

  const baseLocale = normalizeSupportedLocaleToken(rawPolicy.baseLocale);
  if (!baseLocale) issues.push(`${path}.l10n_policy.baseLocale_invalid`);

  const ip = rawPolicy.ip;
  if (!isPlainRecord(ip)) {
    issues.push(`${path}.l10n_policy.ip_invalid_shape`);
  } else {
    if (typeof ip.enabled !== 'boolean') issues.push(`${path}.l10n_policy.ip.enabled_invalid`);
    if (!isPlainRecord(ip.countryToLocale)) {
      issues.push(`${path}.l10n_policy.ip.countryToLocale_invalid_shape`);
    } else {
      for (const [countryRaw, localeRaw] of Object.entries(ip.countryToLocale)) {
        const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
        if (!/^[A-Z]{2}$/.test(country)) {
          issues.push(`${path}.l10n_policy.ip.countryToLocale.${countryRaw}_invalid_country`);
          continue;
        }
        if (!normalizeSupportedLocaleToken(localeRaw)) {
          issues.push(`${path}.l10n_policy.ip.countryToLocale.${country}_invalid_locale`);
        }
      }
    }
  }

  const switcher = rawPolicy.switcher;
  if (!isPlainRecord(switcher)) {
    issues.push(`${path}.l10n_policy.switcher_invalid_shape`);
  } else if (typeof switcher.enabled !== 'boolean') {
    issues.push(`${path}.l10n_policy.switcher.enabled_invalid`);
  }

  return issues;
}

function normalizeProfileLocation(rawCountry: unknown, rawTimezone: unknown): {
  country: string | null;
  timezone: string | null;
} {
  const country = normalizeUserSettingsCountry(rawCountry);
  if (!country) return { country: null, timezone: null };

  const timezone = asTrimmedString(rawTimezone);
  return {
    country,
    timezone: timezone && isUserSettingsTimezoneSupported(country, timezone) ? timezone : null,
  };
}

function resolveStage(env: Env): string {
  const stage = asTrimmedString(env.ENV_STAGE)?.toLowerCase();
  if (stage) return stage;
  const issuer = asTrimmedString(env.BERLIN_ISSUER)?.toLowerCase() ?? '';
  return issuer.includes('localhost') ? 'local' : 'cloud-dev';
}

function resolveRomaAuthzCapsuleSecret(env: Env): string {
  const secret = asTrimmedString(env.ROMA_AUTHZ_CAPSULE_SECRET);
  if (!secret) {
    throw new Error('[berlin] Missing ROMA_AUTHZ_CAPSULE_SECRET');
  }
  return secret;
}

function budgetCounterKey(accountId: string, budgetKey: string, periodKey: string): string {
  return `usage.budget.v1.${budgetKey}.${periodKey}.acct:${accountId}`;
}

function storageBudgetCounterKey(accountId: string, budgetKey: string): string {
  return `${ACCOUNT_STORAGE_USAGE_PREFIX}.${budgetKey}.acct:${accountId}`;
}

function currentBudgetPeriodKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function readBudgetUsed(env: Env, accountId: string, budgetKey: string): Promise<number> {
  const kv = env.USAGE_KV;
  if (!kv) throw new Error('[Berlin] Missing USAGE_KV binding');
  const counterKey =
    budgetKey === STORAGE_BYTES_BUDGET_KEY
      ? storageBudgetCounterKey(accountId, budgetKey)
      : budgetCounterKey(accountId, budgetKey, currentBudgetPeriodKey());
  const raw = await kv.get(counterKey);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function selectDefaultAccount(
  accounts: BerlinAccountContext[],
  activeAccountId: string | null,
): BerlinAccountContext | null {
  if (accounts.length === 0) return null;

  const preferred = activeAccountId ? accounts.find((entry) => entry.accountId === activeAccountId) ?? null : null;
  if (preferred) return preferred;

  // Membership rows are loaded in deterministic join order. If no persisted
  // active account exists, bootstrap may only choose from the user's real
  // memberships and must never guess a privileged account.
  return accounts[0] ?? null;
}

async function loadUserProfileRow(
  env: Env,
  userId: string,
): Promise<Result<UserProfileRow | null>> {
  const params = new URLSearchParams({
    select:
      'user_id,primary_email,email_verified,given_name,family_name,primary_language,country,timezone,active_account_id',
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
): Result<NormalizedUserProfile | null> {
  const primaryEmail = asTrimmedString(row?.primary_email);
  if (!primaryEmail) return { ok: true, value: null };
  const issues = validateProfileLocation(row?.country, row?.timezone, `user_profiles.${userId}`);
  if (issues.length) {
    return { ok: false, response: invalidPersistedStateResponse(issues.join('|')) };
  }
  const location = normalizeProfileLocation(row?.country, row?.timezone);

  return {
    ok: true,
    value: {
      profile: {
        userId,
        primaryEmail,
        emailVerified: normalizeBoolean(row?.email_verified),
        givenName: asTrimmedString(row?.given_name),
        familyName: asTrimmedString(row?.family_name),
        primaryLanguage: asTrimmedString(row?.primary_language),
        country: location.country,
        timezone: location.timezone,
      },
      activeAccountId: isUuid(asTrimmedString(row?.active_account_id))
        ? (asTrimmedString(row?.active_account_id) as string)
        : null,
    },
  };
}

function normalizeAccounts(rows: AccountMembershipRow[]): Result<BerlinAccountContext[]> {
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
    const localeIssues = validateAccountLocaleState(account.l10n_locales, account.l10n_policy, `accounts.${accountId}`);
    if (localeIssues.length) {
      return { ok: false, response: invalidPersistedStateResponse(localeIssues.join('|')) };
    }

    out.push({
      accountId,
      role,
      name,
      slug,
      status: asTrimmedString(account.status) ?? 'active',
      isPlatform: account.is_platform === true,
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
  return { ok: true, value: out };
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

  let normalizedProfileResult = normalizeUserProfile(args.userId, profileResult.value);
  if (!normalizedProfileResult.ok) return normalizedProfileResult;
  let normalizedProfile = normalizedProfileResult.value;
  let normalizedAccountsResult = normalizeAccounts(accountsResult.value);
  if (!normalizedAccountsResult.ok) return normalizedAccountsResult;
  let accounts = normalizedAccountsResult.value;

  if (!normalizedProfile || accounts.length === 0) {
    const reconciled = await ensureCanonicalState(args.env, args.session);
    if (!reconciled.ok) return reconciled;

    profileResult = await loadUserProfileRow(args.env, args.userId);
    if (!profileResult.ok) return profileResult;

    accountsResult = await loadAccountMembershipRows(args.env, args.userId);
    if (!accountsResult.ok) return accountsResult;

    normalizedProfileResult = normalizeUserProfile(args.userId, profileResult.value);
    if (!normalizedProfileResult.ok) return normalizedProfileResult;
    normalizedProfile = normalizedProfileResult.value;
    normalizedAccountsResult = normalizeAccounts(accountsResult.value);
    if (!normalizedAccountsResult.ok) return normalizedAccountsResult;
    accounts = normalizedAccountsResult.value;
  }

  if (!normalizedProfile) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'profile_missing_after_reconcile'),
    };
  }

  const contactMethods = await loadUserContactMethods(args.env, args.userId);
  if (!contactMethods.ok) return contactMethods;
  normalizedProfile.profile.contactMethods = contactMethods.value;

  if (accounts.length === 0) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'account_missing_after_reconcile'),
    };
  }

  const defaultAccount = selectDefaultAccount(accounts, normalizedProfile.activeAccountId);
  if (!defaultAccount) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'default_account_missing_after_reconcile'),
    };
  }

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

export function summarizeConnectorState(args: {
  identities: BerlinIdentityPayload[];
  activeAccountId: string | null;
}): BerlinConnectorSummaryPayload {
  const linkedIdentities = [...args.identities];
  const linkedProviders = Array.from(new Set(linkedIdentities.map((entry) => entry.provider))).sort((a, b) =>
    a.localeCompare(b),
  );
  const workspaceConnections =
    args.activeAccountId == null
      ? []
      : linkedIdentities.map((entry) => ({
          provider: entry.provider,
          accountId: args.activeAccountId as string,
          status: 'seed_available' as const,
          linkedIdentityId: entry.identityId,
        }));
  const capabilityStates = linkedIdentities.map((entry) => ({
    provider: entry.provider,
    capabilityKey: 'identity.login' as const,
    status: 'granted' as const,
    source: 'linked_identity' as const,
    linkedIdentityId: entry.identityId,
  }));

  return {
    linkedIdentities,
    workspaceConnections,
    capabilityStates,
    traits: {
      linkedProviders,
    },
  };
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
  session: SessionState;
}): Promise<Result<BerlinBootstrapPayload>> {
  const activeAccount = args.state.defaultAccount;
  if (!activeAccount) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'default_account_missing_for_bootstrap'),
    };
  }

  try {
    const identities = await loadPrincipalIdentities({
      env: args.env,
      session: args.session,
    });
    if (!identities.ok) return { ok: false, response: identities.response };

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
      accountIsPlatform: activeAccount.isPlatform,
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
        connectors: summarizeConnectorState({
          identities: identities.value,
          activeAccountId: activeAccount.accountId,
        }),
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
      'user_id,primary_email,email_verified,given_name,family_name,primary_language,country,timezone',
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
    if (!userId || !primaryEmail) continue;
    const issues = validateProfileLocation(row.country, row.timezone, `user_profiles.${userId}`);
    if (issues.length) {
      return { ok: false, response: invalidPersistedStateResponse(issues.join('|')) };
    }
    const location = normalizeProfileLocation(row.country, row.timezone);
    map.set(userId, {
      userId,
      primaryEmail,
      emailVerified: normalizeBoolean(row.email_verified),
      givenName: asTrimmedString(row.given_name),
      familyName: asTrimmedString(row.family_name),
      primaryLanguage: asTrimmedString(row.primary_language),
      country: location.country,
      timezone: location.timezone,
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

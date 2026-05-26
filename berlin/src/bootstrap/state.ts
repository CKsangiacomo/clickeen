import { type MemberRole } from '@clickeen/ck-policy';
import {
  isCompactAccountPublicId,
  isUserSettingsTimezoneSupported,
  normalizeUserSettingsCountry,
  parseAccountLocalePolicyStrict,
  validateAccountLocaleList,
} from '@clickeen/ck-contracts';
import type {
  BerlinAccountContext,
  BerlinAccountMember,
  BerlinConnectorSummaryPayload,
  BerlinIdentityPayload,
  BerlinUserPayload,
  BerlinUserProfilePayload,
  AccountTier,
} from './types';
import { loadUserContactMethods } from '../identity/contact-methods';
import { internalError, validationError } from '../http';
import { normalizeUserProfilePayload } from '../identity/profile-normalization';
import type { UserProfileRow as BerlinUserProfileRow } from '../identity/profile-normalization';
import { readSupabaseAdminListAll } from '../supabase-admin';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from '../supabase-admin';
import { type Env, type SessionState } from '../types';
import { asTrimmedString, isUuid } from '../utils/primitives';

const MEMBERSHIP_PAGE_SIZE = 200;
const ACCOUNT_MEMBER_PAGE_SIZE = 200;
const USER_PROFILE_QUERY_CHUNK_SIZE = 100;
const DEFAULT_ACCOUNT_LOCALE_POLICY = {
  v: 1,
  baseLocale: 'en',
  ip: { countryToLocale: {} },
} as const;

type AccountMembershipRow = {
  account_id?: unknown;
  user_id?: unknown;
  role?: unknown;
  created_at?: unknown;
  accounts?: {
    id?: unknown;
    status?: unknown;
    tier?: unknown;
    status_changed_at?: unknown;
    selected_target_locales?: unknown;
    locale_policy?: unknown;
    created_at?: unknown;
  } | null;
};

type AccountMemberRow = {
  account_id?: unknown;
  user_id?: unknown;
  role?: unknown;
  created_at?: unknown;
};

type LoginIdentityRow = {
  user_id?: unknown;
  login_provider?: unknown;
  login_subject?: unknown;
};

type NormalizedUserProfile = {
  profile: BerlinUserProfilePayload;
  activeAccountId: string | null;
};

export type PrincipalAccountState = {
  user: BerlinUserPayload;
  profile: BerlinUserProfilePayload;
  accounts: BerlinAccountContext[];
  defaultAccount: BerlinAccountContext | null;
  activeAccountId: string | null;
};

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

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

function normalizeTier(value: unknown): AccountTier | null {
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

function encodeInFilter(values: string[]): string {
  return values.map((value) => encodeURIComponent(value)).join(',');
}

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [values];
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    out.push(values.slice(index, index + chunkSize));
  }
  return out;
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
  const issues = validateAccountLocaleList(rawLocales, `${path}.selectedTargetLocales`, {
    allowNull: true,
  }).map((issue) => `${issue.path}:${issue.message}`);

  try {
    parseAccountLocalePolicyStrict(rawPolicy);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    issues.push(`${path}.localePolicy:${detail}`);
  }

  return issues;
}

function resolveStage(env: Env): string {
  const stage = asTrimmedString(env.ENV_STAGE)?.toLowerCase();
  if (stage) return stage;
  const issuer = asTrimmedString(env.BERLIN_ISSUER)?.toLowerCase() ?? '';
  return issuer.includes('localhost') ? 'local' : 'cloud-dev';
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
): Promise<Result<BerlinUserProfileRow | null>> {
  const params = new URLSearchParams({
    select:
      'user_id,account_id,primary_email,first_name,last_name,primary_language,country,timezone,phone,whatsapp',
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/users?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<BerlinUserProfileRow[] | Record<string, unknown>>(response);
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
      'account_id,user_id,role,created_at,accounts(id,status,tier,status_changed_at,selected_target_locales,locale_policy,created_at)',
    user_id: `eq.${userId}`,
    order: 'created_at.asc,account_id.asc',
  });
  return readSupabaseAdminListAll<AccountMembershipRow>({
    env,
    pathname: '/rest/v1/users',
    params,
    pageSize: MEMBERSHIP_PAGE_SIZE,
  });
}

function normalizeUserProfile(
  userId: string,
  row: BerlinUserProfileRow | null,
): Result<NormalizedUserProfile | null> {
  const primaryEmail = asTrimmedString(row?.primary_email);
  if (!primaryEmail) return { ok: true, value: null };
  const issues = validateProfileLocation(row?.country, row?.timezone, `user_profiles.${userId}`);
  if (issues.length) {
    return { ok: false, response: invalidPersistedStateResponse(issues.join('|')) };
  }
  const profile = normalizeUserProfilePayload(userId, row);
  if (!profile) return { ok: true, value: null };

  return {
    ok: true,
    value: {
      profile,
      activeAccountId: isCompactAccountPublicId(asTrimmedString(row?.account_id))
        ? (asTrimmedString(row?.account_id) as string)
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
    if (!accountId || !isCompactAccountPublicId(accountId) || !role || !tier) continue;
    const selectedTargetLocales = account.selected_target_locales ?? [];
    const localePolicy = account.locale_policy ?? DEFAULT_ACCOUNT_LOCALE_POLICY;
    const localeIssues = validateAccountLocaleState(selectedTargetLocales, localePolicy, `accounts.${accountId}`);
    if (localeIssues.length) {
      return { ok: false, response: invalidPersistedStateResponse(localeIssues.join('|')) };
    }

    out.push({
      accountId,
      accountPublicId: accountId,
      role,
      status: asTrimmedString(account.status) ?? 'active',
      tier,
      websiteUrl: null,
      membershipVersion: asTrimmedString(row.created_at),
      lifecycleNotice: {
        tierChangedAt: asTrimmedString(account.status_changed_at),
        tierChangedFrom: null,
        tierChangedTo: null,
        tierDropDismissedAt: null,
        tierDropEmailSentAt: null,
      },
      selectedTargetLocales,
      localePolicy,
    });
  }
  return { ok: true, value: out };
}

export async function loadPrincipalAccountState(args: {
  env: Env;
  userId: string;
  sessionRole: string | null;
}): Promise<Result<PrincipalAccountState>> {
  const [profileResult, accountsResult, contactMethods] = await Promise.all([
    loadUserProfileRow(args.env, args.userId),
    loadAccountMembershipRows(args.env, args.userId),
    loadUserContactMethods(args.env, args.userId),
  ]);
  if (!profileResult.ok) return profileResult;
  if (!accountsResult.ok) return accountsResult;
  if (!contactMethods.ok) return contactMethods;

  const normalizedProfileResult = normalizeUserProfile(args.userId, profileResult.value);
  if (!normalizedProfileResult.ok) return normalizedProfileResult;
  const normalizedProfile = normalizedProfileResult.value;
  const normalizedAccountsResult = normalizeAccounts(accountsResult.value);
  if (!normalizedAccountsResult.ok) return normalizedAccountsResult;
  const accounts = normalizedAccountsResult.value;

  if (!normalizedProfile) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'profile_missing_for_principal_state'),
    };
  }

  normalizedProfile.profile.contactMethods = contactMethods.value;

  if (accounts.length === 0) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'account_missing_for_principal_state'),
    };
  }

  const defaultAccount = selectDefaultAccount(accounts, normalizedProfile.activeAccountId);
  if (!defaultAccount) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'default_account_missing_for_principal_state'),
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
  const params = new URLSearchParams({
    select: 'user_id,login_provider,login_subject',
    user_id: `eq.${args.session.userId}`,
    limit: '1',
  });
  const rows = await readSupabaseAdminListAll<LoginIdentityRow>({
    env: args.env,
    pathname: '/rest/v1/users',
    params,
    pageSize: USER_PROFILE_QUERY_CHUNK_SIZE,
  });
  if (!rows.ok) return rows;

  const identities = rows.value
    .map((row): BerlinIdentityPayload | null => {
      const identityId = asTrimmedString(row.user_id);
      const provider = asTrimmedString(row.login_provider)?.toLowerCase() || null;
      if (!identityId || !provider) return null;
      return {
        identityId,
        provider,
        providerSubject: asTrimmedString(row.login_subject),
      };
    })
    .filter((identity): identity is BerlinIdentityPayload => Boolean(identity))
    .sort((left, right) => {
      const providerCompare = left.provider.localeCompare(right.provider);
      if (providerCompare !== 0) return providerCompare;
      return left.identityId.localeCompare(right.identityId);
    });

  if (identities.length === 0) {
    return {
      ok: false,
      response: internalError(
        'coreui.errors.auth.contextUnavailable',
        'login_identity_missing_for_principal',
      ),
    };
  }

  return { ok: true, value: identities };
}

export function summarizeConnectorState(args: {
  identities: BerlinIdentityPayload[];
}): BerlinConnectorSummaryPayload {
  const linkedIdentities = [...args.identities];
  const linkedProviders = Array.from(new Set(linkedIdentities.map((entry) => entry.provider))).sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    linkedIdentities,
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

async function loadUserProfilesByIds(
  env: Env,
  userIds: string[],
): Promise<Result<Map<string, BerlinUserProfilePayload>>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter((userId) => isUuid(userId))));
  if (uniqueUserIds.length === 0) return { ok: true, value: new Map() };

  const map = new Map<string, BerlinUserProfilePayload>();

  for (const chunk of chunkValues(uniqueUserIds, USER_PROFILE_QUERY_CHUNK_SIZE)) {
    const params = new URLSearchParams({
      select:
        'user_id,primary_email,first_name,last_name,primary_language,country,timezone',
      user_id: `in.(${encodeInFilter(chunk)})`,
      limit: String(chunk.length),
    });
    const response = await supabaseAdminFetch(env, `/rest/v1/users?${params.toString()}`, {
      method: 'GET',
    });
    const payload = await readSupabaseAdminJson<BerlinUserProfileRow[] | Record<string, unknown>>(response);
    if (!response.ok) {
      return {
        ok: false,
        response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
      };
    }

    for (const row of Array.isArray(payload) ? payload : []) {
      const userId = asTrimmedString(row.user_id);
      if (!userId) continue;
      const issues = validateProfileLocation(row.country, row.timezone, `user_profiles.${userId}`);
      if (issues.length) {
        return { ok: false, response: invalidPersistedStateResponse(issues.join('|')) };
      }
      const profile = normalizeUserProfilePayload(userId, row);
      if (!profile) continue;
      map.set(userId, profile);
    }
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
    order: 'created_at.asc,user_id.asc',
  });
  const rows = await readSupabaseAdminListAll<AccountMemberRow>({
    env,
    pathname: '/rest/v1/users',
    params,
    pageSize: ACCOUNT_MEMBER_PAGE_SIZE,
  });
  if (!rows.ok) return rows;

  const userIds = rows.value
    .map((row) => asTrimmedString(row.user_id))
    .filter((userId): userId is string => isUuid(userId ?? null));
  const profiles = await loadUserProfilesByIds(env, userIds);
  if (!profiles.ok) return profiles;

  return {
    ok: true,
    value: rows.value.flatMap((row) => {
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
  if (!isCompactAccountPublicId(args.accountId)) {
    return { ok: false, response: validationError('coreui.errors.accountId.invalid') };
  }
  return { ok: true, value: undefined };
}

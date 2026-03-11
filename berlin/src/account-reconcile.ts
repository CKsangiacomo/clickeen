import { internalError } from './helpers';
import { readSupabaseAdminJson, supabaseAdminFetch, supabaseAdminErrorResponse } from './supabase-admin';
import { type Env, type SupabaseUserResponse } from './types';

type UserProfileSeed = {
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

type MembershipRow = {
  account_id?: unknown;
  role?: unknown;
  created_at?: unknown;
};

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

type ReconcileResult =
  | { ok: true; primaryAccountId: string | null; createdAccount: boolean }
  | { ok: false; response: Response };

type OwnedAccountProvisionResult =
  | { ok: true; accountId: string; created: boolean }
  | { ok: false; response: Response };

const DEFAULT_ACCOUNT_L10N_POLICY = {
  v: 1,
  baseLocale: 'en',
  ip: { enabled: false, countryToLocale: {} },
  switcher: { enabled: true },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeEmail(value: unknown): string | null {
  const email = asTrimmedString(value);
  return email ? email.toLowerCase() : null;
}

function normalizeCountryCode(value: unknown): string | null {
  const country = asTrimmedString(value);
  if (!country) return null;
  const normalized = country.toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizePreferredLanguage(value: unknown): string | null {
  const locale = asTrimmedString(value);
  return locale ? locale.toLowerCase() : null;
}

function normalizeTimezone(value: unknown): string | null {
  return asTrimmedString(value);
}

function normalizeRole(value: unknown): 'viewer' | 'editor' | 'admin' | 'owner' | null {
  const role = asTrimmedString(value)?.toLowerCase();
  switch (role) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return role;
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

function deriveDisplayName(email: string, metadata: Record<string, unknown>): string {
  const fullName =
    asTrimmedString(metadata.full_name) || asTrimmedString(metadata.name) || asTrimmedString(metadata.display_name);
  if (fullName) return fullName;

  const givenName =
    asTrimmedString(metadata.given_name) ||
    asTrimmedString(metadata.first_name) ||
    asTrimmedString(metadata.givenName);
  const familyName =
    asTrimmedString(metadata.family_name) ||
    asTrimmedString(metadata.last_name) ||
    asTrimmedString(metadata.familyName);
  const combined = [givenName, familyName].filter(Boolean).join(' ').trim();
  if (combined) return combined;

  const localPart = email.split('@')[0]?.trim();
  if (localPart) return localPart;
  return 'User';
}

function toUserProfileSeed(user: SupabaseUserResponse): UserProfileSeed | null {
  const userId = asTrimmedString(user.id);
  const primaryEmail = normalizeEmail(user.email);
  if (!userId || !primaryEmail) return null;

  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const givenName =
    asTrimmedString(metadata.given_name) ||
    asTrimmedString(metadata.first_name) ||
    asTrimmedString(metadata.givenName);
  const familyName =
    asTrimmedString(metadata.family_name) ||
    asTrimmedString(metadata.last_name) ||
    asTrimmedString(metadata.familyName);

  return {
    userId,
    primaryEmail,
    emailVerified: Boolean(asTrimmedString(user.email_confirmed_at)),
    displayName: deriveDisplayName(primaryEmail, metadata),
    givenName,
    familyName,
    preferredLanguage:
      normalizePreferredLanguage(metadata.locale) ||
      normalizePreferredLanguage(metadata.language) ||
      normalizePreferredLanguage(metadata.preferred_language),
    countryCode:
      normalizeCountryCode(metadata.country_code) ||
      normalizeCountryCode(metadata.country) ||
      normalizeCountryCode(metadata.countryCode),
    timezone: normalizeTimezone(metadata.timezone),
  };
}

function resolveAccountSlug(accountId: string): string {
  const suffix = accountId.replace(/-/g, '').slice(0, 12).toLowerCase();
  return suffix ? `acct-${suffix}` : 'account';
}

async function upsertUserProfile(env: Env, profile: UserProfileSeed): Promise<ReconcileResult> {
  const existingProfile = await loadExistingUserProfile(env, profile.userId);
  if (!existingProfile.ok) return existingProfile;

  const response = await supabaseAdminFetch(
    env,
    `/rest/v1/user_profiles?on_conflict=${encodeURIComponent('user_id')}`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: profile.userId,
        primary_email: profile.primaryEmail,
        email_verified: profile.emailVerified,
        display_name: asTrimmedString(existingProfile.row?.display_name) || profile.displayName,
        given_name: asTrimmedString(existingProfile.row?.given_name) || profile.givenName,
        family_name: asTrimmedString(existingProfile.row?.family_name) || profile.familyName,
        preferred_language:
          normalizePreferredLanguage(existingProfile.row?.preferred_language) || profile.preferredLanguage,
        country_code: normalizeCountryCode(existingProfile.row?.country_code) || profile.countryCode,
        timezone: asTrimmedString(existingProfile.row?.timezone) || profile.timezone,
      }),
    },
  );
  if (response.ok) return { ok: true, primaryAccountId: null, createdAccount: false };
  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return {
    ok: false,
    response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
  };
}

async function loadExistingUserProfile(
  env: Env,
  userId: string,
): Promise<{ ok: true; row: UserProfileRow | null } | { ok: false; response: Response }> {
  const params = new URLSearchParams({
    select:
      'user_id,primary_email,email_verified,display_name,given_name,family_name,preferred_language,country_code,timezone,active_account_id',
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/user_profiles?${params.toString()}`, { method: 'GET' });
  const payload = await readSupabaseAdminJson<UserProfileRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, row: Array.isArray(payload) ? payload[0] || null : null };
}

async function setActiveAccountPreference(
  env: Env,
  userId: string,
  accountId: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const response = await supabaseAdminFetch(
    env,
    `/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ active_account_id: accountId }),
    },
  );
  if (response.ok) return { ok: true };
  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return {
    ok: false,
    response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
  };
}

async function listMembershipsForUser(env: Env, userId: string): Promise<
  | { ok: true; memberships: MembershipRow[] }
  | { ok: false; response: Response }
> {
  const params = new URLSearchParams({
    select: 'account_id,role,created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.asc',
    limit: '1000',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/account_members?${params.toString()}`, { method: 'GET' });
  const payload = await readSupabaseAdminJson<MembershipRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, memberships: Array.isArray(payload) ? payload : [] };
}

function pickPrimaryAccountId(rows: MembershipRow[]): string | null {
  let bestAccountId: string | null = null;
  let bestRank = 0;
  for (const row of rows) {
    const accountId = asTrimmedString(row.account_id);
    if (!accountId) continue;
    const rank = roleRank(row.role);
    if (!bestAccountId || rank > bestRank) {
      bestAccountId = accountId;
      bestRank = rank;
    }
  }
  return bestAccountId;
}

async function createAccountRecord(args: {
  env: Env;
  accountId: string;
  name: string;
}): Promise<OwnedAccountProvisionResult> {
  const accountId = args.accountId;
  const response = await supabaseAdminFetch(args.env, '/rest/v1/accounts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: accountId,
      status: 'active',
      is_platform: false,
      tier: 'free',
      name: args.name,
      slug: resolveAccountSlug(accountId),
      website_url: null,
      l10n_locales: [],
      l10n_policy: DEFAULT_ACCOUNT_L10N_POLICY,
    }),
  });

  if (response.ok) return { ok: true, accountId, created: true };
  if (response.status === 409) return { ok: true, accountId, created: false };

  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return {
    ok: false,
    response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
  };
}

async function deleteAccountIfCreated(env: Env, accountId: string): Promise<void> {
  await supabaseAdminFetch(env, `/rest/v1/accounts?id=eq.${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

async function ensureOwnerMembership(
  env: Env,
  accountId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const response = await supabaseAdminFetch(
    env,
    `/rest/v1/account_members?on_conflict=${encodeURIComponent('account_id,user_id')}`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        account_id: accountId,
        user_id: userId,
        role: 'owner',
      }),
    },
  );
  if (response.ok) return { ok: true };
  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return {
    ok: false,
    response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
  };
}

export async function provisionOwnedAccount(args: {
  env: Env;
  userId: string;
  accountId: string;
  name: string;
  setActive: boolean;
}): Promise<OwnedAccountProvisionResult> {
  const accountCreate = await createAccountRecord({
    env: args.env,
    accountId: args.accountId,
    name: args.name,
  });
  if (!accountCreate.ok) return accountCreate;

  const ownerMembership = await ensureOwnerMembership(args.env, args.accountId, args.userId);
  if (!ownerMembership.ok) {
    if (accountCreate.created) {
      await deleteAccountIfCreated(args.env, args.accountId);
    }
    return ownerMembership;
  }

  if (args.setActive) {
    const activePreference = await setActiveAccountPreference(args.env, args.userId, args.accountId);
    if (!activePreference.ok) {
      if (accountCreate.created) {
        await deleteAccountIfCreated(args.env, args.accountId);
      }
      return activePreference;
    }
  }

  return {
    ok: true,
    accountId: args.accountId,
    created: accountCreate.created,
  };
}

export async function ensureProductAccountState(
  env: Env,
  user: SupabaseUserResponse,
): Promise<ReconcileResult> {
  const profile = toUserProfileSeed(user);
  if (!profile) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.login_failed', 'missing_user_profile_seed'),
    };
  }

  const profileWrite = await upsertUserProfile(env, profile);
  if (!profileWrite.ok) return profileWrite;

  const memberships = await listMembershipsForUser(env, profile.userId);
  if (!memberships.ok) return memberships;
  if (memberships.memberships.length > 0) {
    return {
      ok: true,
      primaryAccountId: pickPrimaryAccountId(memberships.memberships),
      createdAccount: false,
    };
  }

  const provisioned = await provisionOwnedAccount({
    env,
    userId: profile.userId,
    accountId: profile.userId,
    name: 'Personal',
    setActive: true,
  });
  if (!provisioned.ok) return provisioned;

  return {
    ok: true,
    primaryAccountId: provisioned.accountId,
    createdAccount: provisioned.created,
  };
}

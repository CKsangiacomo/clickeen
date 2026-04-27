import { acceptInvitationForPrincipal } from './account-invitations';
import { internalError } from './helpers';
import { normalizeProfileLocation, type UserProfileRow } from './profile-normalization';
import { readSupabaseAdminListAll } from './supabase-list';
import { readSupabaseAdminJson, supabaseAdminFetch, supabaseAdminErrorResponse } from './supabase-admin';
import { type Env } from './types';

type UserProfileSeed = {
  userId: string;
  primaryEmail: string;
  emailVerified: boolean;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  primaryLanguage: string | null;
  country: string | null;
  timezone: string | null;
};

type MembershipRow = {
  account_id?: unknown;
  role?: unknown;
  created_at?: unknown;
};

type LoginIdentityRow = {
  id?: unknown;
  user_id?: unknown;
  provider?: unknown;
  provider_subject?: unknown;
};

export type ProviderIdentity = {
  provider: string;
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  avatarUrl: string | null;
  primaryLanguage?: string | null;
  country?: string | null;
  timezone?: string | null;
  legacyUserId?: string | null;
};

type ReconcileResult =
  | { ok: true; userId: string; primaryAccountId: string | null; createdAccount: boolean }
  | { ok: false; response: Response };

type OwnedAccountProvisionResult =
  | { ok: true; accountId: string; created: boolean }
  | { ok: false; response: Response };

const DEFAULT_ACCOUNT_L10N_POLICY = {
  v: 1,
  baseLocale: 'en',
  ip: { countryToLocale: {} },
} as const;
const USER_MEMBERSHIP_PAGE_SIZE = 200;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeEmail(value: unknown): string | null {
  const email = asTrimmedString(value);
  return email ? email.toLowerCase() : null;
}

function normalizeLoginProvider(value: unknown): string | null {
  const provider = asTrimmedString(value)?.toLowerCase();
  if (!provider) return null;
  return /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(provider) ? provider : null;
}

function normalizeProviderSubject(value: unknown): string | null {
  const subject = asTrimmedString(value);
  return subject && subject.length <= 512 ? subject : null;
}

function normalizeUuid(value: unknown): string | null {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function normalizePrimaryLanguage(value: unknown): string | null {
  const locale = asTrimmedString(value);
  return locale ? locale.toLowerCase() : null;
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

function toUserProfileSeed(userId: string, identity: ProviderIdentity): UserProfileSeed | null {
  const primaryEmail = normalizeEmail(identity.email);
  if (!userId || !primaryEmail) return null;

  return {
    userId,
    primaryEmail,
    emailVerified: identity.emailVerified,
    displayName: asTrimmedString(identity.displayName),
    givenName: asTrimmedString(identity.givenName),
    familyName: asTrimmedString(identity.familyName),
    primaryLanguage: normalizePrimaryLanguage(identity.primaryLanguage),
    ...normalizeProfileLocation(identity.country, identity.timezone),
  };
}

function resolveAccountSlug(accountId: string, attempt = 0): string {
  const suffix = accountId.replace(/-/g, '').slice(0, 24).toLowerCase();
  const base = suffix ? `acct-${suffix}` : 'account';
  return attempt > 0 ? `${base}-${attempt + 1}` : base;
}

async function loadExistingUserProfile(
  env: Env,
  userId: string,
): Promise<{ ok: true; row: UserProfileRow | null } | { ok: false; response: Response }> {
  const params = new URLSearchParams({
    select:
      'user_id,primary_email,email_verified,display_name,given_name,family_name,primary_language,country,timezone,active_account_id',
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

async function upsertUserProfile(
  env: Env,
  profile: UserProfileSeed,
): Promise<
  | { ok: true; created: boolean; activeAccountId: string | null }
  | { ok: false; response: Response }
> {
  const existingProfile = await loadExistingUserProfile(env, profile.userId);
  if (!existingProfile.ok) return existingProfile;
  const existingLocation = normalizeProfileLocation(existingProfile.row?.country, existingProfile.row?.timezone);

  const response = await supabaseAdminFetch(
    env,
    `/rest/v1/user_profiles?on_conflict=${encodeURIComponent('user_id')}`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        user_id: profile.userId,
        primary_email: profile.primaryEmail,
        email_verified: profile.emailVerified,
        display_name: asTrimmedString(existingProfile.row?.display_name) || profile.displayName,
        given_name: asTrimmedString(existingProfile.row?.given_name) || profile.givenName,
        family_name: asTrimmedString(existingProfile.row?.family_name) || profile.familyName,
        primary_language: normalizePrimaryLanguage(existingProfile.row?.primary_language) || profile.primaryLanguage,
        country: existingLocation.country || profile.country,
        timezone: existingLocation.timezone || profile.timezone,
      }),
    },
  );
  const payload = await readSupabaseAdminJson<UserProfileRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const row = Array.isArray(payload) ? payload[0] || existingProfile.row : existingProfile.row;
  return {
    ok: true,
    created: !existingProfile.row,
    activeAccountId: normalizeUuid(row?.active_account_id),
  };
}

async function loadLoginIdentity(
  env: Env,
  identity: ProviderIdentity,
): Promise<{ ok: true; row: LoginIdentityRow | null } | { ok: false; response: Response }> {
  const params = new URLSearchParams({
    select: 'id,user_id,provider,provider_subject',
    provider: `eq.${identity.provider}`,
    provider_subject: `eq.${identity.providerSubject}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/login_identities?${params.toString()}`, { method: 'GET' });
  const payload = await readSupabaseAdminJson<LoginIdentityRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, row: Array.isArray(payload) ? payload[0] || null : null };
}

async function writeLoginIdentity(args: {
  env: Env;
  userId: string;
  identity: ProviderIdentity;
  existingIdentityId?: string | null;
}): Promise<{ ok: true } | { ok: false; response: Response }> {
  const metadataPatch = {
    email: normalizeEmail(args.identity.email),
    email_verified: args.identity.emailVerified,
    display_name: asTrimmedString(args.identity.displayName),
    given_name: asTrimmedString(args.identity.givenName),
    family_name: asTrimmedString(args.identity.familyName),
    avatar_url: asTrimmedString(args.identity.avatarUrl),
    last_used_at: new Date().toISOString(),
  };
  const existingIdentityId = asTrimmedString(args.existingIdentityId);
  const response = existingIdentityId
    ? await supabaseAdminFetch(args.env, `/rest/v1/login_identities?id=eq.${encodeURIComponent(existingIdentityId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(metadataPatch),
      })
    : await supabaseAdminFetch(args.env, '/rest/v1/login_identities', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: args.userId,
          provider: args.identity.provider,
          provider_subject: args.identity.providerSubject,
          ...metadataPatch,
        }),
      });
  if (response.ok) return { ok: true };
  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return {
    ok: false,
    response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
  };
}

function resolveNewProductUserId(identity: ProviderIdentity): string {
  return normalizeUuid(identity.legacyUserId) || crypto.randomUUID();
}

async function resolveProductUserForIdentity(
  env: Env,
  identity: ProviderIdentity,
): Promise<
  | {
      ok: true;
      userId: string;
      createdUser: boolean;
      createdIdentity: boolean;
      activeAccountId: string | null;
    }
  | { ok: false; response: Response }
> {
  const existingIdentity = await loadLoginIdentity(env, identity);
  if (!existingIdentity.ok) return existingIdentity;

  const userId = normalizeUuid(existingIdentity.row?.user_id) || resolveNewProductUserId(identity);
  const identityId = asTrimmedString(existingIdentity.row?.id);
  const profile = toUserProfileSeed(userId, identity);
  if (!profile) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.login_failed', 'missing_provider_profile_seed'),
    };
  }

  const profileWrite = await upsertUserProfile(env, profile);
  if (!profileWrite.ok) return profileWrite;

  const identityWrite = await writeLoginIdentity({ env, userId, identity, existingIdentityId: identityId });
  if (!identityWrite.ok) {
    const racedIdentity = await loadLoginIdentity(env, identity);
    if (!existingIdentity.row && racedIdentity.ok && racedIdentity.row) {
      const racedUserId = normalizeUuid(racedIdentity.row.user_id);
      const racedIdentityId = asTrimmedString(racedIdentity.row.id);
      if (racedUserId && racedIdentityId) {
        const racedProfile = toUserProfileSeed(racedUserId, identity);
        if (!racedProfile) {
          return {
            ok: false,
            response: internalError('coreui.errors.auth.login_failed', 'missing_provider_profile_seed'),
          };
        }
        const racedProfileWrite = await upsertUserProfile(env, racedProfile);
        if (!racedProfileWrite.ok) return racedProfileWrite;
        const racedIdentityWrite = await writeLoginIdentity({
          env,
          userId: racedUserId,
          identity,
          existingIdentityId: racedIdentityId,
        });
        if (!racedIdentityWrite.ok) return racedIdentityWrite;
        return {
          ok: true,
          userId: racedUserId,
          createdUser: false,
          createdIdentity: false,
          activeAccountId: racedProfileWrite.activeAccountId,
        };
      }
    }
    return identityWrite;
  }

  return {
    ok: true,
    userId,
    createdUser: profileWrite.created,
    createdIdentity: !existingIdentity.row,
    activeAccountId: profileWrite.activeAccountId,
  };
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
    order: 'created_at.asc,account_id.asc',
  });
  const memberships = await readSupabaseAdminListAll<MembershipRow>({
    env,
    pathname: '/rest/v1/account_members',
    params,
    pageSize: USER_MEMBERSHIP_PAGE_SIZE,
  });
  if (!memberships.ok) return memberships;
  return { ok: true, memberships: memberships.value };
}

function pickPrimaryAccountId(rows: MembershipRow[], activeAccountId: string | null): string | null {
  const accountIds: string[] = [];
  for (const row of rows) {
    const accountId = asTrimmedString(row.account_id);
    if (!accountId) continue;
    accountIds.push(accountId);
  }
  if (activeAccountId && accountIds.includes(activeAccountId)) return activeAccountId;
  return accountIds[0] ?? null;
}

async function accountRecordExists(env: Env, accountId: string): Promise<boolean> {
  const params = new URLSearchParams({
    select: 'id',
    id: `eq.${accountId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/accounts?${params.toString()}`, { method: 'GET' });
  if (!response.ok) return false;
  const payload = await readSupabaseAdminJson<Array<{ id?: unknown }> | Record<string, unknown>>(response);
  return Array.isArray(payload) && Boolean(payload[0]?.id);
}

async function createAccountRecord(args: {
  env: Env;
  accountId: string;
  name: string;
}): Promise<OwnedAccountProvisionResult> {
  const accountId = args.accountId;
  let lastPayload: Record<string, unknown> | null = null;
  let lastStatus = 500;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await supabaseAdminFetch(args.env, '/rest/v1/accounts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: accountId,
        status: 'active',
        is_platform: false,
        tier: 'free',
        name: args.name,
        slug: resolveAccountSlug(accountId, attempt),
        website_url: null,
        l10n_locales: [],
        l10n_policy: DEFAULT_ACCOUNT_L10N_POLICY,
      }),
    });

    if (response.ok) return { ok: true, accountId, created: true };
    const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
    lastPayload = payload;
    lastStatus = response.status;
    if (response.status !== 409) break;
    if (await accountRecordExists(args.env, accountId)) return { ok: true, accountId, created: false };
  }

  return {
    ok: false,
    response: supabaseAdminErrorResponse(
      'coreui.errors.db.writeFailed',
      lastStatus,
      lastPayload || { detail: 'account_slug_collision' },
    ),
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

export async function ensureProductAccountStateForIdentity(
  env: Env,
  identity: ProviderIdentity,
  options: { invitationId?: string | null } = {},
): Promise<ReconcileResult> {
  const normalizedIdentity: ProviderIdentity = {
    ...identity,
    provider: normalizeLoginProvider(identity.provider) || '',
    providerSubject: normalizeProviderSubject(identity.providerSubject) || '',
    email: normalizeEmail(identity.email),
  };
  if (!normalizedIdentity.provider || !normalizedIdentity.providerSubject) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.login_failed', 'missing_provider_identity'),
    };
  }

  const resolvedUser = await resolveProductUserForIdentity(env, normalizedIdentity);
  if (!resolvedUser.ok) return resolvedUser;

  const invitationId = asTrimmedString(options.invitationId);
  if (invitationId) {
    const accepted = await acceptInvitationForPrincipal({
      env,
      invitationId,
      principalUserId: resolvedUser.userId,
      principalEmail: normalizeEmail(normalizedIdentity.email) || '',
    });
    if (!accepted.ok) return accepted;
    return {
      ok: true,
      userId: resolvedUser.userId,
      primaryAccountId: accepted.value.accountId,
      createdAccount: false,
    };
  }

  const memberships = await listMembershipsForUser(env, resolvedUser.userId);
  if (!memberships.ok) return memberships;
  if (memberships.memberships.length > 0) {
    const activeAccountId = resolvedUser.activeAccountId;
    const primaryAccountId = pickPrimaryAccountId(memberships.memberships, activeAccountId);
    if (primaryAccountId && activeAccountId !== primaryAccountId) {
      const activePreference = await setActiveAccountPreference(env, resolvedUser.userId, primaryAccountId);
      if (!activePreference.ok) return activePreference;
    }
    return {
      ok: true,
      userId: resolvedUser.userId,
      primaryAccountId,
      createdAccount: false,
    };
  }

  const provisioned = await provisionOwnedAccount({
    env,
    userId: resolvedUser.userId,
    accountId: crypto.randomUUID(),
    name: 'Personal',
    setActive: true,
  });
  if (!provisioned.ok) return provisioned;

  return {
    ok: true,
    userId: resolvedUser.userId,
    primaryAccountId: provisioned.accountId,
    createdAccount: provisioned.created,
  };
}

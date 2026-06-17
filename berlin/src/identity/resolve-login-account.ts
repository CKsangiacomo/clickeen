import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import { json, internalError } from '../http';
import { normalizeUserLocation } from './user-row-normalization';
import { readSupabaseAdminJson, supabaseAdminFetch, supabaseAdminErrorResponse } from '../supabase-admin';
import { type Env } from '../types';
import { asTrimmedString, normalizeUuid } from '../utils/primitives';

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
};

type ResolveLoginAccountResult =
  | { ok: true; userId: string; primaryAccountId: string | null; createdAccount: boolean }
  | { ok: false; response: Response };

type ResolveLoginIdentityRpcRow = {
  user_id?: unknown;
  created_user?: unknown;
  account_id?: unknown;
};

type AcceptLoginInvitationIdentityRpcRow = {
  user_id?: unknown;
  account_id?: unknown;
  role?: unknown;
};

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

function normalizePrimaryLanguage(value: unknown): string | null {
  const locale = asTrimmedString(value);
  return locale ? locale.toLowerCase() : null;
}

function readSupabaseErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  return (
    asTrimmedString((payload as Record<string, unknown>).message) ||
    asTrimmedString((payload as Record<string, unknown>).error_description) ||
    asTrimmedString((payload as Record<string, unknown>).error) ||
    ''
  );
}

function invitationLoginErrorResponse(status: number, payload: unknown): Response {
  const message = readSupabaseErrorMessage(payload);
  if (message.includes('invitation_not_found')) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.invitationNotFound' } }, { status: 404 });
  }
  if (message.includes('invitation_invalid_or_expired')) {
    return json(
      { error: { kind: 'AUTH', reasonKey: 'coreui.errors.account.invitationInvalidOrExpired' } },
      { status: 410 },
    );
  }
  if (message.includes('invitation_email_mismatch')) {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 });
  }
  if (message.includes('user_already_associated') || message.includes('login_identity_already_exists')) {
    return json(
      {
        error: {
          kind: 'CONFLICT',
          reasonKey: 'coreui.errors.account.memberAlreadyExists',
          detail: message.includes('login_identity_already_exists')
            ? 'login_identity_already_exists'
            : 'user_already_associated',
        },
      },
      { status: 409 },
    );
  }
  return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', status, payload);
}

async function resolveProductUserForIdentity(
  env: Env,
  identity: ProviderIdentity,
): Promise<
  | {
      ok: true;
      userId: string;
      createdUser: boolean;
      accountId: string | null;
    }
  | { ok: false; response: Response }
> {
  const primaryEmail = normalizeEmail(identity.email);
  if (!primaryEmail) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.login_failed', 'missing_provider_profile_seed'),
    };
  }
  const location = normalizeUserLocation(identity.country, identity.timezone);
  const response = await supabaseAdminFetch(env, '/rest/v1/rpc/resolve_login_identity', {
    method: 'POST',
    body: JSON.stringify({
      p_provider: identity.provider,
      p_provider_subject: identity.providerSubject,
      p_primary_email: primaryEmail,
      p_email_verified: identity.emailVerified,
      p_display_name: asTrimmedString(identity.displayName),
      p_given_name: asTrimmedString(identity.givenName),
      p_family_name: asTrimmedString(identity.familyName),
      p_avatar_url: asTrimmedString(identity.avatarUrl),
      p_primary_language: normalizePrimaryLanguage(identity.primaryLanguage),
      p_country: location.country,
      p_timezone: location.timezone,
    }),
  });
  const payload = await readSupabaseAdminJson<ResolveLoginIdentityRpcRow[] | ResolveLoginIdentityRpcRow | Record<string, unknown>>(
    response,
  );
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }

  const row = Array.isArray(payload) ? payload[0] : payload;
  const userId = normalizeUuid(row?.user_id);
  if (!userId) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.login_failed', 'resolve_login_identity_missing_user'),
    };
  }
  return {
    ok: true,
    userId,
    createdUser: row?.created_user === true,
    accountId: isCompactAccountPublicId(asTrimmedString(row?.account_id))
      ? (asTrimmedString(row?.account_id) as string)
      : null,
  };
}

async function acceptLoginInvitationIdentity(
  env: Env,
  invitationId: string,
  identity: ProviderIdentity,
): Promise<
  | {
      ok: true;
      value: {
        userId: string;
        accountId: string;
      };
    }
  | { ok: false; response: Response }
> {
  const primaryEmail = normalizeEmail(identity.email);
  if (!primaryEmail) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.login_failed', 'missing_provider_profile_seed'),
    };
  }
  const location = normalizeUserLocation(identity.country, identity.timezone);
  const response = await supabaseAdminFetch(env, '/rest/v1/rpc/accept_login_invitation_identity', {
    method: 'POST',
    body: JSON.stringify({
      p_invitation_id: invitationId,
      p_provider: identity.provider,
      p_provider_subject: identity.providerSubject,
      p_primary_email: primaryEmail,
      p_email_verified: identity.emailVerified,
      p_display_name: asTrimmedString(identity.displayName),
      p_given_name: asTrimmedString(identity.givenName),
      p_family_name: asTrimmedString(identity.familyName),
      p_avatar_url: asTrimmedString(identity.avatarUrl),
      p_primary_language: normalizePrimaryLanguage(identity.primaryLanguage),
      p_country: location.country,
      p_timezone: location.timezone,
    }),
  });
  const payload = await readSupabaseAdminJson<
    AcceptLoginInvitationIdentityRpcRow[] | AcceptLoginInvitationIdentityRpcRow | Record<string, unknown>
  >(response);
  if (!response.ok) {
    return {
      ok: false,
      response: invitationLoginErrorResponse(response.status, payload),
    };
  }

  const row = Array.isArray(payload) ? payload[0] : payload;
  const userId = normalizeUuid(row?.user_id);
  const accountId = isCompactAccountPublicId(asTrimmedString(row?.account_id))
    ? (asTrimmedString(row?.account_id) as string)
    : null;
  if (!userId || !accountId) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.login_failed', 'accept_login_invitation_identity_missing_user'),
    };
  }
  return { ok: true, value: { userId, accountId } };
}

export async function ensureProductAccountStateForIdentity(
  env: Env,
  identity: ProviderIdentity,
  options: { invitationId?: string | null } = {},
): Promise<ResolveLoginAccountResult> {
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

  const invitationIdRaw = asTrimmedString(options.invitationId);
  const invitationId = normalizeUuid(invitationIdRaw);
  if (invitationIdRaw && !invitationId) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.login_failed', 'invalid_invitation_id'),
    };
  }
  if (invitationId) {
    const accepted = await acceptLoginInvitationIdentity(
      env,
      invitationId,
      normalizedIdentity,
    );
    if (!accepted.ok) return accepted;
    return {
      ok: true,
      userId: accepted.value.userId,
      primaryAccountId: accepted.value.accountId,
      createdAccount: false,
    };
  }

  const resolvedUser = await resolveProductUserForIdentity(env, normalizedIdentity);
  if (!resolvedUser.ok) return resolvedUser;

  return {
    ok: true,
    userId: resolvedUser.userId,
    primaryAccountId: resolvedUser.accountId,
    createdAccount: resolvedUser.createdUser,
  };
}

import { claimAsString, internalError, json, validationError } from './helpers';
import { handleAccountDelete as applyAccountDelete, handleOwnerTransfer as applyOwnerTransfer } from './account-governance';
import {
  handleAccountInvitationDelete as applyAccountInvitationDelete,
  handleAccountInvitationsGet,
  handleAccountInvitationsPost,
  handleInvitationAccept as applyInvitationAccept,
} from './account-invitations';
import {
  handleAccountMemberCreate,
  handleAccountMemberUpdate,
} from './account-members';
import {
  handleAccountTierDropDismiss as applyAccountTierDropDismiss,
} from './account-lifecycle';
import { handleAccountLocalesUpdate } from './account-locales';
import { ensureSupabaseAccessToken, resolvePrincipalSession } from './auth-session';
import {
  buildBootstrapPayload,
  findAccountContext,
  findAccountMember,
  listAccountMembers,
  loadPrincipalAccountState,
  loadPrincipalIdentities,
  persistActiveAccountPreference,
} from './account-state';
import { provisionOwnedAccount } from './account-reconcile';
import { startUserContactVerification, verifyUserContactMethod, type UserContactChannel } from './contact-methods';
import { requestSupabaseUpdateUserEmail } from './supabase-client';
import { type Env } from './types';
import { parseUserProfilePatchPayload, patchUserProfile } from './user-profiles';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function denyResponse(): Response {
  return json(
    {
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
      },
    },
    { status: 403 },
  );
}

function normalizeUuid(value: string): string | null {
  const normalized = String(value || '').trim();
  if (!UUID_PATTERN.test(normalized)) return null;
  return normalized;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function parseAccountName(value: unknown): string | null {
  if (value == null) return 'New account';
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 80) return null;
  return normalized;
}

function normalizeContactChannel(value: string): UserContactChannel | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'phone' || normalized === 'whatsapp') return normalized;
  return null;
}

function canDismissTierDropNotice(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

async function resolvePrincipalState(request: Request, env: Env) {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return { ok: false as const, response: principal.response };

  const state = await loadPrincipalAccountState({
    env,
    userId: principal.userId,
    session: principal.session,
    sessionRole: claimAsString(principal.claims.role),
  });
  if (!state.ok) return { ok: false as const, response: state.response };

  return { ok: true as const, principal, state: state.value };
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  return json({
    user: resolved.state.user,
    profile: resolved.state.profile,
  });
}

export async function handleMeUpdate(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const parsed = parseUserProfilePatchPayload(payload);
  if (!parsed.ok) return parsed.response;

  const writeError = await patchUserProfile({
    env,
    userId: resolved.principal.userId,
    patch: parsed.patch,
  });
  if (writeError) return writeError;

  const refreshed = await loadPrincipalAccountState({
    env,
    userId: resolved.principal.userId,
    session: resolved.principal.session,
    sessionRole: claimAsString(resolved.principal.claims.role),
  });
  if (!refreshed.ok) return refreshed.response;

  return json({
    user: refreshed.value.user,
    profile: refreshed.value.profile,
  });
}

export async function handleMeEmailChange(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return validationError('coreui.errors.payload.invalid');
  }

  const email = normalizeEmail((payload as { email?: unknown }).email);
  if (!email) {
    return validationError('coreui.errors.user.email.invalid', 'email must be a valid address');
  }

  if (email === resolved.state.profile.primaryEmail.trim().toLowerCase()) {
    return validationError('coreui.errors.user.email.sameAsCurrent');
  }

  const ensured = await ensureSupabaseAccessToken(env, resolved.principal.session);
  if (!ensured.ok) return ensured.response;

  const changed = await requestSupabaseUpdateUserEmail(env, ensured.accessToken, email);
  if (!changed.ok) {
    const reasonKey =
      changed.reason === 'berlin.errors.auth.config_missing'
        ? 'coreui.errors.auth.contextUnavailable'
        : changed.reason;
    if (changed.status === 401) {
      return json({ error: { kind: 'AUTH', reasonKey, ...(changed.detail ? { detail: changed.detail } : {}) } }, { status: 401 });
    }
    if (changed.status === 409) {
      return json(
        { error: { kind: 'CONFLICT', reasonKey, ...(changed.detail ? { detail: changed.detail } : {}) } },
        { status: 409 },
      );
    }
    if (changed.status === 422) {
      return validationError(reasonKey, changed.detail);
    }
    return internalError(reasonKey, changed.detail);
  }

  return json(
    {
      ok: true,
      currentEmail: resolved.state.profile.primaryEmail,
      requestedEmail: email,
      status: 'confirmation_required',
    },
    { status: 202 },
  );
}

export async function handleMeContactMethodStart(
  request: Request,
  env: Env,
  channelRaw: string,
): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const channel = normalizeContactChannel(channelRaw);
  if (!channel) return validationError('coreui.errors.payload.invalid', 'unsupported contact channel');

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return validationError('coreui.errors.payload.invalid');
  }

  return startUserContactVerification({
    env,
    userId: resolved.principal.userId,
    channel,
    value: (payload as { value?: unknown }).value,
  });
}

export async function handleMeContactMethodVerify(
  request: Request,
  env: Env,
  channelRaw: string,
): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const channel = normalizeContactChannel(channelRaw);
  if (!channel) return validationError('coreui.errors.payload.invalid', 'unsupported contact channel');

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return validationError('coreui.errors.payload.invalid');
  }

  return verifyUserContactMethod({
    env,
    userId: resolved.principal.userId,
    channel,
    code: (payload as { code?: unknown }).code,
  });
}

export async function handleMeIdentities(request: Request, env: Env): Promise<Response> {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return principal.response;

  const identities = await loadPrincipalIdentities({
    env,
    session: principal.session,
  });
  if (!identities.ok) return identities.response;

  return json({
    userId: principal.userId,
    identities: identities.value,
  });
}

export async function handleAccounts(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  return json({
    accounts: resolved.state.accounts,
    defaults: {
      accountId: resolved.state.defaultAccount?.accountId ?? null,
    },
  });
}

export async function handleAccountCreate(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  if (payload != null && (typeof payload !== 'object' || Array.isArray(payload))) {
    return validationError('coreui.errors.payload.invalid');
  }

  const name = parseAccountName((payload as { name?: unknown } | null)?.name);
  if (!name) {
    return validationError('coreui.errors.payload.invalid', 'account name must be a non-empty string up to 80 chars');
  }

  const accountId = crypto.randomUUID();
  const provisioned = await provisionOwnedAccount({
    env,
    userId: resolved.principal.userId,
    accountId,
    name,
    setActive: true,
  });
  if (!provisioned.ok) return provisioned.response;

  const state = await loadPrincipalAccountState({
    env,
    userId: resolved.principal.userId,
    session: resolved.principal.session,
    sessionRole: claimAsString(resolved.principal.claims.role),
  });
  if (!state.ok) return state.response;

  const account = findAccountContext(state.value, accountId);
  if (!account) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.readFailed',
          detail: 'created account missing from principal state',
        },
      },
      { status: 500 },
    );
  }

  return json(
    {
      account,
      defaults: {
        accountId,
      },
      isActive: true,
    },
    { status: provisioned.created ? 201 : 200 },
  );
}

export async function handleAccountById(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  return json({
    account,
    defaults: {
      accountId: resolved.state.defaultAccount?.accountId ?? null,
    },
    isActive: resolved.state.defaultAccount?.accountId === accountId,
  });
}

export async function handleAccountDelete(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  return applyAccountDelete({
    request,
    env,
    account,
  });
}

export async function handleAccountMembers(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  if (request.method === 'POST') {
    return handleAccountMemberCreate({
      request,
      env,
      account,
      accountId,
    });
  }

  const members = await listAccountMembers(env, accountId);
  if (!members.ok) return members.response;

  return json({
    accountId,
    role: account.role,
    members: members.value,
  });
}

export async function handleAccountInvitations(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  if (request.method === 'GET') {
    return handleAccountInvitationsGet({
      env,
      account,
    });
  }

  if (request.method === 'POST') {
    return handleAccountInvitationsPost({
      request,
      env,
      account,
      createdByUserId: resolved.principal.userId,
    });
  }

  return validationError('coreui.errors.payload.invalid');
}

export async function handleAccountLocales(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  return handleAccountLocalesUpdate({
    request,
    env,
    account,
  });
}

export async function handleAccountMemberById(
  request: Request,
  env: Env,
  accountIdRaw: string,
  memberIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const memberId = normalizeUuid(memberIdRaw);
  if (!memberId) return denyResponse();

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  const members = await listAccountMembers(env, accountId);
  if (!members.ok) return members.response;

  const member = findAccountMember(members.value, memberId);
  if (!member) return denyResponse();

  return json({
    accountId,
    role: account.role,
    member,
  });
}

export async function handleAccountInvitationDelete(
  request: Request,
  env: Env,
  accountIdRaw: string,
  invitationIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const invitationId = normalizeUuid(invitationIdRaw);
  if (!invitationId) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.invitationNotFound' } }, { status: 404 });
  }

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  return applyAccountInvitationDelete({
    env,
    account,
    invitationId,
  });
}

export async function handleAccountMemberPatch(
  request: Request,
  env: Env,
  accountIdRaw: string,
  memberIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const memberId = normalizeUuid(memberIdRaw);
  if (!memberId) return denyResponse();

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  return handleAccountMemberUpdate({
    request,
    env,
    account,
    accountId,
    memberId,
  });
}

export async function handleAccountSwitch(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  const persisted = await persistActiveAccountPreference({
    env,
    userId: resolved.principal.userId,
    accountId,
  });
  if (!persisted.ok) return persisted.response;

  return json({
    ok: true,
    accountId,
  });
}

export async function handleAccountLifecycleTierDropDismiss(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();
  if (!canDismissTierDropNotice(account.role)) return denyResponse();

  return applyAccountTierDropDismiss({
    env,
    accountId,
  });
}

export async function handleAccountOwnerTransfer(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  return applyOwnerTransfer({
    request,
    env,
    account,
    currentOwnerUserId: resolved.principal.userId,
    session: resolved.principal.session,
    sessionRole: claimAsString(resolved.principal.claims.role),
  });
}

export async function handleSessionBootstrap(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const payload = await buildBootstrapPayload({
    env,
    state: resolved.state,
  });
  if (!payload.ok) return payload.response;

  return json(payload.value);
}

export async function handleInvitationAccept(
  request: Request,
  env: Env,
  invitationIdRaw: string,
): Promise<Response> {
  const invitationId = normalizeUuid(invitationIdRaw);
  if (!invitationId) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.invitationNotFound' } }, { status: 404 });
  }

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  return applyInvitationAccept({
    env,
    invitationId,
    principalUserId: resolved.principal.userId,
    principalEmail: resolved.state.profile.primaryEmail,
    session: resolved.principal.session,
    sessionRole: claimAsString(resolved.principal.claims.role),
  });
}

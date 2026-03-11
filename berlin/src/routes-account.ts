import { claimAsString, json, validationError } from './helpers';
import { handleAccountDelete as applyAccountDelete, handleOwnerTransfer as applyOwnerTransfer } from './account-governance';
import {
  handleAccountInvitationDelete as applyAccountInvitationDelete,
  handleAccountInvitationsGet,
  handleAccountInvitationsPost,
  handleInvitationAccept as applyInvitationAccept,
} from './account-invitations';
import {
  handleAccountMemberCreate,
  handleAccountMemberProfileUpdate,
  handleAccountMemberUpdate,
} from './account-members';
import {
  handleAccountTierDropDismiss as applyAccountTierDropDismiss,
  handleAccountTierUpdate,
} from './account-lifecycle';
import { handleAccountLocalesUpdate } from './account-locales';
import { resolvePrincipalSession } from './auth-session';
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

function parseAccountName(value: unknown): string | null {
  if (value == null) return 'New account';
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 80) return null;
  return normalized;
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

export async function handleAccountMemberProfilePatch(
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

  return handleAccountMemberProfileUpdate({
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

export async function handleAccountTier(
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
  if (account.role !== 'owner') return denyResponse();

  return handleAccountTierUpdate({
    request,
    env,
    account,
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

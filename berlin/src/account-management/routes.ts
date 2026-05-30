import { json, validationError } from '../http';
import { capture, exact, type BerlinRoute } from '../http/routing';
import {
  handleAccountDelete as applyAccountDelete,
  handleAccountTierDropDismiss as applyAccountTierDropDismiss,
  handleOwnerTransfer as applyOwnerTransfer,
} from './governance';
import {
  handleAccountInvitationDelete as applyAccountInvitationDelete,
  handleAccountInvitationsGet,
  handleAccountInvitationsPost,
  handleInvitationAccept as applyInvitationAccept,
} from './invitations';
import {
  handleAccountMemberDelete,
  handleAccountMemberUpdate,
} from './members';
import { handleAccountLocalesUpdate } from './locales';
import {
  findAccountContext,
  findAccountMember,
  listAccountMembers,
} from '../bootstrap/state';
import { denyResponse, normalizeAccountPublicId, normalizeUuid, resolvePrincipalState } from '../bootstrap/route-context';
import { type Env } from '../types';
import { parseUserSettingsPatchPayload, patchUserSettings } from '../identity/user-settings';
import { readJsonPayload } from '../utils/primitives';

function canDismissTierDropNotice(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  return json({
    user: resolved.state.user,
    profile: resolved.state.profile,
  });
}

async function handleMeUpdate(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const payload = await readJsonPayload(request);

  const parsed = parseUserSettingsPatchPayload(payload);
  if (!parsed.ok) return parsed.response;

  const patched = await patchUserSettings({
    env,
    userId: resolved.principal.userId,
    patch: parsed.patch,
  });
  if (!patched.ok) return patched.response;

  return json({
    user: resolved.state.user,
    profile: patched.profile,
  });
}

async function handleAccountById(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  return json({
    account,
    isActive: resolved.state.defaultAccount?.accountId === accountId,
  });
}

async function handleAccountDelete(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
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

async function handleAccountMembers(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  const members = await listAccountMembers(env, accountId);
  if (!members.ok) return members.response;

  return json({
    accountId,
    role: account.role,
    members: members.value,
  });
}

async function handleAccountInvitations(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
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

async function handleAccountLocales(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
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

async function handleAccountMemberById(
  request: Request,
  env: Env,
  accountIdRaw: string,
  memberIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
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

async function handleAccountInvitationDelete(
  request: Request,
  env: Env,
  accountIdRaw: string,
  invitationIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
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

async function handleAccountMemberPatch(
  request: Request,
  env: Env,
  accountIdRaw: string,
  memberIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
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

async function handleAccountMemberDeleteRoute(
  request: Request,
  env: Env,
  accountIdRaw: string,
  memberIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const memberId = normalizeUuid(memberIdRaw);
  if (!memberId) return denyResponse();

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  return handleAccountMemberDelete({
    env,
    account,
    accountId,
    memberId,
  });
}

async function handleAccountLifecycleTierDropDismiss(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
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

async function handleAccountOwnerTransfer(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = normalizeAccountPublicId(accountIdRaw);
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
  });
}

async function handleInvitationAccept(
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
  });
}

export const ACCOUNT_MANAGEMENT_ROUTES: BerlinRoute[] = [
  exact('/v1/me', {
    GET: ({ request, env }) => handleMe(request, env),
    PUT: ({ request, env }) => handleMeUpdate(request, env),
  }),
  {
    pattern: /^\/v1\/invitations\/([^/]+)\/accept$/,
    methods: {
      POST: ({ request, env, match }) => handleInvitationAccept(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/members\/([^/]+)$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountMemberById(request, env, capture(match, 1), capture(match, 2)),
      PATCH: ({ request, env, match }) => handleAccountMemberPatch(request, env, capture(match, 1), capture(match, 2)),
      DELETE: ({ request, env, match }) =>
        handleAccountMemberDeleteRoute(request, env, capture(match, 1), capture(match, 2)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/members$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountMembers(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/invitations\/([^/]+)$/,
    methods: {
      DELETE: ({ request, env, match }) =>
        handleAccountInvitationDelete(request, env, capture(match, 1), capture(match, 2)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/invitations$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountInvitations(request, env, capture(match, 1)),
      POST: ({ request, env, match }) => handleAccountInvitations(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/locales$/,
    methods: {
      PUT: ({ request, env, match }) => handleAccountLocales(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/lifecycle\/tier-drop\/dismiss$/,
    methods: {
      POST: ({ request, env, match }) => handleAccountLifecycleTierDropDismiss(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/owner-transfer$/,
    methods: {
      POST: ({ request, env, match }) => handleAccountOwnerTransfer(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountById(request, env, capture(match, 1)),
      DELETE: ({ request, env, match }) => handleAccountDelete(request, env, capture(match, 1)),
    },
  },
];

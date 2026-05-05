import { claimAsString } from '../utils/claims';
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
  handleAccountMemberCreate,
  handleAccountMemberDelete,
  handleAccountMemberUpdate,
} from './members';
import { handleAccountLocalesUpdate } from './locales';
import {
  findAccountContext,
  findAccountMember,
  listAccountMembers,
  loadPrincipalAccountState,
  loadPrincipalIdentities,
  persistActiveAccountPreference,
  summarizeConnectorState,
} from '../bootstrap/state';
import { denyResponse, normalizeUuid, resolvePrincipalState } from '../bootstrap/route-context';
import { provisionOwnedAccount } from '../identity/reconcile';
import { startUserContactVerification, verifyUserContactMethod, type UserContactChannel } from '../identity/contact-methods';
import { type Env } from '../types';
import { parseUserProfilePatchPayload, patchUserProfile } from '../identity/user-profiles';

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

  const patched = await patchUserProfile({
    env,
    userId: resolved.principal.userId,
    patch: parsed.patch,
  });
  if (!patched.ok) return patched.response;

  return json({
    user: resolved.state.user,
    profile: {
      ...patched.profile,
      contactMethods: resolved.state.profile.contactMethods,
    },
  });
}

export async function handleMeEmailChange(_request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(_request, env);
  if (!resolved.ok) return resolved.response;
  return json(
    {
      error: {
        kind: 'UNSUPPORTED',
        reasonKey: 'coreui.errors.user.email.providerManaged',
        detail: 'provider_managed_email',
      },
    },
    { status: 409 },
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
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const identities = await loadPrincipalIdentities({
    env,
    session: resolved.principal.session,
  });
  if (!identities.ok) return identities.response;

  return json({
    userId: resolved.principal.userId,
    identities: identities.value,
    connectors: summarizeConnectorState({
      identities: identities.value,
    }),
  });
}

export async function handleAccounts(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  return json({
    accounts: resolved.state.accounts,
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

export async function handleAccountMemberDeleteRoute(
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

  return handleAccountMemberDelete({
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
    sessionRole: claimAsString(resolved.principal.claims.role),
  });
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
    sessionRole: claimAsString(resolved.principal.claims.role),
  });
}

export const ACCOUNT_MANAGEMENT_ROUTES: BerlinRoute[] = [
  exact('/v1/me', {
    GET: ({ request, env }) => handleMe(request, env),
    PUT: ({ request, env }) => handleMeUpdate(request, env),
  }),
  exact('/v1/me/email-change', {
    POST: ({ request, env }) => handleMeEmailChange(request, env),
  }),
  {
    pattern: /^\/v1\/me\/contact-methods\/([^/]+)\/start$/,
    methods: {
      POST: ({ request, env, match }) => handleMeContactMethodStart(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/me\/contact-methods\/([^/]+)\/verify$/,
    methods: {
      POST: ({ request, env, match }) => handleMeContactMethodVerify(request, env, capture(match, 1)),
    },
  },
  exact('/v1/me/identities', {
    GET: ({ request, env }) => handleMeIdentities(request, env),
  }),
  exact('/v1/accounts', {
    GET: ({ request, env }) => handleAccounts(request, env),
    POST: ({ request, env }) => handleAccountCreate(request, env),
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
      POST: ({ request, env, match }) => handleAccountMembers(request, env, capture(match, 1)),
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
    pattern: /^\/v1\/accounts\/([^/]+)\/switch$/,
    methods: {
      POST: ({ request, env, match }) => handleAccountSwitch(request, env, capture(match, 1)),
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

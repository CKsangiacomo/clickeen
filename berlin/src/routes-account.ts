import { can, resolvePolicy, type MemberRole, type PolicyProfile } from '@clickeen/ck-policy';
import { claimAsString, internalError, json, validationError } from './helpers';
import { handleAccountDelete as applyAccountDelete, handleOwnerTransfer as applyOwnerTransfer } from './account-governance';
import {
  handleAccountInvitationDelete as applyAccountInvitationDelete,
  handleAccountInvitationsGet,
  handleAccountInvitationsPost,
  handleInvitationAccept as applyInvitationAccept,
} from './account-invitations';
import {
  createAccountInstanceRegistryRow,
  deleteAccountInstanceRegistryRow,
  getAccountInstanceRegistryRow,
  listAccountInstanceRegistryPublicIds,
  loadAccountPublishContainment,
  loadAccountWidgetRegistry,
  loadTemplateRegistry,
} from './account-instance-registry';
import {
  handleAccountMemberCreate,
  handleAccountMemberDelete,
  handleAccountMemberUpdate,
} from './account-members';
import {
  handleAccountTierDropDismiss as applyAccountTierDropDismiss,
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
  summarizeConnectorState,
} from './account-state';
import { provisionOwnedAccount } from './account-reconcile';
import { startUserContactVerification, verifyUserContactMethod, type UserContactChannel } from './contact-methods';
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

function normalizeContactChannel(value: string): UserContactChannel | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'phone' || normalized === 'whatsapp') return normalized;
  return null;
}

function canDismissTierDropNotice(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

function canMutateInstanceRegistry(account: { tier: PolicyProfile; role: MemberRole }, action: 'instance.create' | 'instance.update'): Response | null {
  const policy = resolvePolicy({ profile: account.tier, role: account.role });
  const decision = can(policy, action);
  if (decision.allow) return null;
  return json(
    {
      error: {
        kind: 'DENY',
        reasonKey: decision.reasonKey,
        ...(decision.detail ? { detail: decision.detail } : {}),
      },
    },
    { status: 403 },
  );
}

async function resolvePrincipalState(request: Request, env: Env) {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return { ok: false as const, response: principal.response };

  const state = await loadPrincipalAccountState({
    env,
    userId: principal.userId,
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

export async function handleAccountWidgetRegistry(
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

  const registry = await loadAccountWidgetRegistry({ env, account });
  if (!registry.ok) return registry.response;

  return json({
    accountId,
    ...registry.value,
  });
}

export async function handleTemplateRegistry(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const registry = await loadTemplateRegistry(env);
  if (!registry.ok) return registry.response;

  return json(registry.value);
}

export async function handleAccountPublishContainmentRegistry(
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

  const containment = await loadAccountPublishContainment({ env, account });
  if (!containment.ok) return containment.response;

  return json({ accountId, containment: containment.value });
}

export async function handleAccountInstancePublicIdsRegistry(
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

  const publicIds = await listAccountInstanceRegistryPublicIds({ env, account });
  if (!publicIds.ok) return publicIds.response;

  return json({ accountId, publicIds: publicIds.value });
}

export async function handleAccountInstanceRegistryCreate(
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

  const deny = canMutateInstanceRegistry(account, 'instance.create');
  if (deny) return deny;

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return validationError('coreui.errors.payload.invalid');
  }

  const publicId = claimAsString((payload as { publicId?: unknown }).publicId);
  const widgetType = claimAsString((payload as { widgetType?: unknown }).widgetType);
  if (!publicId || !widgetType) return validationError('coreui.errors.payload.invalid');

  const created = await createAccountInstanceRegistryRow({
    env,
    account,
    publicId,
    widgetType,
    displayName: claimAsString((payload as { displayName?: unknown }).displayName),
  });
  if (!created.ok) return created.response;

  return json({ row: created.value });
}

export async function handleAccountInstanceRegistryByPublicId(
  request: Request,
  env: Env,
  accountIdRaw: string,
  publicIdRaw: string,
): Promise<Response> {
  const accountId = normalizeUuid(accountIdRaw);
  if (!accountId) return validationError('coreui.errors.accountId.invalid');

  const publicId = claimAsString(publicIdRaw);
  if (!publicId) return validationError('coreui.errors.payload.invalid', 'publicId required');

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return denyResponse();

  if (request.method === 'GET') {
    const row = await getAccountInstanceRegistryRow({ env, account, publicId });
    if (!row.ok) return row.response;
    return json({ row: row.value });
  }

  if (request.method === 'DELETE') {
    const deny = canMutateInstanceRegistry(account, 'instance.update');
    if (deny) return deny;

    const deleted = await deleteAccountInstanceRegistryRow({ env, account, publicId });
    if (!deleted.ok) return deleted.response;
    return json({ ok: true });
  }

  return validationError('coreui.errors.payload.invalid');
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

export async function handleSessionBootstrap(request: Request, env: Env): Promise<Response> {
  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved.response;

  const payload = await buildBootstrapPayload({
    env,
    state: resolved.state,
    session: resolved.principal.session,
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
    sessionRole: claimAsString(resolved.principal.claims.role),
  });
}

import type { BerlinAccountContext } from './account-state';
import { findAccountContext, listAccountMembers, loadPrincipalAccountState, persistActiveAccountPreference } from './account-state';
import { json, validationError } from './helpers';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env, type SessionState } from './types';

type AccountInvitationRole = 'viewer' | 'editor' | 'admin';

type InvitationRow = {
  id?: unknown;
  account_id?: unknown;
  email?: unknown;
  role?: unknown;
  created_by_user_id?: unknown;
  accepted_by_user_id?: unknown;
  expires_at?: unknown;
  accepted_at?: unknown;
  revoked_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export type BerlinAccountInvitation = {
  invitationId: string;
  accountId: string;
  email: string;
  role: AccountInvitationRole;
  createdByUserId: string;
  acceptedByUserId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeInvitationRole(value: unknown): AccountInvitationRole | null {
  switch (asTrimmedString(value)?.toLowerCase()) {
    case 'viewer':
    case 'editor':
    case 'admin':
      return asTrimmedString(value)?.toLowerCase() as AccountInvitationRole;
    default:
      return null;
  }
}

function canManageInvitations(role: BerlinAccountContext['role']): boolean {
  return role === 'owner' || role === 'admin';
}

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

function conflictResponse(reasonKey: string, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'CONFLICT',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status: 409 },
  );
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

function normalizeInvitationRow(row: InvitationRow): BerlinAccountInvitation | null {
  const invitationId = asTrimmedString(row.id);
  const accountId = asTrimmedString(row.account_id);
  const email = normalizeEmail(row.email);
  const role = normalizeInvitationRole(row.role);
  const createdByUserId = asTrimmedString(row.created_by_user_id);
  const expiresAt = asTrimmedString(row.expires_at);
  const createdAt = asTrimmedString(row.created_at);
  const updatedAt = asTrimmedString(row.updated_at);
  if (!invitationId || !accountId || !email || !role || !createdByUserId || !expiresAt || !createdAt || !updatedAt) {
    return null;
  }

  return {
    invitationId,
    accountId,
    email,
    role,
    createdByUserId,
    acceptedByUserId: asTrimmedString(row.accepted_by_user_id),
    expiresAt,
    acceptedAt: asTrimmedString(row.accepted_at),
    revokedAt: asTrimmedString(row.revoked_at),
    createdAt,
    updatedAt,
  };
}

function isInvitationExpired(invitation: BerlinAccountInvitation, now = Date.now()): boolean {
  const expiresAt = Date.parse(invitation.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

async function loadInvitationById(env: Env, invitationId: string): Promise<Result<BerlinAccountInvitation | null>> {
  const params = new URLSearchParams({
    select:
      'id,account_id,email,role,created_by_user_id,accepted_by_user_id,expires_at,accepted_at,revoked_at,created_at,updated_at',
    id: `eq.${invitationId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/account_invitations?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<InvitationRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  const row = Array.isArray(payload) ? payload[0] ?? null : null;
  return { ok: true, value: row ? normalizeInvitationRow(row) : null };
}

async function loadPendingInvitationByEmail(
  env: Env,
  accountId: string,
  email: string,
): Promise<Result<BerlinAccountInvitation | null>> {
  const params = new URLSearchParams({
    select:
      'id,account_id,email,role,created_by_user_id,accepted_by_user_id,expires_at,accepted_at,revoked_at,created_at,updated_at',
    account_id: `eq.${accountId}`,
    email: `eq.${email}`,
    accepted_at: 'is.null',
    revoked_at: 'is.null',
    order: 'created_at.desc',
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/account_invitations?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<InvitationRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  const row = Array.isArray(payload) ? payload[0] ?? null : null;
  return { ok: true, value: row ? normalizeInvitationRow(row) : null };
}

export async function listAccountInvitations(env: Env, accountId: string): Promise<Result<BerlinAccountInvitation[]>> {
  const params = new URLSearchParams({
    select:
      'id,account_id,email,role,created_by_user_id,accepted_by_user_id,expires_at,accepted_at,revoked_at,created_at,updated_at',
    account_id: `eq.${accountId}`,
    accepted_at: 'is.null',
    revoked_at: 'is.null',
    order: 'created_at.desc',
    limit: '500',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/account_invitations?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<InvitationRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }

  const invitations = (Array.isArray(payload) ? payload : [])
    .map((row) => normalizeInvitationRow(row))
    .filter((row): row is BerlinAccountInvitation => Boolean(row))
    .filter((invitation) => !isInvitationExpired(invitation));

  return { ok: true, value: invitations };
}

function parseInvitationIssuePayload(
  value: unknown,
): { ok: true; email: string; role: AccountInvitationRole } | { ok: false; response: Response } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: validationError('coreui.errors.payload.invalid') };
  }

  const email = normalizeEmail((value as { email?: unknown }).email);
  const role = normalizeInvitationRole((value as { role?: unknown }).role);
  if (!email || !role) {
    return {
      ok: false,
      response: validationError('coreui.errors.payload.invalid', 'email and role are required'),
    };
  }

  return { ok: true, email, role };
}

async function createInvitation(args: {
  env: Env;
  accountId: string;
  email: string;
  role: AccountInvitationRole;
  createdByUserId: string;
}): Promise<Result<BerlinAccountInvitation>> {
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
  const response = await supabaseAdminFetch(args.env, '/rest/v1/account_invitations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: invitationId,
      account_id: args.accountId,
      email: args.email,
      role: args.role,
      created_by_user_id: args.createdByUserId,
      expires_at: expiresAt,
    }),
  });
  const payload = await readSupabaseAdminJson<InvitationRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const row = Array.isArray(payload) ? payload[0] ?? null : null;
  const invitation = row ? normalizeInvitationRow(row) : null;
  if (!invitation) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: 'invitation_create_missing_row',
          },
        },
        { status: 500 },
      ),
    };
  }
  return { ok: true, value: invitation };
}

async function updateInvitation(args: {
  env: Env;
  invitationId: string;
  patch: Record<string, unknown>;
}): Promise<Result<BerlinAccountInvitation>> {
  const params = new URLSearchParams({
    id: `eq.${args.invitationId}`,
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/account_invitations?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(args.patch),
  });
  const payload = await readSupabaseAdminJson<InvitationRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const row = Array.isArray(payload) ? payload[0] ?? null : null;
  const invitation = row ? normalizeInvitationRow(row) : null;
  if (!invitation) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: 'invitation_update_missing_row',
          },
        },
        { status: 500 },
      ),
    };
  }
  return { ok: true, value: invitation };
}

async function ensureEmailNotAlreadyMember(args: {
  env: Env;
  accountId: string;
  email: string;
}): Promise<Response | null> {
  const members = await listAccountMembers(args.env, args.accountId);
  if (!members.ok) return members.response;

  const exists = members.value.some((member) => member.profile?.primaryEmail.toLowerCase() === args.email);
  if (exists) {
    return conflictResponse('coreui.errors.account.memberAlreadyExists', 'email_already_attached_to_account');
  }
  return null;
}

export async function handleAccountInvitationsGet(args: {
  env: Env;
  account: BerlinAccountContext;
}): Promise<Response> {
  if (!canManageInvitations(args.account.role)) return denyResponse();

  const invitations = await listAccountInvitations(args.env, args.account.accountId);
  if (!invitations.ok) return invitations.response;

  return json({
    accountId: args.account.accountId,
    role: args.account.role,
    invitations: invitations.value,
  });
}

export async function handleAccountInvitationsPost(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
  createdByUserId: string;
}): Promise<Response> {
  if (!canManageInvitations(args.account.role)) return denyResponse();

  let payload: unknown = null;
  try {
    payload = await args.request.json();
  } catch {
    payload = null;
  }

  const parsed = parseInvitationIssuePayload(payload);
  if (!parsed.ok) return parsed.response;

  const memberConflict = await ensureEmailNotAlreadyMember({
    env: args.env,
    accountId: args.account.accountId,
    email: parsed.email,
  });
  if (memberConflict) return memberConflict;

  const existing = await loadPendingInvitationByEmail(args.env, args.account.accountId, parsed.email);
  if (!existing.ok) return existing.response;

  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
  const saved = existing.value
    ? await updateInvitation({
        env: args.env,
        invitationId: existing.value.invitationId,
        patch: {
          role: parsed.role,
          expires_at: expiresAt,
          revoked_at: null,
          accepted_at: null,
          accepted_by_user_id: null,
          created_by_user_id: args.createdByUserId,
        },
      })
    : await createInvitation({
        env: args.env,
        accountId: args.account.accountId,
        email: parsed.email,
        role: parsed.role,
        createdByUserId: args.createdByUserId,
      });
  if (!saved.ok) return saved.response;

  return json(
    {
      accountId: args.account.accountId,
      role: args.account.role,
      invitation: saved.value,
    },
    { status: existing.value ? 200 : 201 },
  );
}

export async function handleAccountInvitationDelete(args: {
  env: Env;
  account: BerlinAccountContext;
  invitationId: string;
}): Promise<Response> {
  if (!canManageInvitations(args.account.role)) return denyResponse();

  const invitation = await loadInvitationById(args.env, args.invitationId);
  if (!invitation.ok) return invitation.response;
  if (!invitation.value || invitation.value.accountId !== args.account.accountId) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.invitationNotFound' } }, { status: 404 });
  }

  if (invitation.value.acceptedAt || invitation.value.revokedAt || isInvitationExpired(invitation.value)) {
    return json({
      accountId: args.account.accountId,
      revoked: false,
      invitationId: args.invitationId,
    });
  }

  const revoked = await updateInvitation({
    env: args.env,
    invitationId: args.invitationId,
    patch: {
      revoked_at: new Date().toISOString(),
    },
  });
  if (!revoked.ok) return revoked.response;

  return json({
    accountId: args.account.accountId,
    revoked: true,
    invitationId: args.invitationId,
  });
}

async function ensureMembershipForAcceptedInvitation(args: {
  env: Env;
  invitation: BerlinAccountInvitation;
  userId: string;
}): Promise<Response | null> {
  const params = new URLSearchParams({
    select: 'account_id,user_id',
    account_id: `eq.${args.invitation.accountId}`,
    user_id: `eq.${args.userId}`,
    limit: '1',
  });
  const existingResponse = await supabaseAdminFetch(args.env, `/rest/v1/account_members?${params.toString()}`, {
    method: 'GET',
  });
  const existingPayload = await readSupabaseAdminJson<Array<{ account_id?: unknown }> | Record<string, unknown>>(
    existingResponse,
  );
  if (!existingResponse.ok) {
    return supabaseAdminErrorResponse('coreui.errors.db.readFailed', existingResponse.status, existingPayload);
  }
  if (Array.isArray(existingPayload) && existingPayload[0]?.account_id) return null;

  const createResponse = await supabaseAdminFetch(args.env, '/rest/v1/account_members', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      account_id: args.invitation.accountId,
      user_id: args.userId,
      role: args.invitation.role,
    }),
  });
  if (createResponse.ok) return null;

  const createPayload = await readSupabaseAdminJson<Record<string, unknown>>(createResponse);
  return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', createResponse.status, createPayload);
}

export async function handleInvitationAccept(args: {
  env: Env;
  invitationId: string;
  principalUserId: string;
  principalEmail: string;
  session: SessionState;
  sessionRole: string | null;
}): Promise<Response> {
  const invitationResult = await loadInvitationById(args.env, args.invitationId);
  if (!invitationResult.ok) return invitationResult.response;

  const invitation = invitationResult.value;
  if (!invitation) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.invitationNotFound' } }, { status: 404 });
  }
  if (invitation.revokedAt || invitation.acceptedAt || isInvitationExpired(invitation)) {
    return json(
      {
        error: {
          kind: 'AUTH',
          reasonKey: 'coreui.errors.account.invitationInvalidOrExpired',
        },
      },
      { status: 410 },
    );
  }
  if (invitation.email !== args.principalEmail.toLowerCase()) {
    return denyResponse();
  }

  const membershipError = await ensureMembershipForAcceptedInvitation({
    env: args.env,
    invitation,
    userId: args.principalUserId,
  });
  if (membershipError) return membershipError;

  const accepted = await updateInvitation({
    env: args.env,
    invitationId: args.invitationId,
    patch: {
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: args.principalUserId,
    },
  });
  if (!accepted.ok) return accepted.response;

  const persisted = await persistActiveAccountPreference({
    env: args.env,
    userId: args.principalUserId,
    accountId: invitation.accountId,
  });
  if (!persisted.ok) return persisted.response;

  const state = await loadPrincipalAccountState({
    env: args.env,
    userId: args.principalUserId,
    session: args.session,
    sessionRole: args.sessionRole,
  });
  if (!state.ok) return state.response;

  const account = findAccountContext(state.value, invitation.accountId);
  if (!account) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.auth.contextUnavailable',
          detail: 'accepted invitation account missing from principal state',
        },
      },
      { status: 500 },
    );
  }

  return json({
    ok: true,
    accountId: invitation.accountId,
    account,
    defaults: {
      accountId: state.value.defaultAccount?.accountId ?? null,
    },
  });
}

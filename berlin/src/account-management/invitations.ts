import type { BerlinAccountContext } from '../bootstrap/types';
import { listAccountMembers } from '../bootstrap/state';
import { json, validationError } from '../http';
import { readSupabaseAdminListAll } from '../supabase-admin';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from '../supabase-admin';
import { type Env } from '../types';
import { asTrimmedString, readJsonPayload } from '../utils/primitives';

type AccountInvitationRole = 'viewer' | 'editor' | 'admin';

type InvitationRow = {
  id?: unknown;
  account_id?: unknown;
  email?: unknown;
  role?: unknown;
  status?: unknown;
  expires_at?: unknown;
  accepted_at?: unknown;
  revoked_at?: unknown;
  created_at?: unknown;
};

export type BerlinAccountInvitation = {
  invitationId: string;
  accountId: string;
  email: string;
  role: AccountInvitationRole;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

export type InvitationAcceptOutcome = {
  invitationId: string;
  accountId: string;
  role: AccountInvitationRole;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_PAGE_SIZE = 200;

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

function normalizeInvitationStatus(value: unknown): BerlinAccountInvitation['status'] | null {
  switch (asTrimmedString(value)?.toLowerCase()) {
    case 'pending':
    case 'accepted':
    case 'revoked':
      return asTrimmedString(value)?.toLowerCase() as BerlinAccountInvitation['status'];
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
  const status = normalizeInvitationStatus(row.status);
  const expiresAt = asTrimmedString(row.expires_at);
  const createdAt = asTrimmedString(row.created_at);
  if (!invitationId || !accountId || !email || !role || !status || !expiresAt || !createdAt) {
    return null;
  }

  return {
    invitationId,
    accountId,
    email,
    role,
    status,
    expiresAt,
    acceptedAt: asTrimmedString(row.accepted_at),
    revokedAt: asTrimmedString(row.revoked_at),
    createdAt,
  };
}

function isInvitationExpired(invitation: BerlinAccountInvitation, now = Date.now()): boolean {
  const expiresAt = Date.parse(invitation.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

async function loadInvitationById(env: Env, invitationId: string): Promise<Result<BerlinAccountInvitation | null>> {
  const params = new URLSearchParams({
    select: 'id,account_id,email,role,status,expires_at,accepted_at,revoked_at,created_at',
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
    select: 'id,account_id,email,role,status,expires_at,accepted_at,revoked_at,created_at',
    account_id: `eq.${accountId}`,
    email: `eq.${email}`,
    status: 'eq.pending',
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

async function listAccountInvitations(env: Env, accountId: string): Promise<Result<BerlinAccountInvitation[]>> {
  const params = new URLSearchParams({
    select: 'id,account_id,email,role,status,expires_at,accepted_at,revoked_at,created_at',
    account_id: `eq.${accountId}`,
    status: 'eq.pending',
    order: 'created_at.desc,id.desc',
  });
  const rows = await readSupabaseAdminListAll<InvitationRow>({
    env,
    pathname: '/rest/v1/account_invitations',
    params,
    pageSize: INVITATION_PAGE_SIZE,
  });
  if (!rows.ok) return rows;

  const invitations = rows.value
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
      status: 'pending',
      created_at: new Date().toISOString(),
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

  const payload = await readJsonPayload(args.request);

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
          status: 'pending',
          expires_at: expiresAt,
          revoked_at: null,
          accepted_at: null,
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

  if (invitation.value.status !== 'pending' || isInvitationExpired(invitation.value)) {
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
      status: 'revoked',
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

async function attachUserToAcceptedInvitationAccount(args: {
  env: Env;
  invitation: BerlinAccountInvitation;
  userId: string;
}): Promise<Response | null> {
  const params = new URLSearchParams({
    select: 'account_id,user_id',
    user_id: `eq.${args.userId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/users?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      account_id: args.invitation.accountId,
      role: args.invitation.role,
    }),
  });
  const payload = await readSupabaseAdminJson<Array<{ account_id?: unknown; user_id?: unknown }> | Record<string, unknown>>(
    response,
  );
  if (!response.ok) {
    return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
  }

  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.user_id) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.memberNotFound' } }, { status: 404 });
  }
  return null;
}

export async function acceptInvitationForPrincipal(args: {
  env: Env;
  invitationId: string;
  principalUserId: string;
  principalEmail: string;
}): Promise<Result<InvitationAcceptOutcome>> {
  const invitationResult = await loadInvitationById(args.env, args.invitationId);
  if (!invitationResult.ok) return invitationResult;

  const invitation = invitationResult.value;
  if (!invitation) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.invitationNotFound' } },
        { status: 404 },
      ),
    };
  }
  if (invitation.status !== 'pending' || isInvitationExpired(invitation)) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'AUTH',
            reasonKey: 'coreui.errors.account.invitationInvalidOrExpired',
          },
        },
        { status: 410 },
      ),
    };
  }
  if (invitation.email !== args.principalEmail.toLowerCase()) {
    return { ok: false, response: denyResponse() };
  }

  const membershipError = await attachUserToAcceptedInvitationAccount({
    env: args.env,
    invitation,
    userId: args.principalUserId,
  });
  if (membershipError) return { ok: false, response: membershipError };

  const accepted = await updateInvitation({
    env: args.env,
    invitationId: args.invitationId,
    patch: {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    },
  });
  if (!accepted.ok) return accepted;

  return {
    ok: true,
    value: {
      invitationId: invitation.invitationId,
      accountId: invitation.accountId,
      role: invitation.role,
    },
  };
}

export async function handleInvitationAccept(args: {
  env: Env;
  invitationId: string;
  principalUserId: string;
  principalEmail: string;
}): Promise<Response> {
  const acceptedInvitation = await acceptInvitationForPrincipal({
    env: args.env,
    invitationId: args.invitationId,
    principalUserId: args.principalUserId,
    principalEmail: args.principalEmail,
  });
  if (!acceptedInvitation.ok) return acceptedInvitation.response;

  return json({
    ok: true,
    accountId: acceptedInvitation.value.accountId,
    invitationId: acceptedInvitation.value.invitationId,
    role: acceptedInvitation.value.role,
  });
}

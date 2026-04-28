import type { BerlinAccountContext, BerlinAccountMember } from './account-state.types';
import { findAccountMember, listAccountMembers } from './account-state';
import { json, validationError } from './http';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env } from './types';
import { userProfileExists } from './user-profiles';

type Result =
  | { ok: true; member: BerlinAccountMember }
  | { ok: false; response: Response };

type AccountMemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeMemberRole(value: unknown): AccountMemberRole | null {
  switch (asTrimmedString(value)?.toLowerCase()) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return asTrimmedString(value)?.toLowerCase() as AccountMemberRole;
    default:
      return null;
  }
}

function canManageMembers(role: AccountMemberRole): boolean {
  return role === 'owner' || role === 'admin';
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

function parseRolePayload(
  value: unknown,
): { ok: true; role: Exclude<AccountMemberRole, 'owner'> } | { ok: false; response: Response } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: validationError('coreui.errors.payload.invalid') };
  }
  const role = normalizeMemberRole((value as { role?: unknown }).role);
  if (!role || role === 'owner') {
    return {
      ok: false,
      response: validationError(
        'coreui.errors.payload.invalid',
        'member role must be viewer, editor, or admin; owner transfer uses a dedicated flow',
      ),
    };
  }
  return { ok: true, role };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseMemberCreatePayload(
  value: unknown,
): { ok: true; userId: string; role: Exclude<AccountMemberRole, 'owner'> } | { ok: false; response: Response } {
  const parsedRole = parseRolePayload(value);
  if (!parsedRole.ok) return parsedRole;
  const userId = asTrimmedString((value as { userId?: unknown }).userId);
  if (!userId || !isUuid(userId)) {
    return {
      ok: false,
      response: validationError(
        'coreui.errors.payload.invalid',
        'userId must be an existing resolved profile id; unknown people must use invitation flow',
      ),
    };
  }
  return {
    ok: true,
    userId,
    role: parsedRole.role,
  };
}

async function loadAccountMember(env: Env, accountId: string, memberId: string): Promise<Result> {
  const members = await listAccountMembers(env, accountId);
  if (!members.ok) return members;
  const member = findAccountMember(members.value, memberId);
  if (!member) {
    return {
      ok: false,
      response: json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.memberNotFound' } }, { status: 404 }),
    };
  }
  return { ok: true, member };
}

function denyMemberMutation(account: BerlinAccountContext): Response | null {
  return canManageMembers(account.role) ? null : json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 });
}

async function patchMemberRole(args: {
  env: Env;
  accountId: string;
  memberId: string;
  role: Exclude<AccountMemberRole, 'owner'>;
}): Promise<Response | null> {
  const params = new URLSearchParams({
    account_id: `eq.${args.accountId}`,
    user_id: `eq.${args.memberId}`,
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/account_members?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ role: args.role }),
  });
  const payload = await readSupabaseAdminJson<Array<{ user_id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.user_id) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.memberNotFound' } }, { status: 404 });
  }
  return null;
}

async function createAccountMember(args: {
  env: Env;
  accountId: string;
  memberId: string;
  role: Exclude<AccountMemberRole, 'owner'>;
}): Promise<Response | null> {
  const response = await supabaseAdminFetch(args.env, '/rest/v1/account_members', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      account_id: args.accountId,
      user_id: args.memberId,
      role: args.role,
    }),
  });
  const payload = await readSupabaseAdminJson<Array<{ user_id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.user_id) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: 'created account member missing from representation',
        },
      },
      { status: 500 },
    );
  }
  return null;
}

export async function handleAccountMemberCreate(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
  accountId: string;
}): Promise<Response> {
  const denied = denyMemberMutation(args.account);
  if (denied) return denied;

  let payload: unknown = null;
  try {
    payload = await args.request.json();
  } catch {
    payload = null;
  }

  const parsed = parseMemberCreatePayload(payload);
  if (!parsed.ok) return parsed.response;

  const profile = await userProfileExists({
    env: args.env,
    userId: parsed.userId,
  });
  if (!profile.ok) return profile.response;
  if (!profile.exists) {
    return json(
      {
        error: {
          kind: 'NOT_FOUND',
          reasonKey: 'coreui.errors.auth.contextUnavailable',
          detail: 'target_user_profile_missing',
        },
      },
      { status: 404 },
    );
  }

  const current = await loadAccountMember(args.env, args.accountId, parsed.userId);
  if (current.ok) {
    return conflictResponse('coreui.errors.account.memberAlreadyExists', 'user_already_attached_to_account');
  }
  if (current.response.status !== 404) return current.response;

  const writeError = await createAccountMember({
    env: args.env,
    accountId: args.accountId,
    memberId: parsed.userId,
    role: parsed.role,
  });
  if (writeError) return writeError;

  const refreshed = await loadAccountMember(args.env, args.accountId, parsed.userId);
  if (!refreshed.ok) return refreshed.response;

  return json(
    {
      accountId: args.accountId,
      role: args.account.role,
      member: refreshed.member,
    },
    { status: 201 },
  );
}

export async function handleAccountMemberUpdate(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
  accountId: string;
  memberId: string;
}): Promise<Response> {
  const denied = denyMemberMutation(args.account);
  if (denied) return denied;

  let payload: unknown = null;
  try {
    payload = await args.request.json();
  } catch {
    payload = null;
  }

  const parsed = parseRolePayload(payload);
  if (!parsed.ok) return parsed.response;

  const current = await loadAccountMember(args.env, args.accountId, args.memberId);
  if (!current.ok) return current.response;
  if (current.member.role === 'owner') {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'owner transfer uses a dedicated flow',
        },
      },
      { status: 403 },
    );
  }

  const writeError = await patchMemberRole({
    env: args.env,
    accountId: args.accountId,
    memberId: args.memberId,
    role: parsed.role,
  });
  if (writeError) return writeError;

  const refreshed = await loadAccountMember(args.env, args.accountId, args.memberId);
  if (!refreshed.ok) return refreshed.response;

  return json({
    accountId: args.accountId,
    role: args.account.role,
    member: refreshed.member,
  });
}

async function deleteAccountMember(args: {
  env: Env;
  accountId: string;
  memberId: string;
}): Promise<Response | null> {
  const params = new URLSearchParams({
    account_id: `eq.${args.accountId}`,
    user_id: `eq.${args.memberId}`,
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/account_members?${params.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
  const payload = await readSupabaseAdminJson<Array<{ user_id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.user_id) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.memberNotFound' } }, { status: 404 });
  }
  return null;
}

export async function handleAccountMemberDelete(args: {
  env: Env;
  account: BerlinAccountContext;
  accountId: string;
  memberId: string;
}): Promise<Response> {
  const denied = denyMemberMutation(args.account);
  if (denied) return denied;

  const current = await loadAccountMember(args.env, args.accountId, args.memberId);
  if (!current.ok) return current.response;
  if (current.member.role === 'owner') {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'owner transfer uses a dedicated flow',
        },
      },
      { status: 403 },
    );
  }

  const writeError = await deleteAccountMember({
    env: args.env,
    accountId: args.accountId,
    memberId: args.memberId,
  });
  if (writeError) return writeError;

  return json({
    ok: true,
    accountId: args.accountId,
    memberId: args.memberId,
    removed: true,
  });
}

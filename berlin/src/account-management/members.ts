import type { BerlinAccountContext, BerlinAccountMember } from '../bootstrap/types';
import { listAccountMembers } from '../bootstrap/state';
import { json, validationError } from '../http';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from '../supabase-admin';
import { type Env } from '../types';
import { asTrimmedString, readJsonPayload } from '../utils/primitives';

type Result =
  | { ok: true; member: BerlinAccountMember }
  | { ok: false; response: Response };

type AccountMemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

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

async function loadAccountMember(env: Env, accountId: string, memberId: string): Promise<Result> {
  const members = await listAccountMembers(env, accountId);
  if (!members.ok) return members;
  const member = members.value.find((entry) => entry.userId === memberId) ?? null;
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
}): Promise<{ ok: true; role: Exclude<AccountMemberRole, 'owner'> } | { ok: false; response: Response }> {
  const params = new URLSearchParams({
    account_id: `eq.${args.accountId}`,
    user_id: `eq.${args.memberId}`,
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/users?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ role: args.role }),
  });
  const payload = await readSupabaseAdminJson<Array<{ role?: unknown; user_id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return { ok: false, response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload) };
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.user_id) {
    return {
      ok: false,
      response: json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.memberNotFound' } }, { status: 404 }),
    };
  }
  const role = normalizeMemberRole(rows[0]?.role);
  if (!role || role === 'owner') {
    return { ok: false, response: validationError('coreui.errors.db.writeFailed') };
  }
  return { ok: true, role };
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

  const payload = await readJsonPayload(args.request);

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

  const patched = await patchMemberRole({
    env: args.env,
    accountId: args.accountId,
    memberId: args.memberId,
    role: parsed.role,
  });
  if (!patched.ok) return patched.response;

  return json({
    accountId: args.accountId,
    role: args.account.role,
    member: { ...current.member, role: patched.role },
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
  const response = await supabaseAdminFetch(args.env, `/rest/v1/users?${params.toString()}`, {
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

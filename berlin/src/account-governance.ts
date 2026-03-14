import type { BerlinAccountContext } from './account-state.types';
import { findAccountContext, loadPrincipalAccountState } from './account-state';
import { json, validationError } from './helpers';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env, type SessionState } from './types';

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
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

function isUuid(value: string | null): value is string {
  return Boolean(value) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? '');
}

async function callTransferOwnerRpc(args: {
  env: Env;
  accountId: string;
  currentOwnerUserId: string;
  nextOwnerUserId: string;
}): Promise<Response | null> {
  const response = await supabaseAdminFetch(args.env, '/rest/v1/rpc/transfer_account_owner', {
    method: 'POST',
    body: JSON.stringify({
      p_account_id: args.accountId,
      p_current_owner_user_id: args.currentOwnerUserId,
      p_next_owner_user_id: args.nextOwnerUserId,
    }),
  });
  if (response.ok) return null;
  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
}

async function deleteAccountRow(args: { env: Env; accountId: string }): Promise<Response | null> {
  const params = new URLSearchParams({
    id: `eq.${args.accountId}`,
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
  const payload = await readSupabaseAdminJson<Array<{ id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.id) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } }, { status: 404 });
  }
  return null;
}

function parseOwnerTransferPayload(
  value: unknown,
): { ok: true; nextOwnerUserId: string } | { ok: false; response: Response } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: validationError('coreui.errors.payload.invalid') };
  }
  const nextOwnerUserId = asTrimmedString((value as { nextOwnerUserId?: unknown }).nextOwnerUserId);
  if (!isUuid(nextOwnerUserId)) {
    return {
      ok: false,
      response: validationError('coreui.errors.payload.invalid', 'nextOwnerUserId must be a uuid'),
    };
  }
  return { ok: true, nextOwnerUserId };
}

function parseDeletePayload(
  value: unknown,
  accountId: string,
): { ok: true } | { ok: false; response: Response } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: validationError('coreui.errors.payload.invalid') };
  }
  const confirmAccountId = asTrimmedString((value as { confirmAccountId?: unknown }).confirmAccountId);
  if (confirmAccountId !== accountId) {
    return {
      ok: false,
      response: validationError('coreui.errors.payload.invalid', 'confirmAccountId must match the account being deleted'),
    };
  }
  return { ok: true };
}

export async function handleOwnerTransfer(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
  currentOwnerUserId: string;
  session: SessionState;
  sessionRole: string | null;
}): Promise<Response> {
  if (args.account.role !== 'owner') return denyResponse();

  let payload: unknown = null;
  try {
    payload = await args.request.json();
  } catch {
    payload = null;
  }
  const parsed = parseOwnerTransferPayload(payload);
  if (!parsed.ok) return parsed.response;
  if (parsed.nextOwnerUserId === args.currentOwnerUserId) {
    return conflictResponse('coreui.errors.account.ownerTransfer.invalid', 'next_owner_matches_current_owner');
  }

  const writeError = await callTransferOwnerRpc({
    env: args.env,
    accountId: args.account.accountId,
    currentOwnerUserId: args.currentOwnerUserId,
    nextOwnerUserId: parsed.nextOwnerUserId,
  });
  if (writeError) return writeError;

  const state = await loadPrincipalAccountState({
    env: args.env,
    userId: args.currentOwnerUserId,
    session: args.session,
    sessionRole: args.sessionRole,
  });
  if (!state.ok) return state.response;

  const account = findAccountContext(state.value, args.account.accountId);
  if (!account) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.auth.contextUnavailable',
          detail: 'owner transfer account missing from refreshed principal state',
        },
      },
      { status: 500 },
    );
  }

  return json({
    ok: true,
    account,
    defaults: {
      accountId: state.value.defaultAccount?.accountId ?? null,
    },
  });
}

export async function handleAccountDelete(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
}): Promise<Response> {
  if (args.account.role !== 'owner') return denyResponse();

  let payload: unknown = null;
  try {
    payload = await args.request.json();
  } catch {
    payload = null;
  }
  const parsed = parseDeletePayload(payload, args.account.accountId);
  if (!parsed.ok) return parsed.response;

  const writeError = await deleteAccountRow({
    env: args.env,
    accountId: args.account.accountId,
  });
  if (writeError) return writeError;

  return json({
    ok: true,
    deletedAccountId: args.account.accountId,
  });
}

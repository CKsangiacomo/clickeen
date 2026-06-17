import type { BerlinAccountContext } from '../bootstrap/types';
import { json, validationError } from '../http';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from '../supabase-admin';
import { type Env } from '../types';
import { asTrimmedString, normalizeUuid, readJsonPayload } from '../utils/primitives';

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

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

async function patchAccount(
  env: Env,
  accountId: string,
  body: Record<string, unknown>,
): Promise<Result<void>> {
  const params = new URLSearchParams({ id: `eq.${accountId}` });
  const response = await supabaseAdminFetch(env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const payload = await readSupabaseAdminJson<Array<{ id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!asTrimmedString(rows[0]?.id)) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } },
        { status: 404 },
      ),
    };
  }
  return { ok: true, value: undefined };
}

function parseOwnerTransferPayload(
  value: unknown,
): { ok: true; nextOwnerUserId: string } | { ok: false; response: Response } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: validationError('coreui.errors.payload.invalid') };
  }
  const nextOwnerUserId = normalizeUuid((value as { nextOwnerUserId?: unknown }).nextOwnerUserId);
  if (!nextOwnerUserId) {
    return {
      ok: false,
      response: validationError('coreui.errors.payload.invalid', 'nextOwnerUserId must be a uuid'),
    };
  }
  return { ok: true, nextOwnerUserId };
}

export async function handleOwnerTransfer(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
  currentOwnerUserId: string;
}): Promise<Response> {
  if (args.account.role !== 'owner') return denyResponse();

  const payload = await readJsonPayload(args.request);
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

  return json({
    ok: true,
    accountId: args.account.accountId,
    ownerUserId: parsed.nextOwnerUserId,
  });
}

export async function handleAccountDelete(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
}): Promise<Response> {
  if (args.account.role !== 'owner') return denyResponse();

  return conflictResponse('coreui.errors.account.deleteUnavailable', 'account_deletion_disabled');
}

export async function handleAccountTierDropDismiss(args: {
  env: Env;
  accountId: string;
}): Promise<Response> {
  const dismissed = await patchAccount(args.env, args.accountId, {
    tier_drop_dismissed_at: new Date().toISOString(),
  });
  if (!dismissed.ok) return dismissed.response;

  return json({
    ok: true,
    accountId: args.accountId,
    kind: 'tier_drop',
  });
}

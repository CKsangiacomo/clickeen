import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { ckError, errorDetail } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import type { Env } from '../../shared/types';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { type InternalControlActor, writeInternalControlEvent } from './audit';

type MemberRemovalPayload = {
  accountId: string;
  memberUserId: string;
  reason: string;
};

type AccountMemberRow = {
  role?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function localToolActor(): InternalControlActor {
  return {
    mode: 'local-tool',
    subject: 'owner',
    serviceId: 'devstudio.local',
  };
}

function denyResponse(detail: string): Response {
  return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.internalControl.forbidden', detail }, 403);
}

function validationResponse(detail: string): Response {
  return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail }, 422);
}

function notFoundResponse(reasonKey: string, detail: string): Response {
  return ckError({ kind: 'NOT_FOUND', reasonKey, detail }, 404);
}

function internalResponse(reasonKey: string, detail?: string): Response {
  return ckError(
    {
      kind: 'INTERNAL',
      reasonKey,
      ...(detail ? { detail } : {}),
    },
    500,
  );
}

function actionDeniedResponse(detail: string): Response {
  return ckError(
    {
      kind: 'DENY',
      reasonKey: 'coreui.errors.auth.forbidden',
      detail,
    },
    403,
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function parsePayload(value: unknown):
  | { ok: true; value: MemberRemovalPayload }
  | { ok: false; response: Response } {
  if (!isRecord(value)) return { ok: false, response: validationResponse('payload must be an object') };

  const accountId = asTrimmedString(value.accountId);
  if (!isUuid(accountId)) return { ok: false, response: validationResponse('accountId must be a UUID') };

  const memberUserId = asTrimmedString(value.memberUserId);
  if (!isUuid(memberUserId)) return { ok: false, response: validationResponse('memberUserId must be a UUID') };

  const reason = asTrimmedString(value.reason);
  if (!reason || reason.length > 280) {
    return { ok: false, response: validationResponse('reason must be a non-empty string up to 280 chars') };
  }

  return { ok: true, value: { accountId, memberUserId, reason } };
}

async function loadAccountMember(
  env: Env,
  accountId: string,
  memberUserId: string,
): Promise<{ ok: true; role: string } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(
      env,
      `/rest/v1/account_members?account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(memberUserId)}&select=role&limit=1`,
      { method: 'GET' },
    );
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        response: internalResponse('coreui.errors.internalControl.accountLookupFailed', JSON.stringify(payload)),
      };
    }

    const rows = Array.isArray(payload) ? (payload as AccountMemberRow[]) : [];
    const role = asTrimmedString(rows[0]?.role);
    if (!role) {
      return {
        ok: false,
        response: notFoundResponse('coreui.errors.account.memberNotFound', 'member_not_in_account'),
      };
    }
    return { ok: true, role };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.accountLookupFailed', errorDetail(error)),
    };
  }
}

async function deleteAccountMember(
  env: Env,
  accountId: string,
  memberUserId: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(
      env,
      `/rest/v1/account_members?account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(memberUserId)}`,
      {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      },
    );
    if (response.ok) return { ok: true };
    const payload = await readJson(response);
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.memberRemovalFailed', JSON.stringify(payload)),
    };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.memberRemovalFailed', errorDetail(error)),
    };
  }
}

export async function handleAccountMemberRemoval(request: Request, env: Env): Promise<Response> {
  if (!isTrustedInternalServiceRequest(request, env)) {
    return denyResponse('internal_control_auth_required');
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const parsed = parsePayload(payload);
  if (!parsed.ok) return parsed.response;

  const member = await loadAccountMember(env, parsed.value.accountId, parsed.value.memberUserId);
  if (!member.ok) return member.response;
  if (member.role === 'owner') {
    return actionDeniedResponse('owner_transfer_uses_dedicated_flow');
  }

  const removed = await deleteAccountMember(env, parsed.value.accountId, parsed.value.memberUserId);
  if (!removed.ok) return removed.response;

  const actor = localToolActor();
  const audit = await writeInternalControlEvent({
    env,
    kind: 'account_member_removed',
    actor,
    targetType: 'account_member',
    targetId: `${parsed.value.accountId}:${parsed.value.memberUserId}`,
    accountId: parsed.value.accountId,
    reason: parsed.value.reason,
    payload: {
      accountId: parsed.value.accountId,
      memberUserId: parsed.value.memberUserId,
      previousRole: member.role,
    },
    result: {
      removed: true,
    },
  });
  if (!audit.ok) return audit.response;

  return new Response(
    JSON.stringify({
      ok: true,
      auditEventId: audit.eventId,
      member: {
        accountId: parsed.value.accountId,
        userId: parsed.value.memberUserId,
        removedRole: member.role,
      },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}

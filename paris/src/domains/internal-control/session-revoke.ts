import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { ckError, errorDetail } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import type { Env } from '../../shared/types';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { type InternalControlActor, writeInternalControlEvent } from './audit';

type SessionRevokePayload = {
  accountId: string;
  userId: string;
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

function internalResponse(reasonKey: string, detail?: string, status = 500): Response {
  return ckError(
    {
      kind: status === 404 ? 'NOT_FOUND' : 'INTERNAL',
      reasonKey,
      ...(detail ? { detail } : {}),
    },
    status,
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function parsePayload(value: unknown):
  | { ok: true; value: SessionRevokePayload }
  | { ok: false; response: Response } {
  if (!isRecord(value)) return { ok: false, response: validationResponse('payload must be an object') };

  const accountId = asTrimmedString(value.accountId);
  if (!isUuid(accountId)) return { ok: false, response: validationResponse('accountId must be a UUID') };

  const userId = asTrimmedString(value.userId);
  if (!isUuid(userId)) return { ok: false, response: validationResponse('userId must be a UUID') };

  const reason = asTrimmedString(value.reason);
  if (!reason || reason.length > 280) {
    return { ok: false, response: validationResponse('reason must be a non-empty string up to 280 chars') };
  }

  return { ok: true, value: { accountId, userId, reason } };
}

function resolveBerlinBaseUrl(env: Env): string {
  const baseUrl = asTrimmedString(env.BERLIN_BASE_URL)?.replace(/\/+$/, '') ?? '';
  if (!baseUrl) throw new Error('Missing BERLIN_BASE_URL for internal control route');
  return baseUrl;
}

function resolveParisDevJwt(env: Env): string {
  const token = asTrimmedString(env.PARIS_DEV_JWT) ?? '';
  if (!token) throw new Error('Missing PARIS_DEV_JWT for internal control route');
  return token;
}

async function loadAccountMember(
  env: Env,
  accountId: string,
  userId: string,
): Promise<{ ok: true; role: string } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(
      env,
      `/rest/v1/account_members?account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
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
        response: notFoundResponse('coreui.errors.account.memberNotFound', 'target_user_not_in_account'),
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

async function revokeUserSessions(
  env: Env,
  userId: string,
): Promise<{ ok: true; revokedCount: number } | { ok: false; response: Response }> {
  try {
    const response = await fetch(`${resolveBerlinBaseUrl(env)}/internal/control/users/${encodeURIComponent(userId)}/revoke-sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resolveParisDevJwt(env)}`,
        'x-ck-internal-service': 'paris',
        accept: 'application/json',
      },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        response: internalResponse(
          'coreui.errors.internalControl.sessionRevokeFailed',
          JSON.stringify(payload),
          response.status === 404 ? 404 : 500,
        ),
      };
    }

    const revokedCount =
      isRecord(payload) && typeof payload.revokedCount === 'number' && Number.isFinite(payload.revokedCount)
        ? payload.revokedCount
        : 0;
    return { ok: true, revokedCount };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.sessionRevokeFailed', errorDetail(error)),
    };
  }
}

export async function handleSessionRevoke(request: Request, env: Env): Promise<Response> {
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

  const membership = await loadAccountMember(env, parsed.value.accountId, parsed.value.userId);
  if (!membership.ok) return membership.response;

  const revoked = await revokeUserSessions(env, parsed.value.userId);
  if (!revoked.ok) return revoked.response;

  const actor = localToolActor();
  const audit = await writeInternalControlEvent({
    env,
    kind: 'user_sessions_revoked',
    actor,
    targetType: 'user_session_scope',
    targetId: parsed.value.userId,
    accountId: parsed.value.accountId,
    reason: parsed.value.reason,
    payload: {
      accountId: parsed.value.accountId,
      currentRole: membership.role,
    },
    result: {
      revokedCount: revoked.revokedCount,
    },
  });
  if (!audit.ok) return audit.response;

  return new Response(
    JSON.stringify({
      ok: true,
      auditEventId: audit.eventId,
      user: {
        userId: parsed.value.userId,
        accountId: parsed.value.accountId,
        revokedCount: revoked.revokedCount,
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

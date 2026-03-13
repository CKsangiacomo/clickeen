import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { ckError, errorDetail } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import type { Env } from '../../shared/types';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { type InternalControlActor, writeInternalControlEvent } from './audit';

type EmailRecoveryPayload = {
  accountId: string;
  userId: string;
  email: string;
  reason: string;
};

type AccountMemberRow = {
  account_id?: unknown;
  user_id?: unknown;
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

function conflictResponse(reasonKey: string, detail?: string): Response {
  return ckError(
    {
      kind: 'CONFLICT',
      reasonKey,
      ...(detail ? { detail } : {}),
    },
    409,
  );
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

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function normalizeEmail(value: unknown): string | null {
  const normalized = asTrimmedString(value)?.toLowerCase() ?? null;
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function parsePayload(value: unknown):
  | { ok: true; value: EmailRecoveryPayload }
  | { ok: false; response: Response } {
  if (!isRecord(value)) return { ok: false, response: validationResponse('payload must be an object') };

  const accountId = asTrimmedString(value.accountId);
  if (!isUuid(accountId)) return { ok: false, response: validationResponse('accountId must be a UUID') };

  const userId = asTrimmedString(value.userId);
  if (!isUuid(userId)) return { ok: false, response: validationResponse('userId must be a UUID') };

  const email = normalizeEmail(value.email);
  if (!email) return { ok: false, response: validationResponse('email must be a valid email address') };

  const reason = asTrimmedString(value.reason);
  if (!reason || reason.length > 280) {
    return { ok: false, response: validationResponse('reason must be a non-empty string up to 280 chars') };
  }

  return { ok: true, value: { accountId, userId, email, reason } };
}

function resolveSupabaseAuthBaseUrl(env: Env): string {
  const baseUrl = asTrimmedString(env.SUPABASE_URL)?.replace(/\/+$/, '') ?? '';
  if (!baseUrl) throw new Error('Missing SUPABASE_URL for internal control route');
  return `${baseUrl}/auth/v1`;
}

function resolveSupabaseServiceRoleKey(env: Env): string {
  const key = asTrimmedString(env.SUPABASE_SERVICE_ROLE_KEY) ?? '';
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for internal control route');
  return key;
}

async function loadAccountMember(
  env: Env,
  accountId: string,
  userId: string,
): Promise<{ ok: true; role: string } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(
      env,
      `/rest/v1/account_members?account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(userId)}&select=account_id,user_id,role&limit=1`,
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

async function updateAuthUserEmail(
  env: Env,
  userId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  try {
    const key = resolveSupabaseServiceRoleKey(env);
    const response = await fetch(`${resolveSupabaseAuthBaseUrl(env)}/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ email, email_confirm: false }),
    });
    const payload = await readJson(response);
    if (response.ok) return { ok: true };

    const detail =
      isRecord(payload) && typeof payload.msg === 'string'
        ? payload.msg
        : isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : JSON.stringify(payload);

    if (response.status === 409) {
      return { ok: false, response: conflictResponse('coreui.errors.user.email.conflict', detail) };
    }

    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.emailRecoveryFailed', detail),
    };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.emailRecoveryFailed', errorDetail(error)),
    };
  }
}

async function updateUserProfileEmail(
  env: Env,
  userId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(env, `/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        primary_email: email,
        email_verified: false,
      }),
    });
    if (response.ok) return { ok: true };
    const payload = await readJson(response);
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.emailProfileSyncFailed', JSON.stringify(payload)),
    };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.emailProfileSyncFailed', errorDetail(error)),
    };
  }
}

export async function handleCustomerEmailRecovery(request: Request, env: Env): Promise<Response> {
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

  const authWrite = await updateAuthUserEmail(env, parsed.value.userId, parsed.value.email);
  if (!authWrite.ok) return authWrite.response;

  const profileWrite = await updateUserProfileEmail(env, parsed.value.userId, parsed.value.email);
  if (!profileWrite.ok) return profileWrite.response;

  const actor = localToolActor();
  const audit = await writeInternalControlEvent({
    env,
    kind: 'customer_email_recovered',
    actor,
    targetType: 'user',
    targetId: parsed.value.userId,
    accountId: parsed.value.accountId,
    reason: parsed.value.reason,
    payload: {
      accountId: parsed.value.accountId,
      requestedEmail: parsed.value.email,
      currentRole: membership.role,
    },
    result: {
      emailVerified: false,
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
        email: parsed.value.email,
        emailVerified: false,
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

import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { ckError, errorDetail } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import type { Env } from '../../shared/types';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { type InternalControlActor, writeInternalControlEvent } from './audit';

type PublishContainmentPayload = {
  accountId: string;
  action: 'pause' | 'resume';
  reason: string;
};

type AccountLookupRow = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
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

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function parsePayload(value: unknown):
  | { ok: true; value: PublishContainmentPayload }
  | { ok: false; response: Response } {
  if (!isRecord(value)) return { ok: false, response: validationResponse('payload must be an object') };

  const accountId = asTrimmedString(value.accountId);
  if (!isUuid(accountId)) return { ok: false, response: validationResponse('accountId must be a UUID') };

  const action = asTrimmedString(value.action);
  if (action !== 'pause' && action !== 'resume') {
    return { ok: false, response: validationResponse("action must be 'pause' or 'resume'") };
  }

  const reason = asTrimmedString(value.reason);
  if (!reason || reason.length > 280) {
    return { ok: false, response: validationResponse('reason must be a non-empty string up to 280 chars') };
  }

  return { ok: true, value: { accountId, action, reason } };
}

async function loadAccount(
  env: Env,
  accountId: string,
): Promise<
  | { ok: true; account: { accountId: string; name: string; slug: string | null } }
  | { ok: false; response: Response }
> {
  try {
    const response = await supabaseFetch(
      env,
      `/rest/v1/accounts?id=eq.${encodeURIComponent(accountId)}&select=id,name,slug&limit=1`,
      { method: 'GET' },
    );
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        response: internalResponse('coreui.errors.internalControl.accountLookupFailed', JSON.stringify(payload)),
      };
    }

    const rows = Array.isArray(payload) ? (payload as AccountLookupRow[]) : [];
    const row = rows[0] ?? null;
    const resolvedId = asTrimmedString(row?.id);
    const name = asTrimmedString(row?.name);
    if (!resolvedId || !name) {
      return {
        ok: false,
        response: notFoundResponse('coreui.errors.account.notFound', 'account_not_found'),
      };
    }

    return {
      ok: true,
      account: {
        accountId: resolvedId,
        name,
        slug: asTrimmedString(row?.slug),
      },
    };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.accountLookupFailed', errorDetail(error)),
    };
  }
}

async function pauseAccountPublishing(
  env: Env,
  accountId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(env, '/rest/v1/account_publish_containment', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        account_id: accountId,
        reason,
      }),
    });
    if (response.ok) return { ok: true };
    const payload = await readJson(response);
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.publishContainmentFailed', JSON.stringify(payload)),
    };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.publishContainmentFailed', errorDetail(error)),
    };
  }
}

async function resumeAccountPublishing(
  env: Env,
  accountId: string,
): Promise<{ ok: true; changed: boolean } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(
      env,
      `/rest/v1/account_publish_containment?account_id=eq.${encodeURIComponent(accountId)}`,
      {
        method: 'DELETE',
        headers: {
          Prefer: 'return=representation',
        },
      },
    );
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        response: internalResponse('coreui.errors.internalControl.publishContainmentFailed', JSON.stringify(payload)),
      };
    }
    return { ok: true, changed: Array.isArray(payload) ? payload.length > 0 : false };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.publishContainmentFailed', errorDetail(error)),
    };
  }
}

export async function handleAccountPublishContainment(request: Request, env: Env): Promise<Response> {
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

  const account = await loadAccount(env, parsed.value.accountId);
  if (!account.ok) return account.response;

  const actor = localToolActor();
  if (parsed.value.action === 'pause') {
    const paused = await pauseAccountPublishing(env, parsed.value.accountId, parsed.value.reason);
    if (!paused.ok) return paused.response;

    const audit = await writeInternalControlEvent({
      env,
      kind: 'account_publish_containment_paused',
      actor,
      targetType: 'account_publish_containment',
      targetId: parsed.value.accountId,
      accountId: parsed.value.accountId,
      reason: parsed.value.reason,
      payload: {
        accountId: parsed.value.accountId,
      },
      result: {
        active: true,
      },
    });
    if (!audit.ok) return audit.response;

    return new Response(
      JSON.stringify({
        ok: true,
        auditEventId: audit.eventId,
        containment: {
          accountId: parsed.value.accountId,
          active: true,
          action: 'pause',
          accountName: account.account.name,
          accountSlug: account.account.slug,
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

  const resumed = await resumeAccountPublishing(env, parsed.value.accountId);
  if (!resumed.ok) return resumed.response;

  const audit = await writeInternalControlEvent({
    env,
    kind: 'account_publish_containment_resumed',
    actor,
    targetType: 'account_publish_containment',
    targetId: parsed.value.accountId,
    accountId: parsed.value.accountId,
    reason: parsed.value.reason,
    payload: {
      accountId: parsed.value.accountId,
    },
    result: {
      active: false,
      changed: resumed.changed,
    },
  });
  if (!audit.ok) return audit.response;

  return new Response(
    JSON.stringify({
      ok: true,
      auditEventId: audit.eventId,
      containment: {
        accountId: parsed.value.accountId,
        active: false,
        action: 'resume',
        changed: resumed.changed,
        accountName: account.account.name,
        accountSlug: account.account.slug,
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

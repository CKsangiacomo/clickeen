import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { ckError, errorDetail } from '../../shared/errors';
import { asTrimmedString, assertConfig, isRecord, isUuid } from '../../shared/validation';
import type { Env } from '../../shared/types';
import { loadAccountById } from '../../shared/accounts';
import {
  loadSavedConfigStateFromTokyo,
  writeSavedConfigToTokyo,
} from '../account-instances/service';
import {
  loadInstanceByAccountAndPublicId,
  resolveWidgetTypeForInstance,
} from '../instances';
import { resolveInstanceKind, resolveInstanceAccountId } from '../../shared/instances';
import { type InternalControlActor, writeInternalControlEvent } from './audit';

type SupportUpdatePayload = {
  accountId: string;
  publicId: string;
  reason: string;
  config: Record<string, unknown>;
};

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

function notFoundResponse(reasonKey: string, detail: string): Response {
  return ckError({ kind: 'NOT_FOUND', reasonKey, detail }, 404);
}

function parsePayload(value: unknown):
  | { ok: true; value: SupportUpdatePayload }
  | { ok: false; response: Response } {
  if (!isRecord(value)) return { ok: false, response: validationResponse('payload must be an object') };

  const accountId = asTrimmedString(value.accountId);
  if (!isUuid(accountId)) return { ok: false, response: validationResponse('accountId must be a UUID') };

  const publicId = asTrimmedString(value.publicId);
  if (!publicId || publicId.length > 120) {
    return { ok: false, response: validationResponse('publicId must be a non-empty string up to 120 chars') };
  }

  const reason = asTrimmedString(value.reason);
  if (!reason || reason.length > 280) {
    return { ok: false, response: validationResponse('reason must be a non-empty string up to 280 chars') };
  }

  const configResult = assertConfig(value.config);
  if (!configResult.ok) {
    return { ok: false, response: validationResponse(configResult.issues[0]?.message || 'config must be an object') };
  }

  return {
    ok: true,
    value: {
      accountId,
      publicId,
      reason,
      config: configResult.value,
    },
  };
}

export async function handleSupportUpdateInstance(request: Request, env: Env): Promise<Response> {
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

  const account = await loadAccountById(env, parsed.value.accountId);
  if (!account) {
    return notFoundResponse('coreui.errors.account.notFound', 'support_target_account_not_found');
  }

  let instance: Awaited<ReturnType<typeof loadInstanceByAccountAndPublicId>> = null;
  try {
    instance = await loadInstanceByAccountAndPublicId(env, parsed.value.accountId, parsed.value.publicId);
  } catch (error) {
    return internalResponse('coreui.errors.internalControl.supportSaveFailed', errorDetail(error));
  }
  if (!instance) {
    return notFoundResponse('coreui.errors.instance.notFound', 'support_target_instance_not_found');
  }

  const instanceKind = resolveInstanceKind(instance);
  const ownerAccountId = resolveInstanceAccountId(instance);
  if (instanceKind !== 'user' || ownerAccountId !== parsed.value.accountId) {
    return notFoundResponse('coreui.errors.instance.notFound', 'support_target_customer_instance_required');
  }

  let currentSavedState: Awaited<ReturnType<typeof loadSavedConfigStateFromTokyo>> = null;
  try {
    currentSavedState = await loadSavedConfigStateFromTokyo({
      env,
      accountId: parsed.value.accountId,
      publicId: parsed.value.publicId,
    });
  } catch (error) {
    return internalResponse('coreui.errors.internalControl.supportSaveFailed', errorDetail(error));
  }
  if (!currentSavedState) {
    return notFoundResponse('coreui.errors.instance.notFound', 'support_target_saved_config_missing');
  }

  let widgetType: string | null = null;
  try {
    widgetType = await resolveWidgetTypeForInstance(env, instance, currentSavedState.widgetType);
  } catch (error) {
    return internalResponse('coreui.errors.internalControl.supportSaveFailed', errorDetail(error));
  }
  if (!widgetType) {
    return internalResponse('coreui.errors.internalControl.supportSaveFailed', 'support_target_widget_type_missing');
  }

  try {
    await writeSavedConfigToTokyo({
      env,
      accountId: parsed.value.accountId,
      publicId: parsed.value.publicId,
      widgetType,
      config: parsed.value.config,
    });
  } catch (error) {
    return internalResponse('coreui.errors.internalControl.supportSaveFailed', errorDetail(error));
  }

  let nextSavedState: Awaited<ReturnType<typeof loadSavedConfigStateFromTokyo>> = null;
  try {
    nextSavedState = await loadSavedConfigStateFromTokyo({
      env,
      accountId: parsed.value.accountId,
      publicId: parsed.value.publicId,
    });
  } catch (error) {
    return internalResponse('coreui.errors.internalControl.supportSaveFailed', errorDetail(error));
  }
  if (!nextSavedState) {
    return internalResponse('coreui.errors.internalControl.supportSaveFailed', 'support_target_post_save_missing');
  }

  const actor = localToolActor();
  const audit = await writeInternalControlEvent({
    env,
    kind: 'support_instance_saved',
    actor,
    targetType: 'account_widget_instance',
    targetId: parsed.value.publicId,
    accountId: parsed.value.accountId,
    reason: parsed.value.reason,
    payload: {
      widgetType,
      accountTier: account.tier,
      previousConfigFp: currentSavedState.configFp,
      previousUpdatedAt: currentSavedState.updatedAt,
    },
    result: {
      nextConfigFp: nextSavedState.configFp,
      nextUpdatedAt: nextSavedState.updatedAt,
    },
  });
  if (!audit.ok) return audit.response;

  return new Response(
    JSON.stringify({
      ok: true,
      auditEventId: audit.eventId,
      config: nextSavedState.config,
      aftermath: {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.internalControl.supportSaveBackgroundPending',
          detail: 'Saved through DevStudio support path. Translation sync and other aftermath remain manual for now.',
        },
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

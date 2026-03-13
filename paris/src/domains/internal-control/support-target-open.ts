import { resolvePolicy } from '@clickeen/ck-policy';
import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { ckError, errorDetail } from '../../shared/errors';
import { asTrimmedString, assertConfig, isRecord, isUuid } from '../../shared/validation';
import { loadAccountById } from '../../shared/accounts';
import type { Env } from '../../shared/types';
import { loadSavedConfigStateFromTokyo } from '../account-instances/service';
import { loadAccountLocalizationPayload } from '../account-instances/read-handlers';
import {
  loadInstanceByAccountAndPublicId,
  resolveWidgetTypeForInstance,
} from '../instances';
import { resolveInstanceKind, resolveInstanceAccountId } from '../../shared/instances';
import { type InternalControlActor, writeInternalControlEvent } from './audit';

type SupportTargetOpenPayload = {
  accountId: string;
  publicId: string;
  reason: string;
};

const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';

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
  | { ok: true; value: SupportTargetOpenPayload }
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

  return { ok: true, value: { accountId, publicId, reason } };
}

function resolveInstanceLabel(instance: Record<string, unknown>): string {
  const raw = asTrimmedString(instance.display_name);
  return raw ?? DEFAULT_INSTANCE_DISPLAY_NAME;
}

export async function handleSupportTargetOpen(request: Request, env: Env): Promise<Response> {
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
    return internalResponse('coreui.errors.internalControl.supportTargetLookupFailed', errorDetail(error));
  }
  if (!instance) {
    return notFoundResponse('coreui.errors.instance.notFound', 'support_target_instance_not_found');
  }

  const instanceKind = resolveInstanceKind(instance);
  const ownerAccountId = resolveInstanceAccountId(instance);
  if (instanceKind !== 'user' || ownerAccountId !== parsed.value.accountId) {
    return notFoundResponse('coreui.errors.instance.notFound', 'support_target_customer_instance_required');
  }

  let savedState: Awaited<ReturnType<typeof loadSavedConfigStateFromTokyo>> = null;
  try {
    savedState = await loadSavedConfigStateFromTokyo({
      env,
      accountId: parsed.value.accountId,
      publicId: parsed.value.publicId,
    });
  } catch (error) {
    return internalResponse('coreui.errors.internalControl.supportTargetLoadFailed', errorDetail(error));
  }
  if (!savedState) {
    return notFoundResponse('coreui.errors.instance.notFound', 'support_target_saved_config_missing');
  }

  const configResult = assertConfig(savedState.config);
  if (!configResult.ok) {
    return internalResponse(
      'coreui.errors.internalControl.supportTargetLoadFailed',
      configResult.issues[0]?.message || 'saved_config_invalid',
    );
  }

  let widgetType: string | null = null;
  try {
    widgetType = await resolveWidgetTypeForInstance(env, instance, savedState.widgetType);
  } catch (error) {
    return internalResponse('coreui.errors.internalControl.supportTargetLookupFailed', errorDetail(error));
  }
  if (!widgetType) {
    return internalResponse('coreui.errors.internalControl.supportTargetLookupFailed', 'support_target_widget_type_missing');
  }

  const policy = resolvePolicy({ profile: account.tier, role: 'editor' });

  let localization: Awaited<ReturnType<typeof loadAccountLocalizationPayload>> | null = null;
  try {
    localization = await loadAccountLocalizationPayload({
      env,
      publicId: parsed.value.publicId,
      accountLocalesRaw: account.l10n_locales,
      accountL10nPolicyRaw: account.l10n_policy,
      policy,
    });
  } catch (error) {
    return internalResponse('coreui.errors.internalControl.supportTargetLoadFailed', errorDetail(error));
  }

  const actor = localToolActor();
  const audit = await writeInternalControlEvent({
    env,
    kind: 'support_target_opened',
    actor,
    targetType: 'account_widget_instance',
    targetId: parsed.value.publicId,
    accountId: parsed.value.accountId,
    reason: parsed.value.reason,
    payload: {
      widgetType,
      status: instance.status,
      accountTier: account.tier,
    },
    result: {
      configFp: savedState.configFp,
      updatedAt: savedState.updatedAt,
    },
  });
  if (!audit.ok) return audit.response;

  return new Response(
    JSON.stringify({
      ok: true,
      auditEventId: audit.eventId,
      supportTarget: {
        accountId: parsed.value.accountId,
        publicId: parsed.value.publicId,
        ownerAccountId: parsed.value.accountId,
        accountName: account.name,
        accountSlug: account.slug,
        widgetType,
        label: resolveInstanceLabel(instance as Record<string, unknown>),
        status: instance.status,
        reason: parsed.value.reason,
        config: configResult.value,
        localization,
        policy,
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

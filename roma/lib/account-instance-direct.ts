import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';
import { validateWidgetConfigContract, type WidgetConfigContractResult } from './widget-config-contract';

// Roma's direct instance path is the server boundary for one boring product flow:
// call Tokyo's named account-instance verbs and surface their result.

export type DirectRouteError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  detail?: string;
  paths?: string[];
};

type RouteFailure = {
  ok: false;
  status: number;
  error: DirectRouteError;
};

export type AccountInstanceCoreRow = {
  instanceId: string;
  displayName: string | null;
  updatedAt?: string | null;
  widgetId?: string;
  accountId: string;
  widgetType: string;
  meta?: Record<string, unknown> | null;
};

export type AccountInstanceLiveStatus = 'published' | 'unpublished';

export type TokyoAccountInstanceIndexEntry = {
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName: string;
  publishStatus: AccountInstanceLiveStatus;
  updatedAt: string;
};

export type TokyoAccountInstanceIndex = {
  accountId: string;
  accountInstances: TokyoAccountInstanceIndexEntry[];
  publishedCount: number;
};

type TokyoL10nIntent = {
  baseLocale: string;
  desiredLocales: string[];
  countryToLocale: Record<string, string>;
};

type TokyoJsonResult =
  | { ok: true; payload: unknown; status: number }
  | RouteFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function resolveTokyoControlErrorDetail(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    return (
      asTrimmedString(payload.error.reasonKey) ??
      asTrimmedString(payload.error.detail) ??
      fallback
    );
  }
  return fallback;
}

function buildTokyoRouteFailure(args: {
  response: Response;
  payload: unknown;
  fallbackDetail: string;
  fallbackReasonKey: string;
}): RouteFailure {
  const detail = resolveTokyoControlErrorDetail(args.payload, args.fallbackDetail);
  const mapped =
    args.response.status === 401
      ? { kind: 'AUTH' as const, status: 401 }
      : args.response.status === 403
        ? { kind: 'DENY' as const, status: 403 }
        : args.response.status === 404
          ? { kind: 'NOT_FOUND' as const, status: 404 }
          : args.response.status === 422
            ? { kind: 'VALIDATION' as const, status: 422 }
            : { kind: 'UPSTREAM_UNAVAILABLE' as const, status: 502 };

  return {
    ok: false,
    status: mapped.status,
    error: {
      kind: mapped.kind,
      reasonKey: mapped.kind === 'UPSTREAM_UNAVAILABLE' ? args.fallbackReasonKey : detail,
      detail,
    },
  };
}

async function fetchTokyoJson(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  fallbackReasonKey: string;
  fallbackDetail: string;
}): Promise<TokyoJsonResult> {
  const response = await fetchTokyoProductControl({
    path: args.path,
    method: args.method,
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      internalServiceName: args.internalServiceName,
      ...(args.body !== undefined ? { contentType: 'application/json' } : {}),
    }),
    ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return buildTokyoRouteFailure({
      response,
      payload,
      fallbackDetail: args.fallbackDetail,
      fallbackReasonKey: args.fallbackReasonKey,
    });
  }
  return { ok: true, payload, status: response.status };
}

function invalidTokyoPayload(detail: string): RouteFailure {
  return {
    ok: false,
    status: 502,
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.instance.invalidPayload',
      detail,
    },
  };
}

function buildWidgetConfigContractFailure(
  contract: Extract<WidgetConfigContractResult, { ok: false }>,
): RouteFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: contract.reasonKey,
      paths: contract.issues.map((issue) => issue.path),
      detail: contract.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    },
  };
}

function normalizeTranslationFollowup(value: unknown):
  | { ok: true }
  | { ok: false; reasonKey: string; detail: string; status: number } {
  if (!isRecord(value) || value.ok !== false) return { ok: true };
  return {
    ok: false,
    reasonKey: asTrimmedString(value.reasonKey) ?? 'coreui.errors.translations.acceptanceFailed',
    detail: asTrimmedString(value.detail) ?? 'translation_followup_failed',
    status:
      typeof value.status === 'number' && Number.isFinite(value.status)
        ? Math.max(400, Math.floor(value.status))
        : 502,
  };
}

function resolveSavedInstanceDisplayName(args: {
  displayName: unknown;
  meta: unknown;
}): string | null {
  const displayName = asTrimmedString(args.displayName);
  if (displayName) return displayName;
  if (!isRecord(args.meta)) return null;
  return asTrimmedString(args.meta.styleName ?? args.meta.name ?? args.meta.title) ?? null;
}

function normalizeTokyoIndexEntry(raw: unknown): TokyoAccountInstanceIndexEntry | null {
  if (!isRecord(raw)) return null;
  const accountId = asTrimmedString(raw.accountId);
  const instanceId = asTrimmedString(raw.instanceId ?? raw.id);
  const widgetType = asTrimmedString(raw.widgetType);
  const displayName = asTrimmedString(raw.displayName);
  const updatedAt = asTrimmedString(raw.updatedAt);
  const publishStatus =
    raw.publishStatus === 'published'
      ? 'published'
      : raw.publishStatus === 'unpublished'
        ? 'unpublished'
        : null;
  if (!accountId || !instanceId || !widgetType || !displayName || !updatedAt || !publishStatus) {
    return null;
  }
  return { accountId, instanceId, widgetType, displayName, publishStatus, updatedAt };
}

function normalizeTokyoIndexEntries(raw: unknown): TokyoAccountInstanceIndexEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw.map((entry) => normalizeTokyoIndexEntry(entry));
  if (entries.some((entry) => !entry)) return null;
  return entries as TokyoAccountInstanceIndexEntry[];
}

function normalizeSavedPayload(payload: unknown):
  | { row: AccountInstanceCoreRow; config: Record<string, unknown> }
  | null {
  if (!isRecord(payload) || !isRecord(payload.config)) return null;
  const instanceId = asTrimmedString(payload.instanceId);
  const accountId = asTrimmedString(payload.accountId);
  const widgetType = asTrimmedString(payload.widgetType);
  if (!instanceId || !accountId || !widgetType) return null;
  return {
    row: {
      instanceId,
      displayName: resolveSavedInstanceDisplayName({
        displayName: payload.displayName,
        meta: payload.meta,
      }),
      updatedAt: asTrimmedString(payload.updatedAt),
      accountId,
      widgetType,
      meta: isRecord(payload.meta) ? payload.meta : null,
    },
    config: payload.config,
  };
}

async function loadSavedInstanceFromTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: { row: AccountInstanceCoreRow; config: Record<string, unknown> } | null;
    }
  | RouteFailure
> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
    method: 'GET',
    fallbackDetail: 'tokyo_saved_config_http_error',
    fallbackReasonKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) {
    if (result.status === 404) return { ok: true, value: null };
    return result;
  }
  const saved = normalizeSavedPayload(result.payload);
  if (!saved) return invalidTokyoPayload('invalid Tokyo saved instance payload');
  return { ok: true, value: saved };
}

export async function writeSavedConfigToTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  meta?: Record<string, unknown> | null;
  l10n?: {
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    } | null;
  } | null;
  internalServiceName?: string | null;
}): Promise<{ previousBaseFingerprint: string | null; baseFingerprint: string | null }> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
    method: 'PUT',
    body: {
      widgetType: args.widgetType,
      config: args.config,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.meta !== undefined ? { meta: args.meta } : {}),
      ...(args.l10n !== undefined ? { l10n: args.l10n } : {}),
    },
    fallbackDetail: 'tokyo_saved_config_http_error',
    fallbackReasonKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) throw new Error(result.error.detail ?? result.error.reasonKey);
  const payload = isRecord(result.payload) ? result.payload : {};
  const l10n = isRecord(payload.l10n) ? payload.l10n : null;
  return {
    previousBaseFingerprint: asTrimmedString(payload.previousBaseFingerprint),
    baseFingerprint: asTrimmedString(l10n?.baseFingerprint),
  };
}

export async function createAccountInstanceInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  widgetType: string;
  displayName?: string | null;
  l10n?: {
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    } | null;
  } | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; value: { row: AccountInstanceCoreRow; config: Record<string, unknown> } }
  | RouteFailure
> {
  const requestedWidgetType = asTrimmedString(args.widgetType);
  if (!requestedWidgetType) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.instance.widgetMissing',
        detail: 'widgetType is required',
      },
    };
  }

  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: '/__internal/renders/widgets/create.json',
    method: 'POST',
    body: {
      widgetType: requestedWidgetType,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.l10n !== undefined ? { l10n: args.l10n } : {}),
    },
    fallbackDetail: 'tokyo_instance_create_http_error',
    fallbackReasonKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;

  const saved = normalizeSavedPayload(result.payload);
  if (!saved) return invalidTokyoPayload('invalid Tokyo create instance payload');
  const contract = validateWidgetConfigContract({
    widgetType: saved.row.widgetType,
    config: saved.config,
  });
  if (!contract.ok) return buildWidgetConfigContractFailure(contract);
  return { ok: true, value: saved };
}

export async function saveAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  meta?: Record<string, unknown> | null;
  l10nIntent: TokyoL10nIntent;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        live: boolean;
        translationFollowup:
          | { ok: true }
          | { ok: false; reasonKey: string; detail: string; status: number };
      };
    }
  | RouteFailure
> {
  const contract = validateWidgetConfigContract({
    widgetType: args.widgetType,
    config: args.config,
  });
  if (!contract.ok) return buildWidgetConfigContractFailure(contract);

  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/save.json`,
    method: 'POST',
    body: {
      widgetType: args.widgetType,
      config: args.config,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.meta !== undefined ? { meta: args.meta } : {}),
      l10nIntent: args.l10nIntent,
    },
    fallbackDetail: 'tokyo_instance_save_http_error',
    fallbackReasonKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.payload) ? result.payload : {};
  return {
    ok: true,
    value: {
      live: payload.live === true,
      translationFollowup: normalizeTranslationFollowup(payload.translationFollowup),
    },
  };
}

export async function duplicateAccountInstanceInTokyo(args: {
  accountId: string;
  sourceInstanceId: string;
  accountCapsule?: string | null;
  l10nIntent: TokyoL10nIntent;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        accountId: string;
        sourceInstanceId: string;
        instanceId: string;
        widgetType: string;
        status: AccountInstanceLiveStatus;
        translationFollowup:
          | { ok: true }
          | { ok: false; reasonKey: string; detail: string; status: number };
      };
    }
  | RouteFailure
> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: `/__internal/renders/widgets/${encodeURIComponent(args.sourceInstanceId)}/duplicate.json`,
    method: 'POST',
    body: { l10nIntent: args.l10nIntent },
    fallbackDetail: 'tokyo_instance_duplicate_http_error',
    fallbackReasonKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.payload) ? result.payload : null;
  const accountId = asTrimmedString(payload?.accountId);
  const sourceInstanceId = asTrimmedString(payload?.sourceInstanceId);
  const instanceId = asTrimmedString(payload?.instanceId);
  const widgetType = asTrimmedString(payload?.widgetType);
  if (!accountId || !sourceInstanceId || !instanceId || !widgetType) {
    return invalidTokyoPayload('invalid Tokyo duplicate payload');
  }
  return {
    ok: true,
    value: {
      accountId,
      sourceInstanceId,
      instanceId,
      widgetType,
      status: payload?.status === 'published' ? 'published' : 'unpublished',
      translationFollowup: normalizeTranslationFollowup(payload?.translationFollowup),
    },
  };
}

async function postInstanceStatusTransition(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  action: 'publish' | 'unpublish';
  expectedStatus: AccountInstanceLiveStatus;
  body?: Record<string, unknown>;
}): Promise<
  | { ok: true; value: { instanceId: string; status: AccountInstanceLiveStatus; changed: boolean } }
  | RouteFailure
> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/${args.action}.json`,
    method: 'POST',
    body: args.body ?? {},
    fallbackDetail: `tokyo_instance_${args.action}_http_error`,
    fallbackReasonKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.payload) ? result.payload : null;
  const instanceId = asTrimmedString(payload?.instanceId);
  if (!instanceId || payload?.status !== args.expectedStatus) {
    return invalidTokyoPayload(`invalid Tokyo ${args.action} payload`);
  }
  return {
    ok: true,
    value: {
      instanceId,
      status: args.expectedStatus,
      changed: payload?.changed === true,
    },
  };
}

export async function publishAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  l10nIntent: TokyoL10nIntent;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; value: { instanceId: string; status: 'published'; changed: boolean } }
  | RouteFailure
> {
  const result = await postInstanceStatusTransition({
    ...args,
    action: 'publish',
    expectedStatus: 'published',
    body: { l10nIntent: args.l10nIntent },
  });
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      instanceId: result.value.instanceId,
      status: 'published',
      changed: result.value.changed,
    },
  };
}

export async function unpublishAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; value: { instanceId: string; status: 'unpublished'; changed: boolean } }
  | RouteFailure
> {
  const result = await postInstanceStatusTransition({
    ...args,
    action: 'unpublish',
    expectedStatus: 'unpublished',
  });
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      instanceId: result.value.instanceId,
      status: 'unpublished',
      changed: result.value.changed,
    },
  };
}

export async function deleteAccountInstanceFromTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<{ existed: boolean }> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
    method: 'DELETE',
    fallbackDetail: 'tokyo_account_instance_delete_http_error',
    fallbackReasonKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok && result.status !== 404) {
    throw new Error(result.error.detail ?? result.error.reasonKey);
  }
  const payload = result.ok && isRecord(result.payload) ? result.payload : null;
  return { existed: payload?.existed === true || payload?.deleted === true };
}

export async function loadTokyoAccountInstanceDocument<TRow extends AccountInstanceCoreRow>(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: { row: TRow; config: Record<string, unknown> };
    }
  | RouteFailure
> {
  const saved = await loadSavedInstanceFromTokyo(args);
  if (!saved.ok) return saved;
  if (!saved.value) {
    return {
      ok: false,
      status: 404,
      error: {
        kind: 'NOT_FOUND',
        reasonKey: 'coreui.errors.instance.notFound',
      },
    };
  }
  const contract = validateWidgetConfigContract({
    widgetType: saved.value.row.widgetType,
    config: saved.value.config,
  });
  if (!contract.ok) return buildWidgetConfigContractFailure(contract);
  return {
    ok: true,
    value: {
      row: saved.value.row as TRow,
      config: saved.value.config,
    },
  };
}

export async function loadTokyoAccountInstanceServeStates(args: {
  accountId: string;
  instanceIds: string[];
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        serveStates: Record<string, AccountInstanceLiveStatus>;
        publishedCount: number;
      };
    }
  | RouteFailure
> {
  const instanceIds = Array.from(
    new Set(
      args.instanceIds
        .map((instanceId) => String(instanceId || '').trim())
        .filter(Boolean),
    ),
  );
  if (!instanceIds.length) {
    return { ok: true, value: { serveStates: {}, publishedCount: 0 } };
  }

  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: '/__internal/renders/widgets/serve-state.json',
    method: 'POST',
    body: { instanceIds },
    fallbackDetail: 'tokyo_live_status_http_error',
    fallbackReasonKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.payload) ? result.payload : {};
  const serveStatesRecord = isRecord(payload.serveStates) ? payload.serveStates : {};
  const serveStates = Object.fromEntries(
    instanceIds.map((instanceId) => [
      instanceId,
      serveStatesRecord[instanceId] === 'published' ? 'published' : 'unpublished',
    ]),
  ) as Record<string, AccountInstanceLiveStatus>;
  const publishedCount =
    typeof payload.publishedCount === 'number' && Number.isFinite(payload.publishedCount)
      ? Math.max(0, Math.floor(payload.publishedCount))
      : Object.values(serveStates).filter((state) => state === 'published').length;
  return { ok: true, value: { serveStates, publishedCount } };
}

export async function loadTokyoAccountInstanceIndex(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; value: TokyoAccountInstanceIndex }
  | RouteFailure
> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    path: '/__internal/renders/widgets/index.json',
    method: 'GET',
    fallbackDetail: 'tokyo_instance_index_http_error',
    fallbackReasonKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = isRecord(result.payload) ? result.payload : {};
  const accountId = asTrimmedString(payload.accountId);
  const accountInstances = normalizeTokyoIndexEntries(payload.accountInstances);
  if (!accountId || !accountInstances) {
    return invalidTokyoPayload('invalid Tokyo instance index payload');
  }
  const publishedCount =
    typeof payload.publishedCount === 'number' && Number.isFinite(payload.publishedCount)
      ? Math.max(0, Math.floor(payload.publishedCount))
      : accountInstances.filter((entry) => entry.publishStatus === 'published').length;
  return {
    ok: true,
    value: { accountId, accountInstances, publishedCount },
  };
}

export async function saveAccountInstanceDirect(args: {
  accountId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  meta?: Record<string, unknown> | null;
  l10n?: {
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    } | null;
  } | null;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; previousBaseFingerprint: string | null; baseFingerprint: string | null }
  | RouteFailure
> {
  const contract = validateWidgetConfigContract({
    widgetType: args.widgetType,
    config: args.config,
  });
  if (!contract.ok) return buildWidgetConfigContractFailure(contract);

  try {
    return {
      ok: true,
      ...(await writeSavedConfigToTokyo(args)),
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

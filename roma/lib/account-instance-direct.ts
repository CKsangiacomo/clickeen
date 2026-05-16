import { asTrimmedString, isRecord, serializeCkLogEvent } from '@clickeen/ck-contracts';
import type { WidgetOverlayContract } from '@clickeen/ck-contracts/overlay-primitives';
import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';
import { callTokyo, type TokyoCallContext } from './tokyo-client';

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
  publishStatus?: AccountInstanceLiveStatus;
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

export type TokyoWidgetCatalogEntry = {
  widgetType: string;
  widgetCode: string;
  label: string;
  description: string;
  category: string;
  capabilities: {
    seoGeo: boolean;
  };
  overlays: WidgetOverlayContract;
};

type TokyoJsonResult =
  | { ok: true; payload: unknown; status: number }
  | RouteFailure;

function tokyoCallContext(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): TokyoCallContext {
  return {
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
  };
}

function resolveTokyoControlErrorDetail(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    return (
      asTrimmedString(payload.error.detail) ??
      asTrimmedString(payload.error.reasonKey) ??
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
  const upstreamError = isRecord(args.payload) && isRecord(args.payload.error) ? args.payload.error : null;
  const detail = resolveTokyoControlErrorDetail(args.payload, args.fallbackDetail);
  const upstreamReasonKey = upstreamError ? asTrimmedString(upstreamError.reasonKey) : null;
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
      reasonKey:
        mapped.kind === 'UPSTREAM_UNAVAILABLE'
          ? (upstreamReasonKey ?? args.fallbackReasonKey)
          : (upstreamReasonKey ?? detail),
      detail,
    },
  };
}

function logTokyoJsonParseWarning(args: {
  requestId?: string | null;
  accountId: string;
  path: string;
  method: string;
  detail: string;
}): void {
  console.warn(
    serializeCkLogEvent({
      event: 'boundary.parse_failed',
      service: 'roma',
      stage: 'unknown',
      requestId: args.requestId || crypto.randomUUID(),
      boundary: 'tokyo.productControl.responseJson',
      method: args.method,
      path: args.path,
      accountId: args.accountId,
      detail: args.detail,
    }),
  );
}

async function fetchTokyoJson(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
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
      requestId: args.requestId,
      ...(args.body !== undefined ? { contentType: 'application/json' } : {}),
    }),
    ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (error) {
    logTokyoJsonParseWarning({
      requestId: args.requestId,
      accountId: args.accountId,
      path: args.path,
      method: args.method,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
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

function normalizeTokyoWidgetCatalogEntry(raw: unknown): TokyoWidgetCatalogEntry | null {
  if (!isRecord(raw)) return null;
  const widgetType = asTrimmedString(raw.widgetType);
  const widgetCode = asTrimmedString(raw.widgetCode);
  const label = asTrimmedString(raw.label);
  const description = asTrimmedString(raw.description);
  const category = asTrimmedString(raw.category);
  const capabilitiesRaw = isRecord(raw.capabilities) ? raw.capabilities : {};
  const overlays = isRecord(raw.overlays) && raw.overlays.v === 1 && Array.isArray(raw.overlays.text)
    ? (raw.overlays as WidgetOverlayContract)
    : null;
  if (!widgetType || !widgetCode || !label || !description || !category || !overlays) return null;
  return {
    widgetType,
    widgetCode,
    label,
    description,
    category,
    capabilities: {
      seoGeo: capabilitiesRaw.seoGeo === true,
    },
    overlays,
  };
}

function normalizeTokyoWidgetCatalogEntries(raw: unknown): TokyoWidgetCatalogEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw.map((entry) => normalizeTokyoWidgetCatalogEntry(entry));
  if (entries.some((entry) => !entry)) return null;
  return entries as TokyoWidgetCatalogEntry[];
}

function normalizeSavedPayload(payload: unknown):
  | { row: AccountInstanceCoreRow; config: Record<string, unknown> }
  | null {
  if (!isRecord(payload) || !isRecord(payload.config)) return null;
  const instanceId = asTrimmedString(payload.instanceId ?? payload.id);
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
      publishStatus: payload.publishStatus === 'published' ? 'published' : payload.publishStatus === 'unpublished' ? 'unpublished' : undefined,
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
  requestId?: string | null;
}): Promise<
  | {
      ok: true;
      value: { row: AccountInstanceCoreRow; config: Record<string, unknown> } | null;
    }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_saved_config_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) {
    if (result.status === 404) return { ok: true, value: null };
    return result;
  }
  const saved = normalizeSavedPayload(result.value);
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
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<void> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
    method: 'PUT',
    body: {
      widgetType: args.widgetType,
      config: args.config,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.meta !== undefined ? { meta: args.meta } : {}),
    },
    decode: (payload) => payload,
    errorDetail: 'tokyo_saved_config_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) throw new Error(result.error.detail ?? result.error.reasonKey);
}

export async function createAccountInstanceInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  widgetType: string;
  displayName?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
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
    requestId: args.requestId,
    path: '/__internal/renders/widgets/create.json',
    method: 'POST',
    body: {
      widgetType: requestedWidgetType,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
    },
    fallbackDetail: 'tokyo_instance_create_http_error',
    fallbackReasonKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;

  const saved = normalizeSavedPayload(result.payload);
  if (!saved) return invalidTokyoPayload('invalid Tokyo create instance payload');
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
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        live: boolean;
      };
    }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/save.json`,
    method: 'POST',
    body: {
      widgetType: args.widgetType,
      config: args.config,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.meta !== undefined ? { meta: args.meta } : {}),
    },
    decode: (payload) => payload,
    errorDetail: 'tokyo_instance_save_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : {};
  return {
    ok: true,
    value: {
      live: payload.live === true,
    },
  };
}

export async function writeLanguageOverlayToTokyo(args: {
  accountId: string;
  instanceId: string;
  widgetType: string;
  languageCode: string;
  values: Record<string, string>;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { overlayId: string } }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: '/__internal/overlays/languages/write.json',
    method: 'POST',
    body: {
      instanceId: args.instanceId,
      widgetType: args.widgetType,
      languageCode: args.languageCode,
      values: args.values,
    },
    decode: (payload) => payload,
    errorDetail: 'tokyo_overlay_language_write_http_error',
    errorKey: 'tokyo.errors.l10n.invalid',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const overlayId = asTrimmedString(payload?.overlayId);
  if (!overlayId) return invalidTokyoPayload('invalid Tokyo overlay write payload');
  return { ok: true, value: { overlayId } };
}

export async function clearLanguageOverlaySelectionInTokyo(args: {
  accountId: string;
  instanceId: string;
  widgetType: string;
  languageCode: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: '/__internal/overlays/languages/clear.json',
    method: 'POST',
    body: {
      instanceId: args.instanceId,
      widgetType: args.widgetType,
      languageCode: args.languageCode,
    },
    decode: (payload) => payload,
    errorDetail: 'tokyo_overlay_language_clear_http_error',
    errorKey: 'tokyo.errors.l10n.invalid',
  });
  if (!result.ok) return result;
  return { ok: true };
}

export async function duplicateAccountInstanceInTokyo(args: {
  accountId: string;
  sourceInstanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        accountId: string;
        sourceInstanceId: string;
        instanceId: string;
        widgetType: string;
        status: AccountInstanceLiveStatus;
      };
    }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/renders/widgets/${encodeURIComponent(args.sourceInstanceId)}/duplicate.json`,
    method: 'POST',
    body: {},
    decode: (payload) => payload,
    errorDetail: 'tokyo_instance_duplicate_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
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
    },
  };
}

async function postInstanceStatusTransition(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
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
    requestId: args.requestId,
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
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { instanceId: string; status: 'published'; changed: boolean } }
  | RouteFailure
> {
  const result = await postInstanceStatusTransition({
    ...args,
    action: 'publish',
    expectedStatus: 'published',
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
  requestId?: string | null;
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
  requestId?: string | null;
}): Promise<{ existed: boolean }> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
    method: 'DELETE',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_instance_delete_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok && result.status !== 404) {
    throw new Error(result.error.detail ?? result.error.reasonKey);
  }
  const payload = result.ok && isRecord(result.value) ? result.value : null;
  return { existed: payload?.existed === true || payload?.deleted === true };
}

export async function loadTokyoAccountInstanceDocument<TRow extends AccountInstanceCoreRow>(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
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
  requestId?: string | null;
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
    requestId: args.requestId,
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
  requestId?: string | null;
}): Promise<
  | { ok: true; value: TokyoAccountInstanceIndex }
  | RouteFailure
> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
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

export async function loadTokyoWidgetCatalog(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { widgets: TokyoWidgetCatalogEntry[] } }
  | RouteFailure
> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
    path: '/__internal/renders/widgets/catalog.json',
    method: 'GET',
    fallbackDetail: 'tokyo_widget_catalog_http_error',
    fallbackReasonKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = isRecord(result.payload) ? result.payload : {};
  const widgets = normalizeTokyoWidgetCatalogEntries(payload.widgets);
  if (!widgets) {
    return invalidTokyoPayload('invalid Tokyo widget catalog payload');
  }
  return { ok: true, value: { widgets } };
}

export async function saveAccountInstanceDirect(args: {
  accountId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  meta?: Record<string, unknown> | null;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true }
  | RouteFailure
> {
  try {
    await writeSavedConfigToTokyo(args);
    return { ok: true };
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

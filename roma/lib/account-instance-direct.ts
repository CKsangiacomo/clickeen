import { asTrimmedString, isRecord, serializeCkLogEvent } from '@clickeen/ck-contracts';
import { readWidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';
import { callTokyo, type TokyoCallContext } from './tokyo-client';
import {
  listAccountPagesInTokyo,
  loadAccountPageFromTokyo,
  type DirectPageRouteError,
} from './account-page-direct';

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
  baseLocale?: string;
  publishStatus?: AccountInstanceLiveStatus;
  meta?: Record<string, unknown> | null;
};

export type AccountInstanceLiveStatus = 'published' | 'unpublished';

export type TokyoAccountInstanceListEntry = {
  accountId: string;
  instanceId: string;
  widgetCode?: string;
  widgetType: string;
  displayName: string;
  publishStatus: AccountInstanceLiveStatus;
  updatedAt: string;
};

export type TokyoAccountInstanceList = {
  accountId: string;
  accountInstances: TokyoAccountInstanceListEntry[];
  publishedCount: number;
};

export type TokyoWidgetDefinition = {
  widgetType: string;
  widgetCode: string;
  editableFields: WidgetEditableFieldsContract;
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

function pageRouteFailureToInstanceFailure(result: {
  ok: false;
  status: number;
  error: DirectPageRouteError;
}): RouteFailure {
  return {
    ok: false,
    status: result.status,
    error: result.error,
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

function normalizeTokyoInstanceListEntry(raw: unknown): TokyoAccountInstanceListEntry | null {
  if (!isRecord(raw)) return null;
  const accountId = asTrimmedString(raw.accountId);
  const instanceId = asTrimmedString(raw.instanceId ?? raw.id);
  const widgetCode = asTrimmedString(raw.widgetCode);
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
  return { accountId, instanceId, ...(widgetCode ? { widgetCode } : {}), widgetType, displayName, publishStatus, updatedAt };
}

function normalizeTokyoInstanceListEntries(raw: unknown): TokyoAccountInstanceListEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw.map((entry) => normalizeTokyoInstanceListEntry(entry));
  if (entries.some((entry) => !entry)) return null;
  return entries as TokyoAccountInstanceListEntry[];
}

function normalizeTokyoWidgetDefinition(raw: unknown): TokyoWidgetDefinition | null {
  if (!isRecord(raw)) return null;
  const widgetType = asTrimmedString(raw.widgetType);
  const widgetCode = asTrimmedString(raw.widgetCode);
  let editableFields: WidgetEditableFieldsContract | null = null;
  try {
    editableFields = readWidgetEditableFieldsContract(raw.editableFields);
  } catch {
    editableFields = null;
  }
  if (!widgetType || !widgetCode || !editableFields) return null;
  return {
    widgetType,
    widgetCode,
    editableFields,
  };
}

function normalizeTokyoWidgetDefinitions(raw: unknown): TokyoWidgetDefinition[] | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw.map((entry) => normalizeTokyoWidgetDefinition(entry));
  if (entries.some((entry) => !entry)) return null;
  return entries as TokyoWidgetDefinition[];
}

export async function listPageIdsPlacingInstanceForAccount(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: string[] } | RouteFailure> {
  const pages = await listAccountPagesInTokyo({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
  });
  if (!pages.ok) return pageRouteFailureToInstanceFailure(pages);

  const placedPageIds: string[] = [];
  for (const page of pages.value.pages) {
    const opened = await loadAccountPageFromTokyo({
      accountId: args.accountId,
      pageId: page.pageId,
      accountCapsule: args.accountCapsule,
      internalServiceName: args.internalServiceName,
      requestId: args.requestId,
    });
    if (!opened.ok) return pageRouteFailureToInstanceFailure(opened);
    if (!opened.value) {
      return {
        ok: false,
        status: 404,
        error: {
          kind: 'NOT_FOUND',
          reasonKey: 'coreui.errors.page.notFound',
          detail: `page index points to missing page: ${page.pageId}`,
        },
      };
    }
    if (opened.value.source.placements.some((placement) => placement.instanceId === args.instanceId)) {
      placedPageIds.push(page.pageId);
    }
  }

  return { ok: true, value: placedPageIds };
}

function normalizeAccountInstancePayload(payload: unknown):
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
      baseLocale: asTrimmedString(payload.baseLocale) ?? undefined,
      publishStatus: payload.publishStatus === 'published' ? 'published' : payload.publishStatus === 'unpublished' ? 'unpublished' : undefined,
      meta: isRecord(payload.meta) ? payload.meta : null,
    },
    config: payload.config,
  };
}

async function openAccountInstanceFromTokyo(args: {
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
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_instance_open_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) {
    if (result.status === 404) return { ok: true, value: null };
    return result;
  }
  const saved = normalizeAccountInstancePayload(result.value);
  if (!saved) return invalidTokyoPayload('invalid Tokyo account instance payload');
  return { ok: true, value: saved };
}

export async function createAccountInstanceInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  widgetType: string;
  displayName?: string | null;
  config: Record<string, unknown>;
  baseLocale: string;
  targetLocales: string[];
  meta?: Record<string, unknown> | null;
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
    path: '/__internal/instances',
    method: 'POST',
    body: {
      widgetType: requestedWidgetType,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      source: {
        config: args.config,
      },
      baseLocale: args.baseLocale,
      targetLocales: args.targetLocales,
      meta: {
        ...(args.meta ?? {}),
        baseLocale: args.baseLocale,
        targetLocales: args.targetLocales,
      },
    },
    fallbackDetail: 'tokyo_instance_create_http_error',
    fallbackReasonKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;

  const saved = normalizeAccountInstancePayload(result.payload);
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
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
    method: 'PUT',
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
  const source = await openAccountInstanceFromTokyo({
    accountId: args.accountId,
    instanceId: args.sourceInstanceId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
  });
  if (!source.ok) return source;
  if (!source.value) {
    return {
      ok: false,
      status: 404,
      error: {
        kind: 'NOT_FOUND',
        reasonKey: 'coreui.errors.instance.notFound',
        detail: `source instance not found: ${args.sourceInstanceId}`,
      },
    };
  }
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.sourceInstanceId)}/duplicate`,
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
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/${args.action}`,
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
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
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
  const saved = await openAccountInstanceFromTokyo(args);
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

export async function listAccountInstancesInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: TokyoAccountInstanceList }
  | RouteFailure
> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/instances`,
    method: 'GET',
    fallbackDetail: 'tokyo_account_instances_list_http_error',
    fallbackReasonKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = isRecord(result.payload) ? result.payload : {};
  const accountId = asTrimmedString(payload.accountId);
  const accountInstances = normalizeTokyoInstanceListEntries(payload.accountInstances);
  if (!accountId || !accountInstances) {
    return invalidTokyoPayload('invalid Tokyo account instances list payload');
  }
  const publishedCount =
    typeof payload.publishedCount === 'number' && Number.isFinite(payload.publishedCount)
      ? Math.max(0, Math.floor(payload.publishedCount))
      : null;
  if (publishedCount == null) {
    return invalidTokyoPayload('invalid Tokyo account instances list publishedCount payload');
  }
  return {
    ok: true,
    value: { accountId, accountInstances, publishedCount },
  };
}

export async function listTokyoWidgetDefinitions(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { widgetDefinitions: TokyoWidgetDefinition[] } }
  | RouteFailure
> {
  const result = await fetchTokyoJson({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
    path: '/__internal/widgets/definitions',
    method: 'GET',
    fallbackDetail: 'tokyo_widget_definitions_http_error',
    fallbackReasonKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = isRecord(result.payload) ? result.payload : {};
  const widgetDefinitions = normalizeTokyoWidgetDefinitions(payload.widgetDefinitions);
  if (!widgetDefinitions) {
    return invalidTokyoPayload('invalid Tokyo widget definitions payload');
  }
  return { ok: true, value: { widgetDefinitions } };
}

export async function renameAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  displayName: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { instanceId: string; displayName: string } }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/rename`,
    method: 'POST',
    body: {
      displayName: args.displayName,
    },
    decode: (payload) => payload,
    errorDetail: 'tokyo_instance_rename_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const instanceId = asTrimmedString(payload?.instanceId);
  const displayName = asTrimmedString(payload?.displayName);
  if (!instanceId || !displayName) {
    return invalidTokyoPayload('invalid Tokyo rename instance payload');
  }
  return { ok: true, value: { instanceId, displayName } };
}

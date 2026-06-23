import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { readWidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import { callTokyo, type TokyoCallContext } from './tokyo-client';
import {
  composeConfigWithInstanceContent,
  type AccountInstanceContentDocument,
} from './account-instance-source-artifacts';

// Roma's direct instance path is the server boundary for one boring product flow:
// call Tokyo's named account-instance verbs and surface their result.

export type DirectRouteError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  detail?: string;
  paths?: string[];
  pageIds?: string[];
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

export type TokyoAccountInstanceFacts = {
  accountId: string;
  hasInstances: boolean;
};

export type TokyoWidgetDefinition = {
  widgetType: string;
  widgetCode: string;
  displayName: string;
  description: string;
  editableFields: WidgetEditableFieldsContract;
};

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

function normalizeInstanceMeta(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = {};
  const allowedKeys = new Set(['baseLocale', 'styleName', 'name', 'title']);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) return null;
  }
  for (const key of ['baseLocale', 'styleName', 'name', 'title']) {
    const entry = value[key];
    if (typeof entry === 'string' && entry.trim()) out[key] = entry.trim();
  }
  return out;
}

function normalizeCallerInstanceMeta(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = {};
  const allowedKeys = new Set(['styleName', 'name', 'title']);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) return null;
  }
  for (const key of ['styleName', 'name', 'title']) {
    const entry = value[key];
    if (typeof entry === 'string' && entry.trim()) out[key] = entry.trim();
  }
  return out;
}

function isAccountInstanceContentDocument(value: unknown): value is AccountInstanceContentDocument {
  if (!isRecord(value) || !isRecord(value.fields)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.accountId === 'string' &&
    typeof value.widgetType === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function notFoundFailure(args: { reasonKey: string; detail?: string }): RouteFailure {
  return {
    ok: false,
    status: 404,
    error: {
      kind: 'NOT_FOUND',
      reasonKey: args.reasonKey,
      ...(args.detail ? { detail: args.detail } : {}),
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
  return {
    accountId,
    instanceId,
    ...(widgetCode ? { widgetCode } : {}),
    widgetType,
    displayName,
    publishStatus,
    updatedAt,
  };
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
  const displayName = asTrimmedString(raw.displayName);
  const description = typeof raw.description === 'string' ? raw.description : null;
  let editableFields: WidgetEditableFieldsContract | null = null;
  try {
    editableFields = readWidgetEditableFieldsContract(raw.editableFields);
  } catch {
    editableFields = null;
  }
  if (!widgetType || !widgetCode || !displayName || description == null || !editableFields)
    return null;
  return {
    widgetType,
    widgetCode,
    displayName,
    description,
    editableFields,
  };
}

function normalizeTokyoWidgetDefinitions(raw: unknown): TokyoWidgetDefinition[] | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw.map((entry) => normalizeTokyoWidgetDefinition(entry));
  if (entries.some((entry) => !entry)) return null;
  return entries as TokyoWidgetDefinition[];
}

function normalizeAccountInstancePayload(payload: unknown): {
  row: AccountInstanceCoreRow;
  config: Record<string, unknown>;
} | null {
  if (!isRecord(payload)) return null;
  const source = isRecord(payload.source) ? payload.source : null;
  const sourceConfig = isRecord(source?.config) ? source.config : null;
  const sourceContent = isAccountInstanceContentDocument(source?.content) ? source.content : null;
  if (!sourceConfig || !sourceContent) return null;
  if (isRecord(payload.meta) && normalizeInstanceMeta(payload.meta) == null) return null;
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
      publishStatus:
        payload.publishStatus === 'published'
          ? 'published'
          : payload.publishStatus === 'unpublished'
            ? 'unpublished'
            : undefined,
      meta: normalizeInstanceMeta(payload.meta),
    },
    config: composeConfigWithInstanceContent({
      config: sourceConfig,
      content: sourceContent,
    }),
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
  instanceId: string;
  widgetType: string;
  displayName?: string | null;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  publicPackage: {
    v: 1;
    indexHtml: string;
    stylesCss: string;
    runtimeJs: string;
  };
  baseLocale: string;
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
  const normalizedMeta = normalizeCallerInstanceMeta(args.meta);
  if (args.meta != null && !normalizedMeta) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'meta_invalid',
      },
    };
  }
  const result = await callTokyo(tokyoCallContext(args), {
    path: '/__internal/instances',
    method: 'POST',
    body: {
      instanceId: args.instanceId,
      widgetType: requestedWidgetType,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      source: {
        config: args.config,
        content: args.content,
      },
      publicPackage: args.publicPackage,
      baseLocale: args.baseLocale,
      meta: {
        ...(normalizedMeta ?? {}),
        baseLocale: args.baseLocale,
      },
    },
    decode: (payload) => payload,
    errorDetail: 'tokyo_instance_create_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;

  const saved = normalizeAccountInstancePayload(result.value);
  if (!saved) return invalidTokyoPayload('invalid Tokyo create instance payload');
  return { ok: true, value: saved };
}

export async function saveAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  widgetType: string;
  baseLocale: string;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  publicPackage: {
    v: 1;
    indexHtml: string;
    stylesCss: string;
    runtimeJs: string;
  };
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
  const normalizedMeta = normalizeCallerInstanceMeta(args.meta);
  if (args.meta != null && !normalizedMeta) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'meta_invalid',
      },
    };
  }
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
    method: 'PUT',
    body: {
      widgetType: args.widgetType,
      baseLocale: args.baseLocale,
      source: {
        config: args.config,
        content: args.content,
      },
      publicPackage: args.publicPackage,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.meta !== undefined ? { meta: normalizedMeta } : {}),
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
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/${args.action}`,
    method: 'POST',
    body: args.body ?? {},
    decode: (payload) => payload,
    errorDetail: `tokyo_instance_${args.action}_http_error`,
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
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
  { ok: true; value: { instanceId: string; status: 'published'; changed: boolean } } | RouteFailure
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
}): Promise<{ ok: true; value: { existed: boolean } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
    method: 'DELETE',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_instance_delete_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = result.ok && isRecord(result.value) ? result.value : null;
  if (payload?.existed === false || payload?.deleted === false) {
    return notFoundFailure({ reasonKey: 'coreui.errors.instance.notFound' });
  }
  if (payload?.existed !== true && payload?.deleted !== true) {
    return invalidTokyoPayload('invalid Tokyo delete instance payload');
  }
  return { ok: true, value: { existed: true } };
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
}): Promise<{ ok: true; value: TokyoAccountInstanceList } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/instances`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_instances_list_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = isRecord(result.value) ? result.value : {};
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

export async function loadAccountInstanceFactsFromTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: TokyoAccountInstanceFacts } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/instances/facts`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_instance_facts_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = isRecord(result.value) ? result.value : {};
  const accountId = asTrimmedString(payload.accountId);
  if (accountId !== args.accountId || typeof payload.hasInstances !== 'boolean') {
    return invalidTokyoPayload('invalid Tokyo account instance facts payload');
  }
  return {
    ok: true,
    value: {
      accountId,
      hasInstances: payload.hasInstances,
    },
  };
}

export async function listTokyoWidgetDefinitions(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { widgetDefinitions: TokyoWidgetDefinition[] } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: '/__internal/widgets/definitions',
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_widget_definitions_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = isRecord(result.value) ? result.value : {};
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
}): Promise<{ ok: true; value: { instanceId: string; displayName: string } } | RouteFailure> {
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

import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
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

export type AccountWidgetInstanceListFact = {
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  publishStatus: AccountInstanceLiveStatus;
  updatedAt: string;
};

export type AccountWidgetInstanceIds = {
  accountId: string;
  instanceIds: string[];
};

const RETIRED_TOKYO_ACCOUNT_INSTANCE_LIST_FIELDS = [
  'accountInstances',
  'publishedCount',
] as const;

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

function normalizeAccountWidgetInstanceIdsPayload(raw: unknown, expectedAccountId: string): AccountWidgetInstanceIds | null {
  if (!isRecord(raw)) return null;
  if (raw.ok !== true) return null;
  if (RETIRED_TOKYO_ACCOUNT_INSTANCE_LIST_FIELDS.some((field) => field in raw)) return null;
  const accountId = asTrimmedString(raw.accountId);
  if (accountId !== expectedAccountId) return null;
  if (!Array.isArray(raw.instanceIds)) return null;
  const seen = new Set<string>();
  const instanceIds: string[] = [];
  for (const value of raw.instanceIds) {
    if (!isCompactInstanceId(value) || seen.has(value)) return null;
    seen.add(value);
    instanceIds.push(value);
  }
  return { accountId, instanceIds };
}

function normalizeAccountWidgetInstanceListFactPayload(
  raw: unknown,
  expectedAccountId: string,
  expectedInstanceId: string,
): AccountWidgetInstanceListFact | null {
  if (!isRecord(raw)) return null;
  if (raw.ok !== true) return null;
  const accountId = asTrimmedString(raw.accountId);
  const instanceId = asTrimmedString(raw.instanceId);
  const widgetType = asTrimmedString(raw.widgetType);
  const updatedAt = asTrimmedString(raw.updatedAt);
  const publishStatus =
    raw.publishStatus === 'published'
      ? 'published'
      : raw.publishStatus === 'unpublished'
        ? 'unpublished'
        : null;
  const displayName =
    typeof raw.displayName === 'string'
      ? raw.displayName
      : raw.displayName === null
        ? null
        : undefined;
  if (
    accountId !== expectedAccountId ||
    instanceId !== expectedInstanceId ||
    !isCompactInstanceId(instanceId) ||
    !widgetType ||
    !updatedAt ||
    !publishStatus ||
    displayName === undefined
  ) {
    return null;
  }
  return {
    accountId,
    instanceId,
    widgetType,
    displayName,
    updatedAt,
    publishStatus,
  };
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

export async function writeAccountInstanceLocalePackageInTokyo(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  baseLocale: string;
  sourceUpdatedAt: string;
  materializerContractVersion: string;
  publicPackage: {
    indexHtml: string;
    stylesCss: string;
    runtimeJs: string;
  };
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        accountId: string;
        instanceId: string;
        locale: string;
        publicPackageFingerprint: string;
      };
    }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/locales/${encodeURIComponent(args.locale)}/package`,
    method: 'PUT',
    body: {
      baseLocale: args.baseLocale,
      sourceUpdatedAt: args.sourceUpdatedAt,
      materializerContractVersion: args.materializerContractVersion,
      publicPackage: args.publicPackage,
    },
    decode: (payload) => payload,
    errorDetail: 'tokyo_instance_locale_package_write_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const accountId = asTrimmedString(payload?.accountId);
  const instanceId = asTrimmedString(payload?.instanceId);
  const locale = asTrimmedString(payload?.locale);
  const publicPackageFingerprint = asTrimmedString(payload?.publicPackageFingerprint);
  if (
    accountId !== args.accountId ||
    instanceId !== args.instanceId ||
    locale !== args.locale ||
    !publicPackageFingerprint
  ) {
    return invalidTokyoPayload('invalid Tokyo locale package write payload');
  }
  return { ok: true, value: { accountId, instanceId, locale, publicPackageFingerprint } };
}

export async function deleteAccountInstanceLocalePackageInTokyo(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { accountId: string; instanceId: string; locale: string } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/locales/${encodeURIComponent(args.locale)}/package`,
    method: 'DELETE',
    decode: (payload) => payload,
    errorDetail: 'tokyo_instance_locale_package_delete_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const accountId = asTrimmedString(payload?.accountId);
  const instanceId = asTrimmedString(payload?.instanceId);
  const locale = asTrimmedString(payload?.locale);
  if (accountId !== args.accountId || instanceId !== args.instanceId || locale !== args.locale) {
    return invalidTokyoPayload('invalid Tokyo locale package delete payload');
  }
  return { ok: true, value: { accountId, instanceId, locale } };
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

export async function listAccountWidgetInstanceIds(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountWidgetInstanceIds } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/instances`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_instance_ids_list_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = normalizeAccountWidgetInstanceIdsPayload(result.value, args.accountId);
  if (!payload) {
    return invalidTokyoPayload('invalid Tokyo account instance ids payload');
  }
  return { ok: true, value: payload };
}

async function loadAccountWidgetInstanceListFact(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountWidgetInstanceListFact } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/list-facts`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_instance_list_fact_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  const payload = normalizeAccountWidgetInstanceListFactPayload(
    result.value,
    args.accountId,
    args.instanceId,
  );
  if (!payload) {
    return invalidTokyoPayload('invalid Tokyo account instance list-facts payload');
  }
  return { ok: true, value: payload };
}

export async function loadAccountWidgetInstanceFacts(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { accountId: string; instances: AccountWidgetInstanceListFact[] } }
  | RouteFailure
> {
  const ids = await listAccountWidgetInstanceIds(args);
  if (!ids.ok) return ids;

  const instanceIds = ids.value.instanceIds;
  const concurrency = 8;
  const facts: AccountWidgetInstanceListFact[] = [];
  const seen = new Set<string>();
  let nextIndex = 0;
  let failure: RouteFailure | null = null;

  async function worker(): Promise<void> {
    while (!failure) {
      const index = nextIndex;
      nextIndex += 1;
      const instanceId = instanceIds[index];
      if (!instanceId) return;
      const fact = await loadAccountWidgetInstanceListFact({
        accountId: args.accountId,
        instanceId,
        accountCapsule: args.accountCapsule,
        internalServiceName: args.internalServiceName,
        requestId: args.requestId,
      });
      if (!fact.ok) {
        failure = fact;
        return;
      }
      if (seen.has(fact.value.instanceId)) {
        failure = invalidTokyoPayload('duplicate Tokyo account instance list-facts payload');
        return;
      }
      seen.add(fact.value.instanceId);
      facts.push(fact.value);
    }
  }

  const workerCount = Math.min(concurrency, instanceIds.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (failure) return failure;

  facts.sort((left, right) => {
    const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt);
    return updatedAtOrder || left.instanceId.localeCompare(right.instanceId);
  });
  return { ok: true, value: { accountId: ids.value.accountId, instances: facts } };
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

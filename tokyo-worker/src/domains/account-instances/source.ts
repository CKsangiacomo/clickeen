import type { Env } from '../../types';
import { normalizeLocale } from '../../asset-utils';
import { accountInstanceConfigKey, accountInstanceContentKey } from './keys';
import {
  createInstanceRegistryRow,
  listInstanceRegistryRows,
  readInstanceRegistryRow,
  resolveAccountInstanceLocation,
  updateInstanceRegistryEditedAt,
  updateInstanceRegistryPublishStatus,
} from './registry';
import {
  normalizeAccountInstanceConfigDocument,
  normalizeAccountInstanceContentDocument,
} from './normalize';
import { loadJson, loadJsonObject, putJson, putJsonIfUnchanged } from '../storage';
import { getWidgetDefinition, resolveWidgetCode } from '../widget-definitions';
import type {
  SavedTextField,
  WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts/translated-value-primitives';
import { buildBaseContentMarker, buildWidgetContractMarker } from '../account-translations/markers';
import type {
  AccountInstanceConfigDocument,
  AccountInstanceContentDocument,
  AccountInstanceDocument,
  AccountInstanceSummary,
  InstanceServeState,
  AccountInstanceSourceReadFailure,
  AccountInstanceSourceReadResult,
  AccountInstanceSourcePointer,
} from './types';
import { normalizeStorageId } from './utils';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeDisplayName(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

function normalizeMeta(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const meta = { ...(value as Record<string, unknown>) };
    delete meta.targetLocales;
    return meta;
  }
  throw new Error('coreui.errors.instance.invalidPayload');
}

function displayNameFromConfigDocument(configDoc: AccountInstanceConfigDocument): string {
  const displayName = normalizeDisplayName(configDoc.displayName);
  if (displayName) return displayName;
  const meta =
    configDoc.meta && typeof configDoc.meta === 'object' && !Array.isArray(configDoc.meta)
      ? configDoc.meta
      : null;
  return (
    normalizeDisplayName(meta?.styleName) ??
    normalizeDisplayName(meta?.name) ??
    normalizeDisplayName(meta?.title) ??
    configDoc.id
  );
}

export async function buildCurrentLocaleOverlayMetadata(args: {
  configDoc: AccountInstanceConfigDocument;
  content: AccountInstanceContentDocument;
}): Promise<{
  baseContentMarker: string;
  widgetContractHash: string;
  fields: SavedTextField[];
}> {
  const widgetDefinition = getWidgetDefinition(args.configDoc.widgetType);
  if (
    !widgetDefinition?.editableFields ||
    widgetDefinition.editableFields.widgetType !== args.configDoc.widgetType
  ) {
    throw new Error(`tokyo.translation.widget_unsupported:${args.configDoc.widgetType}`);
  }
  const widgetContractHash = await buildWidgetContractMarker(widgetDefinition.editableFields);
  const fields = savedTextFieldsFromContentDocument(args.content, widgetDefinition.editableFields);
  return {
    baseContentMarker: await buildBaseContentMarker({
      baseLocale: args.configDoc.baseLocale,
      widgetType: args.configDoc.widgetType,
      widgetContractHash,
      fields,
    }),
    widgetContractHash,
    fields,
  };
}

function summaryFromConfigDocument(args: {
  configDoc: AccountInstanceConfigDocument;
  publishStatus: InstanceServeState;
  updatedAt: string;
}): AccountInstanceSummary {
  const { configDoc } = args;
  return {
    accountId: configDoc.accountId,
    instanceId: configDoc.id,
    widgetCode: configDoc.widgetCode,
    widgetType: configDoc.widgetType,
    displayName: displayNameFromConfigDocument(configDoc),
    publishStatus: args.publishStatus,
    updatedAt: args.updatedAt,
  };
}

function hasOwnRecordValue(record: Record<string, unknown> | null, key: string): boolean {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function savedTextFieldsFromContentDocument(
  content: AccountInstanceContentDocument,
  contract: WidgetEditableFieldsContract,
): SavedTextField[] {
  const contractFieldByPath = new Map(contract.fields.map((field) => [field.path, field]));
  return Object.entries(content.fields)
    .map(([path, field]) => {
      const contractField = contractFieldByPath.get(path);
      if (!contractField) throw new Error(`coreui.errors.instance.content.invalid:${path}`);
      return {
        identityKey: field.identityKey ?? '',
        fieldPattern: field.fieldPattern ?? '',
        path,
        type: contractField.type,
        label: contractField.label,
        role: contractField.role,
        baseText: field.value,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function resolveBaseLocale(
  meta: Record<string, unknown> | null,
  existing?: AccountInstanceConfigDocument | null,
): string {
  if (hasOwnRecordValue(meta, 'baseLocale')) {
    const fromMeta = normalizeLocale(meta?.baseLocale);
    if (!fromMeta) throw new Error('coreui.errors.instance.invalidPayload');
    return fromMeta;
  }
  return existing?.baseLocale ?? 'en';
}

function toAccountInstanceSourcePointer(args: {
  configDoc: AccountInstanceConfigDocument;
  publishStatus: InstanceServeState;
  updatedAt: string;
}): AccountInstanceSourcePointer {
  const { configDoc } = args;
  return {
    v: 1,
    id: configDoc.id,
    accountId: configDoc.accountId,
    widgetCode: configDoc.widgetCode,
    widgetType: configDoc.widgetType,
    displayName: configDoc.displayName,
    meta: configDoc.meta ?? null,
    baseLocale: configDoc.baseLocale,
    publishStatus: args.publishStatus,
    ...(configDoc.publicPackageFingerprint
      ? { publicPackageFingerprint: configDoc.publicPackageFingerprint }
      : {}),
    updatedAt: args.updatedAt,
  };
}

function instanceFromConfigAndContent(args: {
  configDoc: AccountInstanceConfigDocument;
  content: AccountInstanceContentDocument;
}): AccountInstanceDocument {
  void args.content;
  return {
    v: 1,
    id: args.configDoc.id,
    accountId: args.configDoc.accountId,
    widgetCode: args.configDoc.widgetCode,
    widgetType: args.configDoc.widgetType,
    displayName: args.configDoc.displayName,
    meta: args.configDoc.meta ?? null,
    config: args.configDoc.config,
    baseLocale: args.configDoc.baseLocale,
    publishStatus: 'unpublished',
    createdAt: args.configDoc.createdAt,
    updatedAt: args.configDoc.updatedAt,
  };
}

export async function readConfigDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<AccountInstanceConfigDocument | null> {
  return normalizeAccountInstanceConfigDocument(
    await loadJson(
      args.env,
      accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId),
    ),
  );
}

export async function readContentDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  configDoc?: AccountInstanceConfigDocument | null;
}): Promise<AccountInstanceContentDocument | null> {
  const configDoc = args.configDoc ?? null;
  const loaded = await loadJsonObject<unknown>(
    args.env,
    accountInstanceContentKey(args.accountId, args.widgetCode, args.instanceId),
  );
  if (loaded) {
    const contentDoc = normalizeAccountInstanceContentDocument(loaded.value);
    if (!contentDoc) throw new Error('coreui.errors.instance.content.invalid');
    return contentDoc;
  }
  if (configDoc) throw new Error('coreui.errors.instance.content.missing');
  return null;
}

export async function updateContentDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  update: (content: AccountInstanceContentDocument) => AccountInstanceContentDocument;
}): Promise<AccountInstanceContentDocument> {
  const key = accountInstanceContentKey(args.accountId, args.widgetCode, args.instanceId);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const loaded = await loadJsonObject<unknown>(args.env, key);
    const content = loaded ? normalizeAccountInstanceContentDocument(loaded.value) : null;
    if (!loaded || !content) throw new Error('coreui.errors.instance.content.invalid');
    const next = args.update(content);
    const written = await putJsonIfUnchanged(args.env, key, next, loaded.httpEtag);
    if (written) return next;
  }
  throw new Error('tokyo.translation.content_write_conflict');
}

async function readAccountInstanceSummaryByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  publishStatus: InstanceServeState;
  editedAt: string;
}): Promise<AccountInstanceSummary | null> {
  const configDoc = normalizeAccountInstanceConfigDocument(
    await loadJson(
      args.env,
      accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId),
    ),
  );
  return configDoc
    ? summaryFromConfigDocument({
        configDoc,
        publishStatus: args.publishStatus,
        updatedAt: args.editedAt,
      })
    : null;
}

async function readStoredInstanceByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<AccountInstanceDocument | null> {
  const configDoc = await readConfigDocumentByLocation(args);
  if (!configDoc) return null;
  const contentDoc = await readContentDocumentByLocation({ ...args, configDoc });
  if (!contentDoc) return null;
  return instanceFromConfigAndContent({
    configDoc,
    content: contentDoc,
  });
}

export async function writeAccountInstanceSource(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  displayName?: unknown;
  meta?: unknown;
  publicPackageFingerprint?: string | null;
}): Promise<{ pointer: AccountInstanceSourcePointer }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!instanceId || !accountId || !widgetType) {
    throw new Error('coreui.errors.instance.invalidPayload');
  }
  const widgetCode = resolveWidgetCode(widgetType);
  if (!widgetCode) {
    throw new Error('tokyo.errors.widget.unsupported');
  }

  const now = nowIso();
  const existingConfig = await readConfigDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode,
    instanceId,
  });
  const meta = normalizeMeta(args.meta);
  const baseLocale = resolveBaseLocale(meta, existingConfig);
  const content = args.content;
  if (
    content.id !== instanceId ||
    content.accountId !== accountId ||
    content.widgetType !== widgetType
  ) {
    throw new Error('coreui.errors.instance.content.invalid');
  }
  const configDoc: AccountInstanceConfigDocument = {
    id: instanceId,
    accountId,
    widgetCode,
    widgetType,
    displayName: normalizeDisplayName(args.displayName),
    meta,
    config: args.config,
    baseLocale,
    ...(args.publicPackageFingerprint
      ? { publicPackageFingerprint: args.publicPackageFingerprint }
      : {}),
    createdAt: existingConfig?.createdAt ?? now,
    updatedAt: now,
  };
  const registry = await readInstanceRegistryRow({ env: args.env, accountId, instanceId });
  await putJson(args.env, accountInstanceConfigKey(accountId, widgetCode, instanceId), configDoc);
  await putJson(args.env, accountInstanceContentKey(accountId, widgetCode, instanceId), content);
  if (registry) {
    await updateInstanceRegistryEditedAt({
      env: args.env,
      accountId,
      instanceId,
      editedAt: now,
    });
  } else {
    await createInstanceRegistryRow({
      env: args.env,
      accountId,
      instanceId,
      widgetType,
      publishStatus: 'unpublished',
      translationStatus: 'idle',
      createdAt: configDoc.createdAt,
      editedAt: now,
    });
  }
  return {
    pointer: toAccountInstanceSourcePointer({
      configDoc,
      publishStatus: registry?.publishStatus ?? 'unpublished',
      updatedAt: now,
    }),
  };
}

export async function readAccountInstanceSourcePointer(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<{ ok: true; value: AccountInstanceSourcePointer } | AccountInstanceSourceReadFailure> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.invalidPayload' };
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location)
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  if (!configDoc) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.config.invalid' };
  }
  const pointer = toAccountInstanceSourcePointer({
    configDoc,
    publishStatus: location.publishStatus,
    updatedAt: location.editedAt,
  });
  if (pointer.id !== instanceId || pointer.accountId !== accountId) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  return {
    ok: true,
    value: {
      ...pointer,
      publishStatus: location.publishStatus,
      updatedAt: location.editedAt,
    },
  };
}

export async function readAccountInstanceDocument(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<{ ok: true; value: AccountInstanceDocument } | AccountInstanceSourceReadFailure> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.invalidPayload' };
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location)
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  const instance = await readStoredInstanceByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  if (!instance || instance.id !== instanceId || instance.accountId !== accountId) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.config.invalid' };
  }
  return {
    ok: true,
    value: {
      ...instance,
      publishStatus: location.publishStatus,
      updatedAt: location.editedAt,
    },
  };
}

export async function readAccountInstanceContentDocument(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<
  { ok: true; value: AccountInstanceContentDocument } | AccountInstanceSourceReadFailure
> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.invalidPayload' };
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location)
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const contentDoc = await readContentDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    configDoc,
  });
  if (!contentDoc) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.content.invalid' };
  }
  return { ok: true, value: contentDoc };
}

export async function listAccountInstances(args: {
  env: Env;
  accountId: string;
}): Promise<AccountInstanceSummary[]> {
  const accountId = normalizeStorageId(args.accountId);
  if (!accountId) throw new Error('coreui.errors.instance.invalidPayload');
  const registryRows = await listInstanceRegistryRows({ env: args.env, accountId });
  const summaries: AccountInstanceSummary[] = [];
  for (const row of registryRows) {
    const summary = await readAccountInstanceSummaryByLocation({
      env: args.env,
      accountId,
      widgetCode: row.widgetCode,
      instanceId: row.id,
      publishStatus: row.publishStatus,
      editedAt: row.editedAt,
    });
    if (!summary) throw new Error('coreui.errors.instance.config.invalid');
    summaries.push(summary);
  }
  return summaries;
}

export async function renameAccountInstanceDisplay(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  displayName: string;
  widgetType?: string | null;
}): Promise<{ instanceId: string; displayName: string; updatedAt: string }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const displayName = normalizeDisplayName(args.displayName);
  if (!instanceId || !accountId || !displayName)
    throw new Error('coreui.errors.instance.invalidPayload');
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('coreui.errors.instance.notFound');
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  if (!configDoc) throw new Error('coreui.errors.instance.config.invalid');
  const updatedAt = nowIso();
  await putJson(
    args.env,
    accountInstanceConfigKey(location.accountId, location.widgetCode, location.instanceId),
    {
      ...configDoc,
      displayName,
      updatedAt,
    } satisfies AccountInstanceConfigDocument,
  );
  await updateInstanceRegistryEditedAt({
    env: args.env,
    accountId: location.accountId,
    instanceId: location.instanceId,
    editedAt: updatedAt,
  });
  return { instanceId: location.instanceId, displayName, updatedAt };
}

export async function readAccountInstanceSource(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<AccountInstanceSourceReadResult> {
  const pointerResult = await readAccountInstanceSourcePointer(args);
  if (!pointerResult.ok) return pointerResult;
  const pointer = pointerResult.value;
  const instance = await readStoredInstanceByLocation({
    env: args.env,
    accountId: pointer.accountId,
    widgetCode: pointer.widgetCode,
    instanceId: pointer.id,
  });
  const content = await readContentDocumentByLocation({
    env: args.env,
    accountId: pointer.accountId,
    widgetCode: pointer.widgetCode,
    instanceId: pointer.id,
  });
  if (
    !instance ||
    !instance.config ||
    typeof instance.config !== 'object' ||
    Array.isArray(instance.config) ||
    !content
  ) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.config.invalid' };
  }
  return { ok: true, value: { pointer, config: instance.config, content } };
}

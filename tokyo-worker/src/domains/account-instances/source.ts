import type { Env } from '../../types';
import { normalizeLocale } from '../../asset-utils';
import {
  accountInstanceConfigKey,
  accountInstanceContentKey,
} from './keys';
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
import {
  extractSavedTextFieldsForEditableFields,
  type SavedTextField,
} from '@clickeen/ck-contracts/translated-value-primitives';
import {
  listLocaleOverlays,
  localeOverlayHasCompleteSavedTextValues,
  readLocaleOverlay,
  writeLocaleOverlay,
} from '../account-translations/overlays';
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
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error('coreui.errors.instance.invalidPayload');
}

function displayNameFromConfigDocument(configDoc: AccountInstanceConfigDocument): string {
  const displayName = normalizeDisplayName(configDoc.displayName);
  if (displayName) return displayName;
  const meta = configDoc.meta && typeof configDoc.meta === 'object' && !Array.isArray(configDoc.meta) ? configDoc.meta : null;
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
  if (!widgetDefinition?.editableFields || widgetDefinition.editableFields.widgetType !== args.configDoc.widgetType) {
    throw new Error(`tokyo.translation.widget_unsupported:${args.configDoc.widgetType}`);
  }
  const widgetContractHash = await buildWidgetContractMarker(widgetDefinition.editableFields);
  const fields = extractSavedTextFieldsForEditableFields({
    contract: widgetDefinition.editableFields,
    config: composeConfigWithContent({
      config: args.configDoc.config,
      content: args.content,
    }),
  });
  const expectedPaths = new Set(fields.map((field) => field.path));
  for (const field of fields) {
    const saved = args.content.fields[field.path];
    if (!saved || saved.value !== field.baseText || saved.identityKey !== field.identityKey || saved.fieldPattern !== field.fieldPattern) {
      throw new Error(`coreui.errors.instance.content.invalid:${field.path}`);
    }
  }
  for (const path of Object.keys(args.content.fields)) {
    if (!expectedPaths.has(path)) throw new Error(`coreui.errors.instance.content.invalid:${path}`);
  }
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

function normalizeLocaleArrayStrict(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const locales: string[] = [];
  for (const entry of value) {
    const locale = normalizeLocale(entry);
    if (!locale) return null;
    if (!locales.includes(locale)) locales.push(locale);
  }
  return locales;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deleteExistingPath(root: Record<string, unknown>, path: string): void {
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  let current: unknown = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const numeric = /^\d+$/.test(part);
    if (numeric) {
      if (!Array.isArray(current)) return;
      const offset = Number(part);
      if (offset < 0 || offset >= current.length) return;
      if (last) return;
      current = current[offset];
      continue;
    }
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) return;
    if (last) {
      delete current[part];
      return;
    }
    current = current[part];
  }
}

function setValueAtPath(root: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  let current: unknown = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const numeric = /^\d+$/.test(part);
    if (numeric) {
      if (!Array.isArray(current)) throw new Error(`tokyo.instance.content.pathInvalid:${path}`);
      const offset = Number(part);
      if (offset < 0 || offset >= current.length) throw new Error(`tokyo.instance.content.pathInvalid:${path}`);
      if (last) {
        current[offset] = value;
        return;
      }
      current = current[offset];
      continue;
    }
    if (!isRecord(current)) throw new Error(`tokyo.instance.content.pathInvalid:${path}`);
    if (last) {
      current[part] = value;
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(current, part) || current[part] == null) {
      current[part] = /^\d+$/.test(parts[index + 1] ?? '') ? [] : {};
    }
    current = current[part];
  }
}

function extractContentFields(args: {
  widgetType: string;
  config: Record<string, unknown>;
  previous?: AccountInstanceContentDocument | null;
  initialStatus: 'ok' | 'changed';
}): AccountInstanceContentDocument['fields'] {
  const widgetDefinition = getWidgetDefinition(args.widgetType);
  if (!widgetDefinition?.editableFields) return {};
  const fields: AccountInstanceContentDocument['fields'] = {};
  const previousByIdentity = new Map(
    Object.values(args.previous?.fields ?? {})
      .filter((field) => typeof field.identityKey === 'string' && field.identityKey)
      .map((field) => [field.identityKey as string, field]),
  );
  for (const item of extractSavedTextFieldsForEditableFields({
    contract: widgetDefinition.editableFields,
    config: args.config,
  })) {
    const previous = previousByIdentity.get(item.identityKey) ?? args.previous?.fields[item.path];
    const sameValue = previous && previous.value === item.baseText;
    const status =
      sameValue
        ? previous.status
        : args.previous
          ? 'changed'
          : args.initialStatus;
    fields[item.path] = {
      identityKey: item.identityKey,
      fieldPattern: item.fieldPattern,
      value: item.baseText,
      status,
    };
  }
  return fields;
}

function stripContentFromConfig(args: {
  widgetType: string;
  config: Record<string, unknown>;
}): Record<string, unknown> {
  const widgetDefinition = getWidgetDefinition(args.widgetType);
  if (!widgetDefinition?.editableFields) return structuredClone(args.config);
  const next = structuredClone(args.config);
  for (const item of extractSavedTextFieldsForEditableFields({
    contract: widgetDefinition.editableFields,
    config: args.config,
  })) {
    deleteExistingPath(next, item.path);
  }
  return next;
}

function composeConfigWithContent(args: {
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument | null;
}): Record<string, unknown> {
  const next = structuredClone(args.config);
  if (!args.content) return next;
  for (const [path, field] of Object.entries(args.content.fields)) {
    setValueAtPath(next, path, field.value);
  }
  return next;
}

function resolveBaseLocale(meta: Record<string, unknown> | null, existing?: AccountInstanceConfigDocument | null): string {
  if (hasOwnRecordValue(meta, 'baseLocale')) {
    const fromMeta = normalizeLocale(meta?.baseLocale);
    if (!fromMeta) throw new Error('coreui.errors.instance.invalidPayload');
    return fromMeta;
  }
  return existing?.baseLocale ?? 'en';
}

function resolveTargetLocales(meta: Record<string, unknown> | null, existing?: AccountInstanceConfigDocument | null): string[] {
  if (hasOwnRecordValue(meta, 'targetLocales')) {
    const fromMeta = normalizeLocaleArrayStrict(meta?.targetLocales);
    if (!fromMeta) throw new Error('coreui.errors.instance.invalidPayload');
    return fromMeta;
  }
  return existing?.targetLocales ?? [];
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
    publishStatus: args.publishStatus,
    updatedAt: args.updatedAt,
  };
}

function instanceFromConfigAndContent(args: {
  configDoc: AccountInstanceConfigDocument;
  fullConfig: Record<string, unknown>;
}): AccountInstanceDocument {
  return {
    v: 1,
    id: args.configDoc.id,
    accountId: args.configDoc.accountId,
    widgetCode: args.configDoc.widgetCode,
    widgetType: args.configDoc.widgetType,
    displayName: args.configDoc.displayName,
    meta: args.configDoc.meta ?? null,
    config: args.fullConfig,
    baseLocale: args.configDoc.baseLocale,
    targetLocales: args.configDoc.targetLocales,
    publishStatus: 'unpublished',
    createdAt: args.configDoc.createdAt,
    updatedAt: args.configDoc.updatedAt,
  };
}

function contentDocumentFromConfig(args: {
  instanceId: string;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  previous?: AccountInstanceContentDocument | null;
  updatedAt: string;
  initialStatus: 'ok' | 'changed';
}): AccountInstanceContentDocument {
  return {
    id: args.instanceId,
    accountId: args.accountId,
    widgetType: args.widgetType,
    fields: extractContentFields({
      widgetType: args.widgetType,
      config: args.config,
      previous: args.previous,
      initialStatus: args.initialStatus,
    }),
    updatedAt: args.updatedAt,
  };
}

async function remapLocaleOverlaysForSavedContent(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  configDoc: AccountInstanceConfigDocument;
  previous: AccountInstanceContentDocument | null;
  next: AccountInstanceContentDocument;
}): Promise<void> {
  if (!args.previous) return;
  const previousByIdentity = new Map(
    Object.entries(args.previous.fields)
      .filter(([, field]) => typeof field.identityKey === 'string' && field.identityKey)
      .map(([path, field]) => [field.identityKey as string, { path, field }]),
  );
  const previousByPath = new Map(Object.entries(args.previous.fields).map(([path, field]) => [path, { path, field }]));
  const metadata = await buildCurrentLocaleOverlayMetadata({ configDoc: args.configDoc, content: args.next });
  for (const overlay of await listLocaleOverlays({
    env: args.env,
    accountId: args.accountId,
    widgetCode: args.widgetCode,
    instanceId: args.instanceId,
  })) {
    const values: Record<string, string> = {};
    for (const [path, field] of Object.entries(args.next.fields)) {
      const previous =
        field.identityKey
          ? previousByIdentity.get(field.identityKey)
          : previousByPath.get(path);
      if (!previous || previous.field.value !== field.value) continue;
      const translated = overlay.values[previous.path];
      if (typeof translated === 'string') values[path] = translated;
    }
    const complete = Object.keys(args.next.fields).every((path) => typeof values[path] === 'string');
    await writeLocaleOverlay({
      env: args.env,
      accountId: args.accountId,
      widgetCode: args.widgetCode,
      instanceId: args.instanceId,
      overlay: {
        ...overlay,
        baseContentMarker: metadata.baseContentMarker,
        widgetContractHash: metadata.widgetContractHash,
        status: complete && overlay.status !== 'failed' ? 'inSync' : 'outOfSync',
        values,
        updatedAt: args.configDoc.updatedAt,
      },
    });
  }
}

export async function readConfigDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<AccountInstanceConfigDocument | null> {
  return normalizeAccountInstanceConfigDocument(
    await loadJson(args.env, accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId)),
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
    await loadJson(args.env, accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId)),
  );
  return configDoc
    ? summaryFromConfigDocument({
        configDoc,
        publishStatus: args.publishStatus,
        updatedAt: args.editedAt,
      })
    : null;
}

async function readComposedInstanceByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<AccountInstanceDocument | null> {
  const configDoc = await readConfigDocumentByLocation(args);
  if (!configDoc) return null;
  const contentDoc = await readContentDocumentByLocation({ ...args, configDoc });
  const fullConfig = composeConfigWithContent({
    config: configDoc.config,
    content: contentDoc,
  });
  return instanceFromConfigAndContent({
    configDoc,
    fullConfig,
  });
}

export async function writeAccountInstanceSource(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: unknown;
  meta?: unknown;
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
  const targetLocales = resolveTargetLocales(meta, existingConfig);
  const previousContent = await readContentDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode,
    instanceId,
    configDoc: existingConfig,
  });
  const content = contentDocumentFromConfig({
    instanceId,
    accountId,
    widgetType,
    config: args.config,
    previous: previousContent,
    updatedAt: now,
    initialStatus: existingConfig ? 'changed' : 'ok',
  });
  const configDoc: AccountInstanceConfigDocument = {
    id: instanceId,
    accountId,
    widgetCode,
    widgetType,
    displayName: normalizeDisplayName(args.displayName),
    meta,
    config: stripContentFromConfig({
      widgetType,
      config: args.config,
    }),
    baseLocale,
    targetLocales,
    createdAt: existingConfig?.createdAt ?? now,
    updatedAt: now,
  };
  if (previousContent) {
    await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  }
  const registry = await readInstanceRegistryRow({ env: args.env, accountId, instanceId });
  await putJson(args.env, accountInstanceConfigKey(accountId, widgetCode, instanceId), configDoc);
  await putJson(args.env, accountInstanceContentKey(accountId, widgetCode, instanceId), content);
  await remapLocaleOverlaysForSavedContent({
    env: args.env,
    accountId,
    widgetCode,
    instanceId,
    configDoc,
    previous: previousContent,
    next: content,
  });
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
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
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
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  const instance = await readComposedInstanceByLocation({
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
}): Promise<{ ok: true; value: AccountInstanceContentDocument } | AccountInstanceSourceReadFailure> {
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
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
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
  if (!instanceId || !accountId || !displayName) throw new Error('coreui.errors.instance.invalidPayload');
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
  await putJson(args.env, accountInstanceConfigKey(location.accountId, location.widgetCode, location.instanceId), {
    ...configDoc,
    displayName,
    updatedAt,
  } satisfies AccountInstanceConfigDocument);
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
  const instance = await readComposedInstanceByLocation({
    env: args.env,
    accountId: pointer.accountId,
    widgetCode: pointer.widgetCode,
    instanceId: pointer.id,
  });
  if (!instance || !instance.config || typeof instance.config !== 'object' || Array.isArray(instance.config)) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.config.invalid' };
  }
  return { ok: true, value: { pointer, config: instance.config } };
}

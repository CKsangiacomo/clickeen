import type { Env } from '../../types';
import { normalizeLocale } from '../../asset-utils';
import {
  accountInstanceConfigKey,
  accountInstanceContentKey,
  accountInstanceDocumentKey,
} from './keys';
import {
  createInstanceRegistryRow,
  listInstanceRegistryRows,
  readInstanceRegistryRow,
  resolveAccountInstanceLocation,
  updateInstanceRegistryEditedAt,
  updateInstanceRegistryPublishStatus,
} from './instance-registry';
import {
  normalizeAccountInstanceConfigDocument,
  normalizeAccountInstanceContentDocument,
  normalizeAccountInstanceDocument,
  normalizeSavedRenderPointer,
} from './normalize';
import { loadJson, loadJsonObject, putJson, putJsonIfUnchanged } from './storage';
import { getWidgetDefinition, resolveWidgetCode } from '../widget-catalog';
import { extractTextPrimitiveValuesForEditableFields } from '@clickeen/ck-contracts/overlay-primitives';
import type {
  AccountInstanceConfigDocument,
  AccountInstanceContentDocument,
  AccountInstanceDocument,
  AccountInstanceSummary,
  InstanceServeState,
  SavedRenderDocumentReadFailure,
  SavedRenderDocumentReadResult,
  SavedRenderPointer,
} from './types';
import { normalizeStorageId } from './utils';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeDisplayName(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

function normalizeMeta(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeTranslatedValueMap(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const values: Record<string, string> = {};
  for (const [path, text] of Object.entries(value)) {
    if (!path || typeof text !== 'string') return null;
    values[path] = text;
  }
  return values;
}

function assertTranslatedValuesMatchContent(args: {
  content: AccountInstanceContentDocument;
  values: Record<string, string>;
}): void {
  const contentPaths = new Set(Object.keys(args.content.fields));
  for (const path of contentPaths) {
    if (typeof args.values[path] !== 'string') {
      throw new Error(`tokyo.translation.value_missing:${path}`);
    }
  }
  for (const path of Object.keys(args.values)) {
    if (!contentPaths.has(path)) {
      throw new Error(`tokyo.translation.value_unexpected:${path}`);
    }
  }
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

function summaryFromConfigDocument(configDoc: AccountInstanceConfigDocument): AccountInstanceSummary {
  return {
    accountId: configDoc.accountId,
    instanceId: configDoc.id,
    widgetCode: configDoc.widgetCode,
    widgetType: configDoc.widgetType,
    displayName: displayNameFromConfigDocument(configDoc),
    publishStatus: configDoc.publishStatus,
    updatedAt: configDoc.updatedAt,
  };
}

function normalizeLocaleArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => normalizeLocale(entry)).filter((entry): entry is string => Boolean(entry))));
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
  for (const item of extractTextPrimitiveValuesForEditableFields({
    contract: widgetDefinition.editableFields,
    config: args.config,
  })) {
    const previous = args.previous?.fields[item.path];
    const sameValue = previous && previous.value === item.value;
    const status =
      sameValue
        ? previous.status
        : args.previous
          ? 'changed'
          : args.initialStatus;
    fields[item.path] = {
      value: item.value,
      status,
      ...(sameValue && previous?.localeStatus ? { localeStatus: { ...previous.localeStatus } } : {}),
      ...(sameValue && previous?.translatedValues ? { translatedValues: { ...previous.translatedValues } } : {}),
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
  for (const item of extractTextPrimitiveValuesForEditableFields({
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

function resolveBaseLocale(meta: Record<string, unknown> | null, existing?: AccountInstanceDocument | null): string {
  const fromMeta = normalizeLocale(meta?.baseLocale);
  return fromMeta ?? existing?.baseLocale ?? 'en';
}

function resolveTargetLocales(meta: Record<string, unknown> | null, existing?: AccountInstanceDocument | null): string[] {
  const fromMeta = normalizeLocaleArray(meta?.targetLocales);
  return fromMeta.length > 0 ? fromMeta : existing?.targetLocales ?? [];
}

function resolveEmbedBuildShape(args: {
  baseLocale: string;
  targetLocales: string[];
  existing?: AccountInstanceDocument | null;
}): AccountInstanceDocument['embedBuildShape'] {
  const locales = Array.from(new Set([args.baseLocale, ...args.targetLocales]));
  return {
    rendering: args.existing?.embedBuildShape.rendering ?? 'html',
    seoMode: args.existing?.embedBuildShape.seoMode ?? 'off',
    locales,
    clientSide: args.existing?.embedBuildShape.clientSide ?? 'minimal-js',
  };
}

function toSavedPointer(instance: AccountInstanceDocument): SavedRenderPointer {
  return {
    v: 1,
    id: instance.id,
    accountId: instance.accountId,
    widgetCode: instance.widgetCode,
    widgetType: instance.widgetType,
    displayName: instance.displayName,
    meta: instance.meta ?? null,
    publishStatus: instance.publishStatus,
    updatedAt: instance.updatedAt,
  };
}

function legacyInstanceFromConfig(args: {
  configDoc: AccountInstanceConfigDocument;
  fullConfig: Record<string, unknown>;
}): AccountInstanceDocument {
  return {
    v: 1,
    id: args.configDoc.id,
    accountId: args.configDoc.accountId,
    accountPublicId: args.configDoc.accountPublicId,
    widgetCode: args.configDoc.widgetCode,
    widgetType: args.configDoc.widgetType,
    displayName: args.configDoc.displayName,
    meta: args.configDoc.meta ?? null,
    config: args.fullConfig,
    baseLocale: args.configDoc.baseLocale,
    targetLocales: args.configDoc.targetLocales,
    embedBuildShape: args.configDoc.embedBuildShape,
    publishStatus: args.configDoc.publishStatus,
    createdAt: args.configDoc.createdAt,
    updatedAt: args.configDoc.updatedAt,
  };
}

function configDocumentFromInstance(instance: AccountInstanceDocument): AccountInstanceConfigDocument {
  return {
    id: instance.id,
    accountId: instance.accountId,
    accountPublicId: instance.accountPublicId,
    widgetCode: instance.widgetCode,
    widgetType: instance.widgetType,
    displayName: instance.displayName,
    meta: instance.meta ?? null,
    config: stripContentFromConfig({
      widgetType: instance.widgetType,
      config: instance.config,
    }),
    baseLocale: instance.baseLocale,
    targetLocales: instance.targetLocales,
    embedBuildShape: instance.embedBuildShape,
    publishStatus: instance.publishStatus,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
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

async function readConfigDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<AccountInstanceConfigDocument | null> {
  const configDoc = normalizeAccountInstanceConfigDocument(
    await loadJson(args.env, accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId)),
  );
  if (configDoc) return configDoc;
  const legacy = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(args.accountId, args.widgetCode, args.instanceId)),
  );
  return legacy ? configDocumentFromInstance(legacy) : null;
}

async function readContentDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  configDoc?: AccountInstanceConfigDocument | null;
}): Promise<AccountInstanceContentDocument | null> {
  const contentDoc = normalizeAccountInstanceContentDocument(
    await loadJson(args.env, accountInstanceContentKey(args.accountId, args.widgetCode, args.instanceId)),
  );
  if (contentDoc) return contentDoc;
  const legacy = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(args.accountId, args.widgetCode, args.instanceId)),
  );
  if (legacy) {
    return contentDocumentFromConfig({
      instanceId: legacy.id,
      accountId: legacy.accountId,
      widgetType: legacy.widgetType,
      config: legacy.config,
      updatedAt: legacy.updatedAt,
      initialStatus: 'ok',
    });
  }
  const configDoc = args.configDoc ?? null;
  if (!configDoc) return null;
  return {
    id: configDoc.id,
    accountId: configDoc.accountId,
    widgetType: configDoc.widgetType,
    fields: {},
    updatedAt: configDoc.updatedAt,
  };
}

async function updateContentDocumentByLocation(args: {
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
    ? {
        ...summaryFromConfigDocument(configDoc),
        publishStatus: args.publishStatus,
        updatedAt: args.editedAt,
      }
    : null;
}

async function readComposedInstanceByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<AccountInstanceDocument | null> {
  const legacy = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(args.accountId, args.widgetCode, args.instanceId)),
  );
  const configDoc = await readConfigDocumentByLocation(args);
  if (!configDoc) return legacy;
  const contentDoc = await readContentDocumentByLocation({ ...args, configDoc });
  const fullConfig = composeConfigWithContent({
    config: configDoc.config,
    content: contentDoc,
  });
  return legacyInstanceFromConfig({
    configDoc,
    fullConfig,
  });
}

export async function writeSavedRenderConfig(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: unknown;
  meta?: unknown;
}): Promise<{ pointer: SavedRenderPointer }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!instanceId || !accountId || !widgetType) {
    throw new Error('tokyo.errors.render.invalid');
  }
  const widgetCode = resolveWidgetCode(widgetType);
  if (!widgetCode) {
    throw new Error('tokyo.errors.widget.unsupported');
  }

  const now = nowIso();
  const existing = await readComposedInstanceByLocation({
    env: args.env,
    accountId,
    widgetCode,
    instanceId,
  });
  const meta = normalizeMeta(args.meta);
  const baseLocale = resolveBaseLocale(meta, existing);
  const targetLocales = resolveTargetLocales(meta, existing);
  const previousContent = await readContentDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode,
    instanceId,
  });
  const content = contentDocumentFromConfig({
    instanceId,
    accountId,
    widgetType,
    config: args.config,
    previous: previousContent,
    updatedAt: now,
    initialStatus: existing ? 'changed' : 'ok',
  });
  const configDoc: AccountInstanceConfigDocument = {
    id: instanceId,
    accountId,
    accountPublicId: accountId,
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
    embedBuildShape: resolveEmbedBuildShape({ baseLocale, targetLocales, existing }),
    publishStatus: existing?.publishStatus ?? 'unpublished',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const instance: AccountInstanceDocument = {
    v: 1,
    id: instanceId,
    accountId,
    accountPublicId: accountId,
    widgetCode,
    widgetType,
    displayName: configDoc.displayName,
    meta,
    config: args.config,
    baseLocale,
    targetLocales,
    embedBuildShape: configDoc.embedBuildShape,
    publishStatus: configDoc.publishStatus,
    createdAt: configDoc.createdAt,
    updatedAt: now,
  };

  await putJson(args.env, accountInstanceConfigKey(accountId, widgetCode, instanceId), configDoc);
  await putJson(args.env, accountInstanceContentKey(accountId, widgetCode, instanceId), content);
  await putJson(args.env, accountInstanceDocumentKey(accountId, widgetCode, instanceId), instance);
  const registry = await readInstanceRegistryRow({ env: args.env, accountId, instanceId });
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
      publishStatus: configDoc.publishStatus,
      translationStatus: 'idle',
      createdAt: configDoc.createdAt,
      editedAt: now,
    });
  }
  return {
    pointer: toSavedPointer(instance),
  };
}

export async function readSavedRenderPointer(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<{ ok: true; value: SavedRenderPointer } | SavedRenderDocumentReadFailure> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' };
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
  const instance = await readComposedInstanceByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const pointer = instance ? normalizeSavedRenderPointer(instance) : null;
  if (!pointer) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.config.invalid' };
  }
  if (pointer.id !== instanceId || pointer.accountId !== accountId) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
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
}): Promise<{ ok: true; value: AccountInstanceDocument } | SavedRenderDocumentReadFailure> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' };
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
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
}): Promise<{ ok: true; value: AccountInstanceContentDocument } | SavedRenderDocumentReadFailure> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' };
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
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

export async function readAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
}): Promise<{ ok: true; value: { locale: string; values: Record<string, string> } } | SavedRenderDocumentReadFailure> {
  const locale = normalizeLocale(args.locale);
  if (!locale) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.translation.locale.invalid' };
  }
  const content = await readAccountInstanceContentDocument(args);
  if (!content.ok) return content;
  const values: Record<string, string> = {};
  for (const [path, field] of Object.entries(content.value.fields)) {
    if (field.localeStatus?.[locale] !== 'ok') {
      return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' };
    }
    const translated = field.translatedValues?.[locale];
    if (typeof translated !== 'string') {
      return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' };
    }
    values[path] = translated;
  }
  return { ok: true, value: { locale, values } };
}

export async function readAccountInstanceCurrentTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
}): Promise<{ ok: true; value: { locale: string; values: Record<string, string> } } | SavedRenderDocumentReadFailure> {
  const locale = normalizeLocale(args.locale);
  if (!locale) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.translation.locale.invalid' };
  }
  const content = await readAccountInstanceContentDocument(args);
  if (!content.ok) return content;
  const values: Record<string, string> = {};
  for (const [path, field] of Object.entries(content.value.fields)) {
    const translated = field.translatedValues?.[locale];
    if (typeof translated === 'string') values[path] = translated;
  }
  return { ok: true, value: { locale, values } };
}

export async function writeAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
  values: unknown;
}): Promise<{ locale: string; values: Record<string, string> }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const locale = normalizeLocale(args.locale);
  const values = normalizeTranslatedValueMap(args.values);
  if (!instanceId || !accountId || !locale || !values) {
    throw new Error('tokyo.translation.values_invalid');
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('tokyo.errors.render.notFound');
  await updateContentDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    update(content) {
      assertTranslatedValuesMatchContent({ content, values });
      const next: AccountInstanceContentDocument = {
        ...content,
        fields: { ...content.fields },
        updatedAt: nowIso(),
      };
      for (const [path, field] of Object.entries(content.fields)) {
        next.fields[path] = {
          ...field,
          localeStatus: {
            ...(field.localeStatus ?? {}),
            [locale]: 'ok',
          },
          translatedValues: {
            ...(field.translatedValues ?? {}),
            [locale]: values[path]!,
          },
        };
      }
      return next;
    },
  });
  return { locale, values };
}

export async function completeAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
  targetLocales: string[];
  paths: string[];
  values: unknown;
}): Promise<{ locale: string; values: Record<string, string> }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const locale = normalizeLocale(args.locale);
  const values = normalizeTranslatedValueMap(args.values);
  if (!instanceId || !accountId || !locale || !values) {
    throw new Error('tokyo.translation.values_invalid');
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('tokyo.errors.render.notFound');
  const targetLocales = Array.from(new Set(args.targetLocales.map((entry) => normalizeLocale(entry)).filter((entry): entry is string => Boolean(entry))));
  const changedPaths = new Set(args.paths);
  await updateContentDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    update(content) {
      assertTranslatedValuesMatchContent({ content, values });
      const next: AccountInstanceContentDocument = {
        ...content,
        fields: { ...content.fields },
        updatedAt: nowIso(),
      };
      for (const [path, field] of Object.entries(content.fields)) {
        const localeStatus = {
          ...(field.localeStatus ?? {}),
          [locale]: 'ok' as const,
        };
        const translatedValues = {
          ...(field.translatedValues ?? {}),
          [locale]: values[path]!,
        };
        const allTargetsOk =
          targetLocales.length === 0 ||
          targetLocales.every((targetLocale) => (
            localeStatus[targetLocale] === 'ok' &&
            typeof translatedValues[targetLocale] === 'string'
          ));
        next.fields[path] = {
          ...field,
          localeStatus,
          translatedValues,
          status: changedPaths.has(path) && allTargetsOk ? 'ok' : field.status,
        };
      }
      return next;
    },
  });
  return { locale, values };
}

export async function listAccountInstances(args: {
  env: Env;
  accountId: string;
}): Promise<AccountInstanceSummary[]> {
  const accountId = normalizeStorageId(args.accountId);
  if (!accountId) throw new Error('tokyo.errors.render.invalid');
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
  if (!instanceId || !accountId || !displayName) throw new Error('tokyo.errors.render.invalid');
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('tokyo.errors.render.notFound');
  const instance = await readComposedInstanceByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  if (!instance || !configDoc) throw new Error('coreui.errors.instance.config.invalid');
  const updatedAt = nowIso();
  await putJson(args.env, accountInstanceConfigKey(location.accountId, location.widgetCode, location.instanceId), {
    ...configDoc,
    displayName,
    updatedAt,
  } satisfies AccountInstanceConfigDocument);
  await putJson(args.env, accountInstanceDocumentKey(location.accountId, location.widgetCode, location.instanceId), {
    ...instance,
    displayName,
    updatedAt,
  } satisfies AccountInstanceDocument);
  await updateInstanceRegistryEditedAt({
    env: args.env,
    accountId: location.accountId,
    instanceId: location.instanceId,
    editedAt: updatedAt,
  });
  return { instanceId: location.instanceId, displayName, updatedAt };
}

export async function readSavedRenderConfig(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<SavedRenderDocumentReadResult> {
  const pointerResult = await readSavedRenderPointer(args);
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

export async function readInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType?: string | null;
}): Promise<InstanceServeState> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) throw new Error('tokyo.errors.render.invalid');
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return 'unpublished';
  return location.publishStatus;
}

export async function writeInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  status: InstanceServeState;
  widgetType?: string | null;
}): Promise<{ changed: boolean }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) throw new Error('tokyo.errors.render.invalid');
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('tokyo.errors.render.notFound');
  const changed = location.publishStatus !== args.status;
  await updateInstanceRegistryPublishStatus({
    env: args.env,
    accountId: location.accountId,
    instanceId: location.instanceId,
    publishStatus: args.status,
  });
  return { changed };
}

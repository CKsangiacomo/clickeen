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
} from './instance-registry';
import {
  normalizeAccountInstanceConfigDocument,
  normalizeAccountInstanceContentDocument,
} from './normalize';
import { loadJson, loadJsonObject, putJson, putJsonIfUnchanged } from './storage';
import { getWidgetDefinition, resolveWidgetCode } from '../widget-catalog';
import {
  extractSavedTextFieldsForEditableFields,
  extractTextPrimitiveValuesForEditableFields,
} from '@clickeen/ck-contracts/translated-value-primitives';
import {
  assertLocaleOverlayValuesMatchContent,
  listLocaleOverlays,
  localeOverlayHasCompleteValues,
  readLocaleOverlay,
  writeLocaleOverlay,
} from './locale-overlays';
import { buildBaseContentMarkerForContent, buildWidgetContractMarker } from './translation-markers';
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

async function resolveWidgetContractHash(widgetType: string): Promise<string> {
  const widgetDefinition = getWidgetDefinition(widgetType);
  if (!widgetDefinition?.editableFields || widgetDefinition.editableFields.widgetType !== widgetType) {
    throw new Error(`tokyo.translation.widget_unsupported:${widgetType}`);
  }
  return buildWidgetContractMarker(widgetDefinition.editableFields);
}

async function buildCurrentLocaleOverlayMetadata(args: {
  configDoc: AccountInstanceConfigDocument;
  content: AccountInstanceContentDocument;
}): Promise<{
  baseContentMarker: string;
  widgetContractHash: string;
}> {
  const widgetContractHash = await resolveWidgetContractHash(args.configDoc.widgetType);
  return {
    baseContentMarker: await buildBaseContentMarkerForContent({
      baseLocale: args.configDoc.baseLocale,
      widgetType: args.configDoc.widgetType,
      widgetContractHash,
      content: args.content,
    }),
    widgetContractHash,
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

function toSavedPointer(args: {
  configDoc: AccountInstanceConfigDocument;
  publishStatus: InstanceServeState;
  updatedAt: string;
}): SavedRenderPointer {
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
    accountPublicId: args.configDoc.accountPublicId,
    widgetCode: args.configDoc.widgetCode,
    widgetType: args.configDoc.widgetType,
    displayName: args.configDoc.displayName,
    meta: args.configDoc.meta ?? null,
    config: args.fullConfig,
    baseLocale: args.configDoc.baseLocale,
    targetLocales: args.configDoc.targetLocales,
    embedBuildShape: args.configDoc.embedBuildShape,
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

async function readConfigDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<AccountInstanceConfigDocument | null> {
  return normalizeAccountInstanceConfigDocument(
    await loadJson(args.env, accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId)),
  );
}

function hasLegacyEmbeddedTranslationStorage(raw: unknown): boolean {
  const payload = isRecord(raw) ? raw : null;
  const fields = isRecord(payload?.fields) ? payload.fields : null;
  if (isRecord(payload?.localeSync)) return true;
  if (!fields) return false;
  return Object.values(fields).some((field) => (
    isRecord(field) &&
    (isRecord(field.localeStatus) || isRecord(field.translatedValues))
  ));
}

function extractLegacyEmbeddedTranslatedValues(args: {
  raw: unknown;
  content: AccountInstanceContentDocument;
  configDoc: AccountInstanceConfigDocument;
  baseContentMarker: string;
  widgetContractHash: string;
}): Array<{ locale: string; values: Record<string, string> }> {
  const payload = isRecord(args.raw) ? args.raw : null;
  const rawFields = isRecord(payload?.fields) ? payload.fields : null;
  if (!rawFields) return [];
  const rawLocaleSync = isRecord(payload?.localeSync) ? payload.localeSync : null;
  const targetLocales = Array.from(new Set(args.configDoc.targetLocales
    .map((entry) => normalizeLocale(entry))
    .filter((entry): entry is string => Boolean(entry))));
  const migrated: Array<{ locale: string; values: Record<string, string> }> = [];
  for (const locale of targetLocales) {
    const sync = isRecord(rawLocaleSync?.[locale]) ? rawLocaleSync[locale] : null;
    if (
      sync &&
      (
        sync.status !== 'inSync' ||
        sync.baseContentMarker !== args.baseContentMarker ||
        sync.widgetContractHash !== args.widgetContractHash
      )
    ) {
      continue;
    }
    const values: Record<string, string> = {};
    let complete = true;
    for (const path of Object.keys(args.content.fields)) {
      const rawField = isRecord(rawFields[path]) ? rawFields[path] : null;
      const translatedValues = isRecord(rawField?.translatedValues) ? rawField.translatedValues : null;
      const localeStatus = isRecord(rawField?.localeStatus) ? rawField.localeStatus : null;
      const translated = translatedValues?.[locale];
      const status = localeStatus?.[locale];
      if (typeof translated !== 'string' || (typeof status === 'string' && status !== 'ok')) {
        complete = false;
        break;
      }
      values[path] = translated;
    }
    if (complete && Object.keys(values).length === Object.keys(args.content.fields).length) {
      migrated.push({ locale, values });
    }
  }
  return migrated;
}

async function migrateLegacyEmbeddedTranslationsToOverlays(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  configDoc: AccountInstanceConfigDocument;
}): Promise<AccountInstanceContentDocument | null> {
  const key = accountInstanceContentKey(args.accountId, args.widgetCode, args.instanceId);
  const loaded = await loadJsonObject<unknown>(args.env, key);
  const content = loaded ? normalizeAccountInstanceContentDocument(loaded.value) : null;
  if (!loaded || !content) return content;
  if (!hasLegacyEmbeddedTranslationStorage(loaded.value)) return content;
  const metadata = await buildCurrentLocaleOverlayMetadata({ configDoc: args.configDoc, content });
  const legacyLocales = extractLegacyEmbeddedTranslatedValues({
    raw: loaded.value,
    content,
    configDoc: args.configDoc,
    baseContentMarker: metadata.baseContentMarker,
    widgetContractHash: metadata.widgetContractHash,
  });
  for (const legacyLocale of legacyLocales) {
    const existing = await readLocaleOverlay({
      env: args.env,
      accountId: args.accountId,
      widgetCode: args.widgetCode,
      instanceId: args.instanceId,
      locale: legacyLocale.locale,
    });
    if (existing) continue;
    await writeLocaleOverlay({
      env: args.env,
      accountId: args.accountId,
      widgetCode: args.widgetCode,
      instanceId: args.instanceId,
      overlay: {
        v: 1,
        locale: legacyLocale.locale,
        baseContentMarker: metadata.baseContentMarker,
        widgetContractHash: metadata.widgetContractHash,
        status: 'inSync',
        values: legacyLocale.values,
        updatedAt: content.updatedAt,
      },
    });
  }
  await putJsonIfUnchanged(args.env, key, content, loaded.httpEtag);
  return content;
}

async function readContentDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  configDoc?: AccountInstanceConfigDocument | null;
}): Promise<AccountInstanceContentDocument | null> {
  const configDoc = args.configDoc ?? null;
  if (configDoc) {
    const migrated = await migrateLegacyEmbeddedTranslationsToOverlays({
      env: args.env,
      accountId: args.accountId,
      widgetCode: args.widgetCode,
      instanceId: args.instanceId,
      configDoc,
    });
    if (migrated) return migrated;
  }
  const contentDoc = normalizeAccountInstanceContentDocument(
    await loadJson(args.env, accountInstanceContentKey(args.accountId, args.widgetCode, args.instanceId)),
  );
  if (contentDoc) return contentDoc;
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
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
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
      publishStatus: 'unpublished',
      translationStatus: 'idle',
      createdAt: configDoc.createdAt,
      editedAt: now,
    });
  }
  return {
    pointer: toSavedPointer({
      configDoc,
      publishStatus: registry?.publishStatus ?? 'unpublished',
      updatedAt: now,
    }),
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
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  if (!configDoc) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.config.invalid' };
  }
  const pointer = toSavedPointer({
    configDoc,
    publishStatus: location.publishStatus,
    updatedAt: location.editedAt,
  });
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
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.content.invalid' };
  const overlay = await readLocaleOverlay({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    locale,
  });
  const current = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  if (
    !overlay ||
    overlay.status !== 'inSync' ||
    overlay.baseContentMarker !== current.baseContentMarker ||
    overlay.widgetContractHash !== current.widgetContractHash ||
    !localeOverlayHasCompleteValues({ content, overlay })
  ) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' };
  }
  const values: Record<string, string> = {};
  for (const path of Object.keys(content.fields)) {
    values[path] = overlay.values[path]!;
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
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.content.invalid' };
  const overlay = await readLocaleOverlay({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    locale,
  });
  const values: Record<string, string> = {};
  for (const path of Object.keys(content.fields)) {
    const translated = overlay?.values[path];
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
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) throw new Error('coreui.errors.instance.content.invalid');
  assertLocaleOverlayValuesMatchContent({ content, values });
  const metadata = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  await writeLocaleOverlay({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    overlay: {
      v: 1,
      locale,
      baseContentMarker: metadata.baseContentMarker,
      widgetContractHash: metadata.widgetContractHash,
      status: 'inSync',
      values,
      updatedAt: nowIso(),
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
  baseContentMarker?: string;
  widgetContractHash?: string;
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
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) throw new Error('coreui.errors.instance.content.invalid');
  assertLocaleOverlayValuesMatchContent({ content, values });
  const currentMetadata = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  const updatedAt = nowIso();
  await writeLocaleOverlay({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    overlay: {
      v: 1,
      locale,
      baseContentMarker: args.baseContentMarker ?? currentMetadata.baseContentMarker,
      widgetContractHash: args.widgetContractHash ?? currentMetadata.widgetContractHash,
      status: 'inSync',
      values,
      updatedAt,
    },
  });
  const targetOverlayByLocale = new Map((await listLocaleOverlays({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  })).map((overlay) => [overlay.locale, overlay]));
  await updateContentDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    update(currentContent) {
      const next: AccountInstanceContentDocument = {
        ...currentContent,
        fields: { ...currentContent.fields },
        updatedAt,
      };
      for (const [path, field] of Object.entries(currentContent.fields)) {
        const allTargetsOk =
          targetLocales.length === 0 ||
          targetLocales.every((targetLocale) => (
            targetOverlayByLocale.get(targetLocale)?.status === 'inSync' &&
            targetOverlayByLocale.get(targetLocale)?.baseContentMarker === currentMetadata.baseContentMarker &&
            targetOverlayByLocale.get(targetLocale)?.widgetContractHash === currentMetadata.widgetContractHash &&
            typeof targetOverlayByLocale.get(targetLocale)?.values[path] === 'string'
          ));
        next.fields[path] = {
          ...field,
          status: changedPaths.has(path) && allTargetsOk ? 'ok' : field.status,
        };
      }
      return next;
    },
  });
  return { locale, values };
}

export async function listAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<Array<{ locale: string }>> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) return [];
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return [];
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) return [];
  const current = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  return (await listLocaleOverlays({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  }))
    .filter((overlay) => (
      overlay.status === 'inSync' &&
      overlay.baseContentMarker === current.baseContentMarker &&
      overlay.widgetContractHash === current.widgetContractHash &&
      localeOverlayHasCompleteValues({ content, overlay })
    ))
    .map((overlay) => ({ locale: overlay.locale }));
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

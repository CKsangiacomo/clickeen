import type { Env } from '../../types';
import { normalizeLocale } from '../../asset-utils';
import {
  accountInstanceConfigKey,
  accountInstanceContentKey,
  accountInstanceDocumentKey,
  accountInstancesRoot,
} from './keys';
import { patchAccountInstanceIndexEntry, resolveAccountInstanceLocation } from './instance-index';
import {
  normalizeAccountInstanceConfigDocument,
  normalizeAccountInstanceContentDocument,
  normalizeAccountInstanceDocument,
  normalizeSavedRenderPointer,
} from './normalize';
import { loadJson, putJson } from './storage';
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

function displayNameFromInstance(instance: AccountInstanceDocument): string {
  const displayName = normalizeDisplayName(instance.displayName);
  if (displayName) return displayName;
  const meta = instance.meta && typeof instance.meta === 'object' && !Array.isArray(instance.meta) ? instance.meta : null;
  return (
    normalizeDisplayName(meta?.styleName) ??
    normalizeDisplayName(meta?.name) ??
    normalizeDisplayName(meta?.title) ??
    instance.id
  );
}

function summaryFromInstance(instance: AccountInstanceDocument): AccountInstanceSummary {
  return {
    accountId: instance.accountId,
    instanceId: instance.id,
    widgetCode: instance.widgetCode,
    widgetType: instance.widgetType,
    displayName: displayNameFromInstance(instance),
    publishStatus: instance.publishStatus,
    updatedAt: instance.updatedAt,
  };
}

function sortAccountInstanceSummaries(entries: AccountInstanceSummary[]): AccountInstanceSummary[] {
  return [...entries].sort((left, right) => {
    const byWidget = left.widgetType.localeCompare(right.widgetType);
    if (byWidget !== 0) return byWidget;
    const byUpdated = right.updatedAt.localeCompare(left.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return left.instanceId.localeCompare(right.instanceId);
  });
}

function extractInstanceIdFromSourceKey(key: string): string | null {
  const match = key.match(/\/instances\/([^/]+)\/instance\.(?:config\.)?json$/);
  return match ? normalizeStorageId(match[1] || '') : null;
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
  await patchAccountInstanceIndexEntry({ env: args.env, accountId, widgetType, instanceId });
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
  return { ok: true, value: pointer };
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
  return { ok: true, value: instance };
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

export async function listAccountInstancesBySource(args: {
  env: Env;
  accountId: string;
}): Promise<AccountInstanceSummary[]> {
  const accountId = normalizeStorageId(args.accountId);
  if (!accountId) throw new Error('tokyo.errors.render.invalid');
  const prefix = `${accountInstancesRoot(accountId)}/`;
  const instanceIds = new Set<string>();
  let cursor: string | undefined = undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor });
    for (const object of listed.objects) {
      const instanceId = extractInstanceIdFromSourceKey(object.key);
      if (instanceId) instanceIds.add(instanceId);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const summaries: AccountInstanceSummary[] = [];
  for (const instanceId of instanceIds) {
    const instance = await readAccountInstanceDocument({ env: args.env, accountId, instanceId });
    if (!instance.ok) {
      if (instance.kind === 'NOT_FOUND') continue;
      throw new Error(instance.reasonKey);
    }
    summaries.push(summaryFromInstance(instance.value));
  }
  return sortAccountInstanceSummaries(summaries);
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
  await patchAccountInstanceIndexEntry({
    env: args.env,
    accountId: location.accountId,
    widgetType: location.widgetType,
    instanceId: location.instanceId,
  });
  return { instanceId: location.instanceId, displayName, updatedAt };
}

export async function markAccountInstanceContentFieldsTranslated(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
  targetLocales: string[];
  paths: string[];
}): Promise<void> {
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
  const content = await readContentDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  if (!content) throw new Error('coreui.errors.instance.content.invalid');
  const next: AccountInstanceContentDocument = {
    ...content,
    fields: { ...content.fields },
    updatedAt: nowIso(),
  };
  for (const path of args.paths) {
    const field = next.fields[path];
    if (field) {
      const localeStatus = {
        ...(field.localeStatus ?? {}),
        [args.locale]: 'ok' as const,
      };
      const targetLocales = Array.from(new Set(args.targetLocales));
      const allTargetsOk =
        targetLocales.length === 0 ||
        targetLocales.every((targetLocale) => localeStatus[targetLocale] === 'ok');
      next.fields[path] = {
        ...field,
        status: allTargetsOk ? 'ok' : field.status,
        localeStatus,
      };
    }
  }
  await putJson(args.env, accountInstanceContentKey(location.accountId, location.widgetCode, location.instanceId), next);
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
  const instance = await readComposedInstanceByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  return instance?.publishStatus === 'published' ? 'published' : 'unpublished';
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
  const key = accountInstanceDocumentKey(location.accountId, location.widgetCode, location.instanceId);
  const instance = await readComposedInstanceByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  if (!instance) throw new Error('tokyo.errors.instance.documentInvalid');
  const changed = instance.publishStatus !== args.status;
  const now = nowIso();
  const next = { ...instance, publishStatus: args.status, updatedAt: now } satisfies AccountInstanceDocument;
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  if (configDoc) {
    await putJson(args.env, accountInstanceConfigKey(location.accountId, location.widgetCode, location.instanceId), {
      ...configDoc,
      publishStatus: args.status,
      updatedAt: now,
    } satisfies AccountInstanceConfigDocument);
  }
  await putJson(args.env, key, next);
  await patchAccountInstanceIndexEntry({
    env: args.env,
    accountId: location.accountId,
    widgetType: location.widgetType,
    instanceId: location.instanceId,
  });
  return { changed };
}

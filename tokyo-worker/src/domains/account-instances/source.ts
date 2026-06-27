import type { Env } from '../../types';
import { normalizeLocale } from '../../asset-utils';
import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import {
  accountInstanceConfigKey,
  accountInstanceContentKey,
  accountInstancesRoot,
} from './keys';
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
import type {
  AccountInstanceConfigDocument,
  AccountInstanceContentDocument,
  AccountInstanceDocument,
  InstanceServeState,
  AccountInstanceSourceReadFailure,
  AccountInstanceSourceReadResult,
  AccountInstanceSourcePointer,
} from './types';
import { normalizeStorageId } from './utils';
import {
  createInstanceServeState,
  readInstanceServeState,
} from './serve-state';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeDisplayName(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

export function buildLocaleOverlayFields(args: {
  configDoc: AccountInstanceConfigDocument;
  content: AccountInstanceContentDocument;
}): {
  fields: SavedTextField[];
} {
  const widgetDefinition = getWidgetDefinition(args.configDoc.widgetType);
  if (
    !widgetDefinition?.editableFields ||
    widgetDefinition.editableFields.widgetType !== args.configDoc.widgetType
  ) {
    throw new Error(`tokyo.translation.widget_unsupported:${args.configDoc.widgetType}`);
  }
  const fields = savedTextFieldsFromContentDocument(args.content, widgetDefinition.editableFields);
  return { fields };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class AccountInstanceCoordinateError extends Error {
  detail: string;

  constructor(detail: string) {
    super('tokyo.errors.instance.malformedCoordinate');
    this.detail = detail;
  }
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

function toAccountInstanceSourcePointer(args: {
  configDoc: AccountInstanceConfigDocument;
  publishStatus: InstanceServeState;
  updatedAt: string;
}): AccountInstanceSourcePointer {
  const { configDoc } = args;
  return {
        id: configDoc.id,
    accountId: configDoc.accountId,
    widgetCode: configDoc.widgetCode,
    widgetType: configDoc.widgetType,
    displayName: configDoc.displayName,
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
        id: args.configDoc.id,
    accountId: args.configDoc.accountId,
    widgetCode: args.configDoc.widgetCode,
    widgetType: args.configDoc.widgetType,
    displayName: args.configDoc.displayName,
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
  const raw = await loadJson<unknown>(
    args.env,
    accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId),
  );
  if (raw == null) return null;
  const configDoc = normalizeAccountInstanceConfigDocument(raw);
  if (!configDoc) throw new Error('coreui.errors.instance.config.invalid');
  return configDoc;
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
  baseLocale: string;
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
  const baseLocale = normalizeLocale(args.baseLocale);
  if (!baseLocale) throw new Error('coreui.errors.instance.baseLocaleMissing');
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
    config: args.config,
    baseLocale,
    ...(args.publicPackageFingerprint
      ? { publicPackageFingerprint: args.publicPackageFingerprint }
      : {}),
    createdAt: existingConfig?.createdAt ?? now,
    updatedAt: now,
  };
  await putJson(args.env, accountInstanceConfigKey(accountId, widgetCode, instanceId), configDoc);
  await putJson(args.env, accountInstanceContentKey(accountId, widgetCode, instanceId), content);
  if (!existingConfig) {
    await createInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      widgetCode,
      now,
    });
  }
  return {
    pointer: toAccountInstanceSourcePointer({
      configDoc,
      publishStatus: existingConfig
        ? await readInstanceServeState({ env: args.env, accountId, instanceId, widgetCode })
        : 'unpublished',
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
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode: '',
    instanceId,
  });
  if (!configDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const requestedWidgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (requestedWidgetType && configDoc.widgetType !== requestedWidgetType) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const publishStatus = await readInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: configDoc.widgetCode,
  });
  const pointer = toAccountInstanceSourcePointer({
    configDoc,
    publishStatus,
    updatedAt: configDoc.updatedAt,
  });
  if (pointer.id !== instanceId || pointer.accountId !== accountId) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  return {
    ok: true,
    value: {
      ...pointer,
      publishStatus,
      updatedAt: configDoc.updatedAt,
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
  const instance = await readStoredInstanceByLocation({
    env: args.env,
    accountId,
    widgetCode: '',
    instanceId,
  });
  if (!instance || instance.id !== instanceId || instance.accountId !== accountId) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const requestedWidgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (requestedWidgetType && instance.widgetType !== requestedWidgetType) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const publishStatus = await readInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: instance.widgetCode,
  });
  return {
    ok: true,
    value: {
      ...instance,
      publishStatus,
      updatedAt: instance.updatedAt,
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
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode: '',
    instanceId,
  });
  const requestedWidgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!configDoc || (requestedWidgetType && configDoc.widgetType !== requestedWidgetType)) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const contentDoc = await readContentDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode: configDoc.widgetCode,
    instanceId,
    configDoc,
  });
  if (!contentDoc) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.content.invalid' };
  }
  return { ok: true, value: contentDoc };
}

export async function listAccountInstanceIds(args: {
  env: Env;
  accountId: string;
}): Promise<string[]> {
  const accountId = normalizeStorageId(args.accountId);
  if (!accountId) throw new Error('coreui.errors.instance.invalidPayload');
  const prefix = `${accountInstancesRoot(accountId)}/`;
  const instanceIds = new Set<string>();
  let cursor: string | undefined = undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor });
    for (const object of listed.objects) {
      const key = object.key;
      const rest = key.startsWith(prefix) ? key.slice(prefix.length) : '';
      const slashIndex = rest.indexOf('/');
      if (slashIndex <= 0) {
        throw new AccountInstanceCoordinateError(key || prefix);
      }
      const instanceId = rest.slice(0, slashIndex);
      if (!isCompactInstanceId(instanceId)) {
        throw new AccountInstanceCoordinateError(`${prefix}${instanceId}`);
      }
      instanceIds.add(instanceId);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return [...instanceIds].sort();
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
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode: '',
    instanceId,
  });
  if (!configDoc) throw new Error('coreui.errors.instance.config.invalid');
  const requestedWidgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (requestedWidgetType && configDoc.widgetType !== requestedWidgetType) throw new Error('coreui.errors.instance.notFound');
  const updatedAt = nowIso();
  await putJson(
    args.env,
    accountInstanceConfigKey(accountId, configDoc.widgetCode, instanceId),
    {
      ...configDoc,
      displayName,
      updatedAt,
    } satisfies AccountInstanceConfigDocument,
  );
  return { instanceId, displayName, updatedAt };
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

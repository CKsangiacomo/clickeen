import type { Env } from '../../types';
import {
  accountInstanceConfigKey,
  accountInstanceDocumentKey,
  accountInstancePublishKey,
} from './keys';
import { patchAccountInstanceIndexEntry, resolveAccountInstanceLocation } from './instance-index';
import {
  normalizeAccountInstanceDocument,
  normalizePublishDocument,
  normalizeSavedRenderPointer,
  resolveSavedRenderValidationReason,
} from './normalize';
import { loadJson, putJson } from './storage';
import { resolveWidgetCode } from '../widget-catalog';
import type {
  AccountInstanceDocument,
  InstanceServeState,
  SavedRenderDocumentReadFailure,
  SavedRenderDocumentReadResult,
  SavedRenderPointer,
} from './types';
import { jsonSha256Hex, normalizeStorageId } from './utils';

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

function toSavedPointer(args: {
  instance: AccountInstanceDocument;
  configFp: string;
}): SavedRenderPointer {
  return {
    v: 1,
    id: args.instance.id,
    accountId: args.instance.accountId,
    widgetCode: args.instance.widgetCode,
    widgetType: args.instance.widgetType,
    displayName: args.instance.displayName,
    meta: args.instance.meta ?? null,
    configFp: args.configFp,
    updatedAt: args.instance.updatedAt,
  };
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
  const configFp = await jsonSha256Hex(args.config);
  await putJson(args.env, accountInstanceConfigKey(accountId, widgetCode, instanceId), args.config);

  const existing = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(accountId, widgetCode, instanceId)),
  );

  const instance: AccountInstanceDocument & { configFp: string } = {
    v: 1,
    id: instanceId,
    accountId,
    widgetCode,
    widgetType,
    displayName: normalizeDisplayName(args.displayName),
    meta: normalizeMeta(args.meta),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    configFp,
  };

  await putJson(args.env, accountInstanceDocumentKey(accountId, widgetCode, instanceId), instance);
  await patchAccountInstanceIndexEntry({ env: args.env, accountId, widgetType, instanceId });
  return {
    pointer: toSavedPointer({ instance, configFp }),
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
  const raw = await loadJson(args.env, accountInstanceDocumentKey(location.accountId, location.widgetCode, location.instanceId));
  if (!raw) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
  const instance = normalizeAccountInstanceDocument(raw);
  const pointer = instance
    ? normalizeSavedRenderPointer({
        ...instance,
        configFp: (raw as Record<string, unknown>).configFp,
      })
    : null;
  if (!pointer) {
    return { ok: false, kind: 'VALIDATION', reasonKey: resolveSavedRenderValidationReason(raw) };
  }
  if (pointer.id !== instanceId || pointer.accountId !== accountId) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
  }
  return { ok: true, value: pointer };
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
  const config = await loadJson<Record<string, unknown>>(
    args.env,
    accountInstanceConfigKey(pointer.accountId, pointer.widgetCode, pointer.id),
  );
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.config.invalid' };
  }
  return { ok: true, value: { pointer, config } };
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
  const publish = normalizePublishDocument(
    await loadJson(args.env, accountInstancePublishKey(location.accountId, location.widgetCode, location.instanceId)),
  );
  return publish?.status === 'published' ? 'published' : 'unpublished';
}

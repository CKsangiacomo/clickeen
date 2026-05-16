import type { Env } from '../../types';
import { normalizeLocale } from '../../asset-utils';
import { accountInstanceDocumentKey } from './keys';
import { patchAccountInstanceIndexEntry, resolveAccountInstanceLocation } from './instance-index';
import {
  normalizeAccountInstanceDocument,
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

function normalizeLocaleArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => normalizeLocale(entry)).filter((entry): entry is string => Boolean(entry))));
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

function buildGenerationState(args: {
  sourceVersion: number;
  previous?: AccountInstanceDocument | null;
  now: string;
}): AccountInstanceDocument['generation'] {
  const previous = args.previous?.generation;
  return {
    translations: {
      status: 'queued',
      sourceVersion: args.sourceVersion,
      requestedAt: args.now,
      updatedAt: args.now,
    },
    embed: {
      status: previous?.embed.status === 'ready' ? 'stale' : 'queued',
      sourceVersion: args.sourceVersion,
      requestedAt: args.now,
      updatedAt: args.now,
    },
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
    sourceVersion: instance.sourceVersion,
    generation: instance.generation,
    publishStatus: instance.publishStatus,
    updatedAt: instance.updatedAt,
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
  const existing = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(accountId, widgetCode, instanceId)),
  );
  const sourceVersion = (existing?.sourceVersion ?? 0) + 1;

  const meta = normalizeMeta(args.meta);
  const baseLocale = resolveBaseLocale(meta, existing);
  const targetLocales = resolveTargetLocales(meta, existing);
  const instance: AccountInstanceDocument = {
    v: 1,
    id: instanceId,
    accountId,
    accountPublicId: accountId,
    widgetCode,
    widgetType,
    displayName: normalizeDisplayName(args.displayName),
    meta,
    config: args.config,
    baseLocale,
    targetLocales,
    embedBuildShape: resolveEmbedBuildShape({ baseLocale, targetLocales, existing }),
    sourceVersion,
    generation: buildGenerationState({ sourceVersion, previous: existing, now }),
    publishStatus: existing?.publishStatus ?? 'unpublished',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

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
  const raw = await loadJson(args.env, accountInstanceDocumentKey(location.accountId, location.widgetCode, location.instanceId));
  if (!raw) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' };
  const instance = normalizeAccountInstanceDocument(raw);
  const pointer = instance ? normalizeSavedRenderPointer(instance) : null;
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
  const instance = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(pointer.accountId, pointer.widgetCode, pointer.id)),
  );
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
  const instance = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(location.accountId, location.widgetCode, location.instanceId)),
  );
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
  const instance = normalizeAccountInstanceDocument(await loadJson(args.env, key));
  if (!instance) throw new Error('tokyo.errors.instance.documentInvalid');
  const changed = instance.publishStatus !== args.status;
  const next = { ...instance, publishStatus: args.status, updatedAt: nowIso() } satisfies AccountInstanceDocument;
  await putJson(args.env, key, next);
  await patchAccountInstanceIndexEntry({
    env: args.env,
    accountId: location.accountId,
    widgetType: location.widgetType,
    instanceId: location.instanceId,
  });
  return { changed };
}

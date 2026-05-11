import type { Env } from '../../types';
import {
  accountInstanceConfigKey,
  accountInstanceDocumentKey,
  accountInstancePublishKey,
  accountWidgetDocumentKey,
} from './keys';
import { patchAccountInstanceIndexEntry, resolveAccountInstanceLocation } from './instance-index';
import { ensureSavedRenderL10nBase } from './localization';
import {
  normalizeAccountInstanceDocument,
  normalizePublishDocument,
  normalizeSavedRenderPointer,
  resolveSavedRenderValidationReason,
} from './normalize';
import { loadJson, putJson } from './storage';
import type {
  AccountInstanceDocument,
  AccountWidgetDocument,
  InstanceServeState,
  SavedRenderDocumentReadFailure,
  SavedRenderDocumentReadResult,
  SavedRenderL10nFailure,
  SavedRenderL10nStatus,
  SavedRenderPointer,
} from './types';
import { jsonSha256Hex, normalizeLocaleList, normalizeStorageId, normalizeSavedL10nFailures } from './utils';

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

async function ensureWidgetDocument(args: {
  env: Env;
  accountId: string;
  widgetType: string;
  now: string;
}): Promise<void> {
  const key = accountWidgetDocumentKey(args.accountId, args.widgetType);
  const existing = await loadJson<AccountWidgetDocument>(args.env, key);
  const createdAt =
    existing && typeof existing === 'object' && typeof (existing as any).createdAt === 'string'
      ? String((existing as any).createdAt)
      : args.now;
  await putJson(args.env, key, {
    v: 1,
    accountId: args.accountId,
    widgetType: args.widgetType,
    status: 'active',
    lockedReason: null,
    createdAt,
    updatedAt: args.now,
  } satisfies AccountWidgetDocument);
}

function toSavedPointer(args: {
  instance: AccountInstanceDocument;
  configFp: string;
}): SavedRenderPointer {
  return {
    v: 1,
    id: args.instance.id,
    accountId: args.instance.accountId,
    widgetType: args.instance.widgetType,
    displayName: args.instance.displayName,
    meta: args.instance.meta ?? null,
    configFp: args.configFp,
    updatedAt: args.instance.updatedAt,
    ...(args.instance.l10n ? { l10n: args.instance.l10n } : {}),
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
  // Optional derived locale projection from Berlin account policy. This is
  // stored with l10n state for sync/runtime work, not as instance-owned policy.
  l10n?:
    | {
        baseFingerprint?: string | null;
        summary?: {
          baseLocale: string;
          desiredLocales: string[];
        } | null;
      }
    | null;
}): Promise<{ pointer: SavedRenderPointer; previousBaseFingerprint: string | null }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!instanceId || !accountId || !widgetType) {
    throw new Error('tokyo.errors.render.invalid');
  }

  const now = nowIso();
  await ensureWidgetDocument({ env: args.env, accountId, widgetType, now });
  const configFp = await jsonSha256Hex(args.config);
  await putJson(args.env, accountInstanceConfigKey(accountId, widgetType, instanceId), args.config);

  const existing = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(accountId, widgetType, instanceId)),
  );
  const previousBaseFingerprint = existing?.l10n?.baseFingerprint ?? null;
  const l10nBase = await ensureSavedRenderL10nBase({
    env: args.env,
    accountId,
    instanceId: instanceId,
    widgetType,
    config: args.config,
    existingBaseFingerprint:
      typeof args.l10n?.baseFingerprint === 'string'
        ? args.l10n.baseFingerprint
        : previousBaseFingerprint,
  });
  const requestedSummary = args.l10n?.summary ?? undefined;
  const carriedSummary =
    requestedSummary === null
      ? null
      : requestedSummary ?? existing?.l10n?.summary ?? null;

  const instance: AccountInstanceDocument & { configFp: string } = {
    v: 1,
    id: instanceId,
    accountId,
    widgetType,
    displayName: normalizeDisplayName(args.displayName),
    meta: normalizeMeta(args.meta),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    l10n: {
      baseFingerprint: l10nBase.baseFingerprint,
      ...(carriedSummary ? { summary: carriedSummary } : {}),
    },
    configFp,
  };

  await putJson(args.env, accountInstanceDocumentKey(accountId, widgetType, instanceId), instance);
  await patchAccountInstanceIndexEntry({ env: args.env, accountId, widgetType, instanceId });
  return {
    pointer: toSavedPointer({ instance, configFp }),
    previousBaseFingerprint,
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
  const raw = await loadJson(args.env, accountInstanceDocumentKey(location.accountId, location.widgetType, location.instanceId));
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
    accountInstanceConfigKey(pointer.accountId, pointer.widgetType, pointer.id),
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
}): Promise<InstanceServeState> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) throw new Error('tokyo.errors.render.invalid');
  const location = await resolveAccountInstanceLocation({ env: args.env, accountId, instanceId });
  if (!location) return 'unpublished';
  const publish = normalizePublishDocument(
    await loadJson(args.env, accountInstancePublishKey(location.accountId, location.widgetType, location.instanceId)),
  );
  return publish?.status === 'published' ? 'published' : 'unpublished';
}

export async function writeSavedRenderL10nState(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  baseFingerprint: string;
  summary?: {
    baseLocale: string;
    desiredLocales: string[];
  } | null;
}): Promise<SavedRenderPointer> {
  const pointerResult = await readSavedRenderPointer(args);
  if (!pointerResult.ok) {
    throw new Error(pointerResult.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : pointerResult.reasonKey);
  }
  const pointer = pointerResult.value;
  const raw = await loadJson<Record<string, unknown>>(
    args.env,
    accountInstanceDocumentKey(pointer.accountId, pointer.widgetType, pointer.id),
  );
  const instance = normalizeAccountInstanceDocument(raw);
  if (!instance) throw new Error('tokyo_saved_not_found');
  const next: AccountInstanceDocument & { configFp: string } = {
    ...instance,
    l10n: {
      ...(instance.l10n ?? {}),
      baseFingerprint: args.baseFingerprint,
      ...(args.summary ? { summary: args.summary } : {}),
    },
    configFp: pointer.configFp,
  };
  await putJson(args.env, accountInstanceDocumentKey(pointer.accountId, pointer.widgetType, pointer.id), next);
  return toSavedPointer({ instance: next, configFp: pointer.configFp });
}

export async function writeSavedRenderL10nStatus(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  generationId: string;
  status: SavedRenderL10nStatus;
  baseFingerprint?: string | null;
  readyLocales?: string[];
  failedLocales?: SavedRenderL10nFailure[];
  lastError?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  guardCurrentGeneration?: boolean;
}): Promise<SavedRenderPointer | null> {
  const pointerResult = await readSavedRenderPointer(args);
  if (!pointerResult.ok) {
    throw new Error(pointerResult.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : pointerResult.reasonKey);
  }
  const pointer = pointerResult.value;
  const current = pointer.l10n;
  const baseFingerprint = args.baseFingerprint || current?.baseFingerprint || '';
  const generationId = typeof args.generationId === 'string' ? args.generationId.trim() : '';
  if (!current || !baseFingerprint || !generationId) throw new Error('tokyo_saved_l10n_base_missing');
  if (args.guardCurrentGeneration === true && current.generationId !== generationId) return null;

  const now = nowIso();
  const readyLocales = args.readyLocales ? normalizeLocaleList(args.readyLocales) : current.readyLocales ?? [];
  const failedLocales = args.failedLocales ? normalizeSavedL10nFailures(args.failedLocales) : current.failedLocales ?? [];
  const lastError = normalizeDisplayName(args.lastError);
  const startedAt = normalizeDisplayName(args.startedAt);
  const finishedAt = normalizeDisplayName(args.finishedAt);

  const raw = await loadJson<Record<string, unknown>>(
    args.env,
    accountInstanceDocumentKey(pointer.accountId, pointer.widgetType, pointer.id),
  );
  const instance = normalizeAccountInstanceDocument(raw);
  if (!instance) throw new Error('tokyo_saved_not_found');
  const next: AccountInstanceDocument & { configFp: string } = {
    ...instance,
    l10n: {
      baseFingerprint,
      ...(current.summary ? { summary: current.summary } : {}),
      generationId,
      status: args.status,
      readyLocales,
      failedLocales,
      updatedAt: now,
      ...(startedAt ? { startedAt } : {}),
      ...(finishedAt ? { finishedAt } : {}),
      ...(lastError ? { lastError } : {}),
    },
    configFp: pointer.configFp,
  };
  await putJson(args.env, accountInstanceDocumentKey(pointer.accountId, pointer.widgetType, pointer.id), next);
  return toSavedPointer({ instance: next, configFp: pointer.configFp });
}

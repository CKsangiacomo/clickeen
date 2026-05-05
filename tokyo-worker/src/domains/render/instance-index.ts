import { classifyWidgetPublicId, isUuid } from '@clickeen/ck-contracts';
import type { Env } from '../../types';
import {
  accountInstanceIndexKey,
  accountInstanceListedIndexKey,
  accountInstanceRenderLivePointerKey,
  accountInstanceSavedConfigPackKey,
  accountInstanceSavedPointerKey,
  accountInstancesRoot,
} from './keys';
import { normalizeLiveRenderPointer, normalizeSavedRenderPointer } from './normalize';
import { loadJson, putJson } from './storage';
import type {
  AccountInstanceIndexDocument,
  AccountInstanceIndexEntry,
  InstanceServeState,
  SavedRenderPointer,
} from './types';
import { normalizePublicId } from './utils';

const DEFAULT_PLATFORM_ACCOUNT_ID = '00000000-0000-0000-0000-000000000100';

type IndexFailure = {
  ok: false;
  kind: 'NOT_FOUND' | 'VALIDATION';
  reasonKey: string;
  detail?: string;
};

export type AccountInstanceIndexReadResult =
  | { ok: true; value: AccountInstanceIndexDocument }
  | IndexFailure;

export function resolvePlatformAccountId(env: Env): string {
  const configured = typeof env.CK_PLATFORM_ACCOUNT_ID === 'string' ? env.CK_PLATFORM_ACCOUNT_ID.trim() : '';
  return configured && isUuid(configured) ? configured : DEFAULT_PLATFORM_ACCOUNT_ID;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => asTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function displayNameFromPointer(pointer: SavedRenderPointer): string {
  const displayName = asTrimmedString(pointer.displayName);
  if (displayName) return displayName;
  const meta = pointer.meta && typeof pointer.meta === 'object' && !Array.isArray(pointer.meta) ? pointer.meta : null;
  return (
    asTrimmedString(meta?.styleName) ??
    asTrimmedString(meta?.name) ??
    asTrimmedString(meta?.title) ??
    pointer.publicId
  );
}

function kindFromPublicId(publicId: string): AccountInstanceIndexEntry['kind'] {
  return classifyWidgetPublicId(publicId) === 'user' ? 'user' : 'system';
}

async function readServeState(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<InstanceServeState> {
  const livePointer = normalizeLiveRenderPointer(
    await loadJson(args.env, accountInstanceRenderLivePointerKey(args.accountId, args.publicId)),
  );
  return livePointer ? 'published' : 'unpublished';
}

async function buildEntryFromPointer(args: {
  env: Env;
  pointer: SavedRenderPointer;
}): Promise<AccountInstanceIndexEntry> {
  const config = await loadJson(
    args.env,
    accountInstanceSavedConfigPackKey(args.pointer.accountId, args.pointer.publicId, args.pointer.configFp),
  );
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`saved_config_missing:${args.pointer.accountId}:${args.pointer.publicId}`);
  }

  const meta =
    args.pointer.meta && typeof args.pointer.meta === 'object' && !Array.isArray(args.pointer.meta)
      ? args.pointer.meta
      : {};
  return {
    accountId: args.pointer.accountId,
    publicId: args.pointer.publicId,
    widgetType: args.pointer.widgetType,
    displayName: displayNameFromPointer(args.pointer),
    kind: kindFromPublicId(args.pointer.publicId),
    listed: meta.listed === true,
    duplicable: meta.duplicable === true,
    listedSurfaces: normalizeStringList(meta.listedSurfaces),
    publishStatus: await readServeState({
      env: args.env,
      accountId: args.pointer.accountId,
      publicId: args.pointer.publicId,
    }),
    updatedAt: args.pointer.updatedAt,
  };
}

function normalizeIndexEntry(raw: unknown): AccountInstanceIndexEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  const accountId = asTrimmedString(payload.accountId);
  const publicId = asTrimmedString(payload.publicId);
  const widgetType = asTrimmedString(payload.widgetType);
  const displayName = asTrimmedString(payload.displayName);
  const updatedAt = asTrimmedString(payload.updatedAt);
  const kind = payload.kind === 'user' ? 'user' : payload.kind === 'system' ? 'system' : null;
  const publishStatus =
    payload.publishStatus === 'published'
      ? 'published'
      : payload.publishStatus === 'unpublished'
        ? 'unpublished'
        : null;
  if (!accountId || !publicId || !widgetType || !displayName || !updatedAt || !kind || !publishStatus) {
    return null;
  }
  return {
    accountId,
    publicId,
    widgetType,
    displayName,
    kind,
    listed: payload.listed === true,
    duplicable: payload.duplicable === true,
    listedSurfaces: normalizeStringList(payload.listedSurfaces),
    publishStatus,
    updatedAt,
  };
}

function normalizeIndexDocument(raw: unknown, accountId: string): AccountInstanceIndexDocument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const docAccountId = asTrimmedString(payload.accountId);
  const updatedAt = asTrimmedString(payload.updatedAt);
  const entriesRaw = Array.isArray(payload.entries) ? payload.entries : null;
  if (docAccountId !== accountId || !updatedAt || !entriesRaw) return null;
  const entries = entriesRaw.map((entry) => normalizeIndexEntry(entry));
  if (entries.some((entry) => !entry)) return null;
  return {
    v: 1,
    accountId,
    entries: entries as AccountInstanceIndexEntry[],
    updatedAt,
  };
}

async function listSavedPointerKeys(env: Env, accountId: string): Promise<string[]> {
  const prefix = `${accountInstancesRoot(accountId)}/`;
  const suffix = '/saved/pointer.json';
  const keys: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor });
    keys.push(
      ...listed.objects
        .map((object) => object.key)
        .filter((key) => key.endsWith(suffix)),
    );
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return keys;
}

async function buildIndexDocument(env: Env, accountId: string): Promise<AccountInstanceIndexDocument> {
  const keys = await listSavedPointerKeys(env, accountId);
  const entries: AccountInstanceIndexEntry[] = [];
  for (const key of keys) {
    const raw = await loadJson(env, key);
    const pointer = normalizeSavedRenderPointer(raw);
    if (!pointer || pointer.accountId !== accountId) {
      throw new Error(`saved_pointer_invalid:${key}`);
    }
    entries.push(await buildEntryFromPointer({ env, pointer }));
  }
  entries.sort((left, right) => {
    const byWidget = left.widgetType.localeCompare(right.widgetType);
    if (byWidget !== 0) return byWidget;
    const byUpdated = right.updatedAt.localeCompare(left.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return left.publicId.localeCompare(right.publicId);
  });
  return {
    v: 1,
    accountId,
    entries,
    updatedAt: new Date().toISOString(),
  };
}

async function validateIndexDocument(env: Env, index: AccountInstanceIndexDocument): Promise<IndexFailure | null> {
  for (const entry of index.entries) {
    const pointerRaw = await loadJson(env, accountInstanceSavedPointerKey(entry.accountId, entry.publicId));
    const pointer = normalizeSavedRenderPointer(pointerRaw);
    if (!pointer || pointer.accountId !== entry.accountId || pointer.publicId !== entry.publicId) {
      return {
        ok: false,
        kind: 'VALIDATION',
        reasonKey: 'tokyo.errors.instance.indexPointerMissing',
        detail: `${entry.accountId}:${entry.publicId}`,
      };
    }
    const config = await loadJson(env, accountInstanceSavedConfigPackKey(entry.accountId, entry.publicId, pointer.configFp));
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {
        ok: false,
        kind: 'VALIDATION',
        reasonKey: 'tokyo.errors.instance.indexConfigMissing',
        detail: `${entry.accountId}:${entry.publicId}`,
      };
    }
  }
  return null;
}

export async function rebuildAccountInstanceIndexes(env: Env, accountIdRaw: string): Promise<AccountInstanceIndexDocument> {
  const accountId = normalizePublicId(accountIdRaw);
  if (!accountId || !isUuid(accountId)) throw new Error('tokyo.errors.render.invalid');
  const index = await buildIndexDocument(env, accountId);
  await putJson(env, accountInstanceIndexKey(accountId), index);
  if (accountId === resolvePlatformAccountId(env)) {
    await putJson(env, accountInstanceListedIndexKey(accountId), {
      ...index,
      entries: index.entries.filter((entry) => entry.listed),
    } satisfies AccountInstanceIndexDocument);
  }
  return index;
}

export async function buildAccountInstanceIndexDryRun(env: Env, accountIdRaw: string): Promise<AccountInstanceIndexDocument> {
  const accountId = normalizePublicId(accountIdRaw);
  if (!accountId || !isUuid(accountId)) throw new Error('tokyo.errors.render.invalid');
  return buildIndexDocument(env, accountId);
}

export async function readAccountInstanceIndex(args: {
  env: Env;
  accountId: string;
  rebuildIfMissing?: boolean;
}): Promise<AccountInstanceIndexReadResult> {
  const accountId = normalizePublicId(args.accountId);
  if (!accountId || !isUuid(accountId)) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' };
  }
  const raw = await loadJson(args.env, accountInstanceIndexKey(accountId));
  if (!raw) {
    if (args.rebuildIfMissing === false) {
      return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.instance.indexMissing' };
    }
    try {
      return { ok: true, value: await rebuildAccountInstanceIndexes(args.env, accountId) };
    } catch (error) {
      return {
        ok: false,
        kind: 'VALIDATION',
        reasonKey: 'tokyo.errors.instance.indexInvalid',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const index = normalizeIndexDocument(raw, accountId);
  if (!index) return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.errors.instance.indexInvalid' };
  const invalid = await validateIndexDocument(args.env, index);
  if (invalid) return invalid;
  return { ok: true, value: index };
}

export async function readListedInstanceIndex(args: {
  env: Env;
  platformAccountId?: string;
}): Promise<AccountInstanceIndexReadResult> {
  const accountId = args.platformAccountId ?? resolvePlatformAccountId(args.env);
  const raw = await loadJson(args.env, accountInstanceListedIndexKey(accountId));
  if (!raw) {
    try {
      await rebuildAccountInstanceIndexes(args.env, accountId);
    } catch (error) {
      return {
        ok: false,
        kind: 'VALIDATION',
        reasonKey: 'tokyo.errors.instance.indexInvalid',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const listedRaw = await loadJson(args.env, accountInstanceListedIndexKey(accountId));
  const index = normalizeIndexDocument(listedRaw, accountId);
  if (!index) return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.errors.instance.indexInvalid' };
  const invalid = await validateIndexDocument(args.env, index);
  if (invalid) return invalid;
  return { ok: true, value: index };
}

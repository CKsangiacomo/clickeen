import { asTrimmedString } from '@clickeen/ck-contracts';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import {
  accountInstanceConfigKey,
  accountInstanceDocumentKey,
  accountInstanceIndexKey,
  accountInstancesRoot,
} from './keys';
import {
  normalizeAccountInstanceConfigDocument,
  normalizeAccountInstanceDocument,
  normalizeIndexDocument,
} from './normalize';
import { loadJson, putJson } from './storage';
import type {
  AccountInstanceIndexDocument,
  AccountInstanceIndexEntry,
  AccountInstanceDocument,
} from './types';
import { resolveWidgetCode } from '../widget-catalog';
import { normalizeStorageId } from './utils';

export type AccountInstanceLocation = {
  accountId: string;
  widgetCode: string;
  widgetType: string;
  instanceId: string;
};

type IndexFailure = {
  ok: false;
  kind: 'NOT_FOUND' | 'VALIDATION';
  reasonKey: string;
  detail?: string;
};

export type AccountInstanceIndexReadResult =
  | { ok: true; value: AccountInstanceIndexDocument }
  | IndexFailure;

function displayNameFromInstance(instance: AccountInstanceDocument): string {
  const displayName = asTrimmedString(instance.displayName);
  if (displayName) return displayName;
  const meta = instance.meta && typeof instance.meta === 'object' && !Array.isArray(instance.meta) ? instance.meta : null;
  return (
    asTrimmedString(meta?.styleName) ??
    asTrimmedString(meta?.name) ??
    asTrimmedString(meta?.title) ??
    instance.id
  );
}

async function buildEntryFromInstance(args: {
  instance: AccountInstanceDocument;
}): Promise<AccountInstanceIndexEntry> {
  return {
    accountId: args.instance.accountId,
    id: args.instance.id,
    widgetCode: args.instance.widgetCode,
    widgetType: args.instance.widgetType,
    displayName: displayNameFromInstance(args.instance),
    publishStatus: args.instance.publishStatus,
    updatedAt: args.instance.updatedAt,
  };
}

function sortIndexEntries(entries: AccountInstanceIndexEntry[]): AccountInstanceIndexEntry[] {
  return [...entries].sort((left, right) => {
    const byWidget = left.widgetType.localeCompare(right.widgetType);
    if (byWidget !== 0) return byWidget;
    const byUpdated = right.updatedAt.localeCompare(left.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return left.id.localeCompare(right.id);
  });
}

async function listInstanceDocumentKeys(env: Env, accountId: string): Promise<string[]> {
  const prefix = `${accountInstancesRoot(accountId)}/`;
  const suffix = '/instance.json';
  const keys: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor });
    keys.push(...listed.objects.map((object) => object.key).filter((key) => key.endsWith(suffix)));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return keys;
}

async function buildIndexDocument(env: Env, accountId: string): Promise<AccountInstanceIndexDocument> {
  const keys = await listInstanceDocumentKeys(env, accountId);
  const entries: AccountInstanceIndexEntry[] = [];
  for (const key of keys) {
    const raw = await loadJson(env, key);
    const instance = normalizeAccountInstanceDocument(raw);
    if (!instance || instance.accountId !== accountId) {
      throw new Error(`instance_document_invalid:${key}`);
    }
    entries.push(await buildEntryFromInstance({ instance }));
  }
  return { v: 1, accountId, entries: sortIndexEntries(entries), updatedAt: new Date().toISOString() };
}

async function readIndexForMutation(env: Env, accountId: string): Promise<AccountInstanceIndexDocument> {
  const raw = await loadJson(env, accountInstanceIndexKey(accountId));
  if (!raw) return { v: 1, accountId, entries: [], updatedAt: new Date().toISOString() };
  const index = normalizeIndexDocument(raw, accountId);
  if (!index) throw new Error('tokyo.errors.instance.indexInvalid');
  return index;
}

export async function rebuildAccountInstanceIndexes(env: Env, accountIdRaw: string): Promise<AccountInstanceIndexDocument> {
  const accountId = normalizeStorageId(accountIdRaw);
  if (!isCompactAccountPublicId(accountId)) throw new Error('tokyo.errors.render.invalid');
  const index = await buildIndexDocument(env, accountId);
  await putJson(env, accountInstanceIndexKey(accountId), index);
  return index;
}

export async function patchAccountInstanceIndexEntry(args: {
  env: Env;
  accountId: string;
  widgetType: string;
  instanceId: string;
}): Promise<AccountInstanceIndexDocument> {
  const accountId = normalizeStorageId(args.accountId);
  const widgetType = asTrimmedString(args.widgetType);
  const widgetCode = widgetType ? resolveWidgetCode(widgetType) : null;
  const instanceId = normalizeStorageId(args.instanceId);
  if (!isCompactAccountPublicId(accountId) || !widgetType || !widgetCode || !instanceId) {
    throw new Error('tokyo.errors.render.invalid');
  }
  const instance = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(accountId, widgetCode, instanceId)),
  );
  if (!instance || instance.accountId !== accountId || instance.widgetCode !== widgetCode || instance.widgetType !== widgetType || instance.id !== instanceId) {
    throw new Error('tokyo.errors.instance.documentInvalid');
  }
  const entry = await buildEntryFromInstance({ instance });
  const index = await readIndexForMutation(args.env, accountId);
  const entries = [
    ...index.entries.filter((candidate) => candidate.id !== instanceId),
    entry,
  ];
  const next = { v: 1, accountId, entries: sortIndexEntries(entries), updatedAt: new Date().toISOString() } satisfies AccountInstanceIndexDocument;
  await putJson(args.env, accountInstanceIndexKey(accountId), next);
  return next;
}

export async function removeAccountInstanceIndexEntry(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<AccountInstanceIndexDocument> {
  const accountId = normalizeStorageId(args.accountId);
  const instanceId = normalizeStorageId(args.instanceId);
  if (!isCompactAccountPublicId(accountId) || !instanceId) throw new Error('tokyo.errors.render.invalid');
  const index = await readIndexForMutation(args.env, accountId);
  const next = {
    v: 1,
    accountId,
    entries: sortIndexEntries(index.entries.filter((candidate) => candidate.id !== instanceId)),
    updatedAt: new Date().toISOString(),
  } satisfies AccountInstanceIndexDocument;
  await putJson(args.env, accountInstanceIndexKey(accountId), next);
  return next;
}

export async function readAccountInstanceIndex(args: {
  env: Env;
  accountId: string;
}): Promise<AccountInstanceIndexReadResult> {
  const accountId = normalizeStorageId(args.accountId);
  if (!isCompactAccountPublicId(accountId)) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' };
  }
  const raw = await loadJson(args.env, accountInstanceIndexKey(accountId));
  if (!raw) {
    return { ok: true, value: { v: 1, accountId, entries: [], updatedAt: new Date().toISOString() } };
  }
  const index = normalizeIndexDocument(raw, accountId);
  if (!index) return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.errors.instance.indexInvalid' };
  return { ok: true, value: index };
}

export async function resolveAccountInstanceLocation(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType?: string | null;
}): Promise<AccountInstanceLocation | null> {
  const accountId = normalizeStorageId(args.accountId);
  const instanceId = normalizeStorageId(args.instanceId);
  const widgetType = asTrimmedString(args.widgetType);
  if (!accountId || !instanceId) return null;
  if (widgetType) {
    const widgetCode = resolveWidgetCode(widgetType);
    return widgetCode ? { accountId, widgetCode, widgetType, instanceId } : null;
  }
  const config = normalizeAccountInstanceConfigDocument(
    await loadJson(args.env, accountInstanceConfigKey(accountId, '', instanceId)),
  );
  if (config && config.accountId === accountId && config.id === instanceId) {
    return { accountId, widgetCode: config.widgetCode, widgetType: config.widgetType, instanceId };
  }
  const legacy = normalizeAccountInstanceDocument(
    await loadJson(args.env, accountInstanceDocumentKey(accountId, '', instanceId)),
  );
  if (legacy && legacy.accountId === accountId && legacy.id === instanceId) {
    return { accountId, widgetCode: legacy.widgetCode, widgetType: legacy.widgetType, instanceId };
  }
  const index = await readAccountInstanceIndex({
    env: args.env,
    accountId,
  });
  if (!index.ok) return null;
  const entry = index.value.entries.find((candidate) => candidate.id === instanceId);
  return entry ? { accountId, widgetCode: entry.widgetCode, widgetType: entry.widgetType, instanceId } : null;
}

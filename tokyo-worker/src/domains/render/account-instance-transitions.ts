import { createCompactInstanceId, isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import {
  resolveWidgetDefaults,
} from '../widget-catalog';
import {
  readInstanceServeState,
  readSavedRenderConfig,
  writeInstanceServeState,
  writeSavedRenderConfig,
} from './saved-config';
import { accountInstanceRoot } from './keys';
import type { InstanceServeState, SavedRenderPointer } from './types';
import { normalizeStorageId } from './utils';

export class AccountInstanceTransitionError extends Error {
  status: number;
  kind: 'VALIDATION' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  paths?: string[];

  constructor(args: {
    status: number;
    kind: AccountInstanceTransitionError['kind'];
    reasonKey: string;
    detail?: string;
    issues?: Array<{ path: string }>;
  }) {
    super(args.detail ?? args.reasonKey);
    this.name = 'AccountInstanceTransitionError';
    this.status = args.status;
    this.kind = args.kind;
    this.reasonKey = args.reasonKey;
    this.paths = args.issues?.map((issue) => issue.path);
  }
}

function assertScopedIds(accountIdRaw: string, instanceIdRaw: string): {
  accountId: string;
  instanceId: string;
} {
  const accountId = normalizeStorageId(accountIdRaw);
  const instanceId = normalizeStorageId(instanceIdRaw);
  if (!isCompactAccountPublicId(accountId) || !isCompactInstanceId(instanceId)) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    });
  }
  return { accountId, instanceId };
}

function transitionFailureFromSavedRead(result: { kind: 'NOT_FOUND' | 'VALIDATION'; reasonKey: string }): never {
  if (result.kind === 'NOT_FOUND') {
    throw new AccountInstanceTransitionError({
      status: 404,
      kind: 'NOT_FOUND',
      reasonKey: 'coreui.errors.instance.notFound',
      detail: result.reasonKey,
    });
  }
  throw new AccountInstanceTransitionError({
    status: 422,
    kind: 'VALIDATION',
    reasonKey: result.reasonKey,
  });
}

function accountInstancePublicEntryKey(accountId: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, '', instanceId)}/index.html`;
}

function accountInstanceUnpublishedEntryKey(accountId: string, instanceId: string): string {
  return `${accountInstancePublicEntryKey(accountId, instanceId)}.off`;
}

async function renameR2Object(args: {
  env: Env;
  fromKey: string;
  toKey: string;
}): Promise<boolean> {
  const source = await args.env.TOKYO_R2.get(args.fromKey);
  if (!source) return false;
  await args.env.TOKYO_R2.put(args.toKey, source.body, {
    httpMetadata: source.httpMetadata ?? undefined,
    customMetadata: source.customMetadata ?? undefined,
  });
  await args.env.TOKYO_R2.delete(args.fromKey);
  return true;
}

async function purgeClkLiveEntryCache(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<void> {
  const zoneId = String(args.env.CLOUDFLARE_ZONE_ID || '').trim();
  const token = String(args.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!zoneId || !token) return;
  const base = `https://clk.live/${args.accountId}/${args.instanceId}`;
  await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ files: [base, `${base}/`, `${base}/index.html`] }),
  }).catch(() => undefined);
}

async function mintAccountInstanceId(args: {
  env: Env;
  accountId: string;
  widgetType: string;
}): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const instanceId = createCompactInstanceId();
    const existing = await readSavedRenderConfig({
      env: args.env,
      accountId: args.accountId,
      widgetType: args.widgetType,
      instanceId,
    });
    if (!existing.ok && existing.kind === 'NOT_FOUND') {
      return instanceId;
    }
  }
  throw new AccountInstanceTransitionError({
    status: 503,
    kind: 'UPSTREAM_UNAVAILABLE',
    reasonKey: 'tokyo.errors.instance.idCollision',
    detail: 'compact_instance_id_collision',
  });
}

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120 ? trimmed : null;
}

export async function createAccountInstanceFromDefaults(args: {
  env: Env;
  accountId: string;
  widgetType: string;
  displayName?: unknown;
}): Promise<{ pointer: SavedRenderPointer; config: Record<string, unknown> }> {
  const accountId = normalizeStorageId(args.accountId);
  const widgetType = normalizeStorageId(args.widgetType);
  if (!accountId || !widgetType) {
    throw new Error('tokyo.errors.render.invalid');
  }

  const config = resolveWidgetDefaults(widgetType);
  if (!config) {
    throw new Error('tokyo.errors.widget.unsupported');
  }

  const saved = await writeSavedRenderConfig({
    env: args.env,
    accountId,
    instanceId: await mintAccountInstanceId({ env: args.env, accountId, widgetType }),
    widgetType,
    config,
    displayName: normalizeDisplayName(args.displayName),
    meta: null,
  });

  return { pointer: saved.pointer, config };
}

export async function saveAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  submittedWidgetType: string;
  config: Record<string, unknown>;
  displayName?: unknown;
  hasDisplayName: boolean;
  meta?: unknown;
  hasMeta: boolean;
}): Promise<{
  ok: true;
  pointer: SavedRenderPointer;
  live: boolean;
}> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const submittedWidgetType = String(args.submittedWidgetType || '').trim();
  if (!submittedWidgetType) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    });
  }

  const existing = await readSavedRenderConfig({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const existingWidgetType = existing.value.pointer.widgetType;
  if (submittedWidgetType !== existingWidgetType) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.widgetMismatch',
      detail: `submitted widgetType "${submittedWidgetType}" does not match Tokyo instance widgetType "${existingWidgetType}"`,
    });
  }
  const saved = await writeSavedRenderConfig({
    env: args.env,
    accountId,
    instanceId,
    widgetType: existingWidgetType,
    config: args.config,
    displayName: args.hasDisplayName ? args.displayName : existing.value.pointer.displayName,
    meta: args.hasMeta ? args.meta : existing.value.pointer.meta ?? null,
  });
  const live = (await readInstanceServeState({ env: args.env, accountId, instanceId })) === 'published';

  return {
    ok: true,
    pointer: saved.pointer,
    live,
  };
}

export async function duplicateAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  sourceInstanceId: string;
}): Promise<{
  accountId: string;
  sourceInstanceId: string;
  instanceId: string;
  widgetType: string;
  status: InstanceServeState;
}> {
  const { accountId, instanceId: sourceInstanceId } = assertScopedIds(args.accountId, args.sourceInstanceId);
  const source = await readSavedRenderConfig({
    env: args.env,
    accountId,
    instanceId: sourceInstanceId,
  });
  if (!source.ok) transitionFailureFromSavedRead(source);

  const instanceId = await mintAccountInstanceId({
    env: args.env,
    accountId,
    widgetType: source.value.pointer.widgetType,
  });
  const saved = await writeSavedRenderConfig({
    env: args.env,
    accountId,
    instanceId,
    widgetType: source.value.pointer.widgetType,
    config: source.value.config,
    displayName: null,
    meta: null,
  });

  return {
    accountId,
    sourceInstanceId,
    instanceId,
    widgetType: source.value.pointer.widgetType,
    status: 'unpublished',
  };
}

export async function publishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{ instanceId: string; status: 'published'; changed: boolean }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const existing = await readSavedRenderConfig({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);

  const entryKey = accountInstancePublicEntryKey(accountId, instanceId);
  const unpublishedEntryKey = accountInstanceUnpublishedEntryKey(accountId, instanceId);
  let changed = false;
  if (!(await args.env.TOKYO_R2.get(entryKey))) {
    const restored = await renameR2Object({
      env: args.env,
      fromKey: unpublishedEntryKey,
      toKey: entryKey,
    });
    if (!restored) {
      throw new AccountInstanceTransitionError({
        status: 409,
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.instance.embedNotReady',
        detail: 'index.html is missing; generated embed files are not ready to publish',
      });
    }
    changed = true;
  }

  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  if (liveStatus === 'published' && !changed) {
    await writeInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      widgetType: existing.value.pointer.widgetType,
      status: 'published',
    });
    return { instanceId, status: 'published', changed: false };
  }

  await writeInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetType: existing.value.pointer.widgetType,
    status: 'published',
  });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  return { instanceId, status: 'published', changed: true };
}

export async function unpublishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{ instanceId: string; status: 'unpublished'; changed: boolean }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const existing = await readSavedRenderConfig({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const entryKey = accountInstancePublicEntryKey(accountId, instanceId);
  const unpublishedEntryKey = accountInstanceUnpublishedEntryKey(accountId, instanceId);
  const renamed = await renameR2Object({
    env: args.env,
    fromKey: entryKey,
    toKey: unpublishedEntryKey,
  });
  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  if (liveStatus === 'unpublished' && !renamed) {
    return { instanceId, status: 'unpublished', changed: false };
  }
  await writeInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetType: existing.value.pointer.widgetType,
    status: 'unpublished',
  });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  return { instanceId, status: 'unpublished', changed: renamed || liveStatus !== 'unpublished' };
}

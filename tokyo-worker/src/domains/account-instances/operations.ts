import { createCompactInstanceId, isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import {
  resolveWidgetDefaults,
} from '../widget-definitions';
import {
  type SubmittedInstancePublicPackage,
  verifyInstancePublicPackageReady,
  writeInstancePublicPackage,
} from './package-files';
import { PUBLIC_INDEX_FILE, PUBLIC_RUNTIME_FILE, PUBLIC_STYLES_FILE } from './package-file-names';
import {
  readAccountInstanceSource,
  writeAccountInstanceSource,
} from './source';
import {
  readInstanceServeState,
  writeInstanceServeState,
} from './serve-state';
import type { InstanceServeState, AccountInstanceSourcePointer } from './types';
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
      reasonKey: 'coreui.errors.instance.invalidPayload',
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

async function purgeClkLiveEntryCache(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locales?: string[];
}): Promise<void> {
  void args.locales;
  const zoneId = String(args.env.CLOUDFLARE_ZONE_ID || '').trim();
  const token = String(args.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!zoneId || !token) return;
  const publicServingBase =
    String(args.env.PUBLIC_SERVING_BASE_URL || '').trim().replace(/\/+$/, '') || 'https://clk.live';
  const base = `${publicServingBase}/${args.accountId}/${args.instanceId}`;
  const files = new Set([
    base,
    `${base}/`,
    `${base}/${PUBLIC_INDEX_FILE}`,
    `${base}/${PUBLIC_STYLES_FILE}`,
    `${base}/${PUBLIC_RUNTIME_FILE}`,
  ]);
  await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ files: [...files] }),
  }).catch(() => undefined);
}

async function mintAccountInstanceId(args: {
  env: Env;
  accountId: string;
  widgetType: string;
}): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const instanceId = createCompactInstanceId();
    const existing = await readAccountInstanceSource({
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
}): Promise<{ pointer: AccountInstanceSourcePointer; config: Record<string, unknown> }> {
  const accountId = normalizeStorageId(args.accountId);
  const widgetType = normalizeStorageId(args.widgetType);
  if (!accountId || !widgetType) {
    throw new Error('coreui.errors.instance.invalidPayload');
  }

  const config = resolveWidgetDefaults(widgetType);
  if (!config) {
    throw new Error('tokyo.errors.widget.unsupported');
  }

  const saved = await writeAccountInstanceSource({
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
  publicPackage: SubmittedInstancePublicPackage;
  displayName?: unknown;
  hasDisplayName: boolean;
  meta?: unknown;
  hasMeta: boolean;
}): Promise<{
  ok: true;
  pointer: AccountInstanceSourcePointer;
  previousConfig: Record<string, unknown>;
  live: boolean;
}> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const submittedWidgetType = String(args.submittedWidgetType || '').trim();
  if (!submittedWidgetType) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.invalidPayload',
    });
  }

  const existing = await readAccountInstanceSource({ env: args.env, accountId, instanceId });
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
  const saved = await writeAccountInstanceSource({
    env: args.env,
    accountId,
    instanceId,
    widgetType: existingWidgetType,
    config: args.config,
    displayName: args.hasDisplayName ? args.displayName : existing.value.pointer.displayName,
    meta: args.hasMeta ? args.meta : existing.value.pointer.meta ?? null,
  });
  const packaged = await writeInstancePublicPackage({
    env: args.env,
    accountId,
    instanceId,
    publicPackage: args.publicPackage,
  });
  if (!packaged.ok) {
    throw new AccountInstanceTransitionError({
      status: 409,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.embedNotReady',
      detail: packaged.detail,
    });
  }
  const live = (await readInstanceServeState({ env: args.env, accountId, instanceId })) === 'published';

  return {
    ok: true,
    pointer: saved.pointer,
    previousConfig: existing.value.config,
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
  const source = await readAccountInstanceSource({
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
  const saved = await writeAccountInstanceSource({
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
  const packageReady = await verifyInstancePublicPackageReady({ env: args.env, accountId, instanceId });
  if (!packageReady.ok) {
    throw new AccountInstanceTransitionError({
      status: 409,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.embedNotReady',
      detail: packageReady.detail,
    });
  }
  const existing = await readAccountInstanceSource({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);

  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  await writeInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetType: existing.value.pointer.widgetType,
    status: 'published',
  });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  return { instanceId, status: 'published', changed: liveStatus !== 'published' };
}

export async function unpublishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{ instanceId: string; status: 'unpublished'; changed: boolean }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const existing = await readAccountInstanceSource({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  if (liveStatus !== 'unpublished') {
    await writeInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      widgetType: existing.value.pointer.widgetType,
      status: 'unpublished',
    });
  }
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  return { instanceId, status: 'unpublished', changed: liveStatus !== 'unpublished' };
}

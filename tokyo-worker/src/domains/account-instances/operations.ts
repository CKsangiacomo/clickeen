import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import {
  type SubmittedInstancePublicPackage,
  verifyInstancePublicPackageReady,
  writeInstancePublicPackage,
} from './package-files';
import { PUBLIC_INDEX_FILE, PUBLIC_RUNTIME_FILE, PUBLIC_STYLES_FILE } from './package-file-names';
import { deleteAccountInstanceSubtree } from './delete';
import { accountInstanceRoot } from './keys';
import {
  readAccountInstanceSource,
  writeAccountInstanceSource,
} from './source';
import {
  readInstanceServeState,
  writeInstanceServeState,
} from './serve-state';
import type { AccountInstanceContentDocument, AccountInstanceSourcePointer } from './types';
import { normalizeStorageId } from './utils';
import { deletePrefix } from '../storage';

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
  const publicServingBase = String(args.env.PUBLIC_SERVING_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!zoneId || !token || !publicServingBase) {
    throw new AccountInstanceTransitionError({
      status: 503,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeConfigMissing',
    });
  }
  const base = `${publicServingBase}/${args.accountId}/${args.instanceId}`;
  const files = new Set([
    base,
    `${base}/`,
    `${base}/${PUBLIC_INDEX_FILE}`,
    `${base}/${PUBLIC_STYLES_FILE}`,
    `${base}/${PUBLIC_RUNTIME_FILE}`,
  ]);
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ files: [...files] }),
  });
  const payload = await response.json().catch(() => null) as { success?: unknown } | null;
  if (!response.ok || payload?.success !== true) {
    throw new AccountInstanceTransitionError({
      status: 502,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeFailed',
      detail: `cloudflare_purge_status_${response.status}`,
    });
  }
}

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120 ? trimmed : null;
}

function normalizeSubmittedMeta(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const meta = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const allowedKeys = new Set(['baseLocale', 'styleName', 'name', 'title']);
    for (const key of Object.keys(meta)) {
      if (!allowedKeys.has(key)) {
        throw new AccountInstanceTransitionError({
          status: 422,
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.instance.invalidPayload',
        });
      }
    }
    for (const key of ['baseLocale', 'styleName', 'name', 'title']) {
      const entry = meta[key];
      if (typeof entry === 'string' && entry.trim()) out[key] = entry.trim();
    }
    return out;
  }
  throw new AccountInstanceTransitionError({
    status: 422,
    kind: 'VALIDATION',
    reasonKey: 'coreui.errors.instance.invalidPayload',
  });
}

async function cleanupCreatedInstanceOrThrow(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  detail: string;
}): Promise<never> {
  try {
    await deletePrefix(args.env, `${accountInstanceRoot(args.accountId, '', args.instanceId)}/`);
    await deleteAccountInstanceSubtree(args.env, args.instanceId, args.accountId);
  } catch (cleanupError) {
    throw new AccountInstanceTransitionError({
      status: 500,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.instance.cleanupFailed',
      detail: `${args.detail}; cleanup:${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
    });
  }
  throw new AccountInstanceTransitionError({
    status: 409,
    kind: 'VALIDATION',
    reasonKey: 'coreui.errors.instance.embedNotReady',
    detail: args.detail,
  });
}

export async function createAccountInstanceFromSubmittedSource(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName?: unknown;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  meta: Record<string, unknown>;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<{
  pointer: AccountInstanceSourcePointer;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
}> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const widgetType = normalizeStorageId(args.widgetType);
  if (!widgetType) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.invalidPayload',
    });
  }
  const existing = await readAccountInstanceSource({
    env: args.env,
    accountId,
    instanceId,
  });
  if (existing.ok || existing.kind !== 'NOT_FOUND') {
    throw new AccountInstanceTransitionError({
      status: existing.ok ? 409 : 422,
      kind: 'VALIDATION',
      reasonKey: existing.ok ? 'tokyo.errors.instance.idCollision' : existing.reasonKey,
    });
  }

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
  let saved: { pointer: AccountInstanceSourcePointer };
  try {
    saved = await writeAccountInstanceSource({
      env: args.env,
      accountId,
      instanceId,
      widgetType,
      config: args.config,
      content: args.content,
      displayName: normalizeDisplayName(args.displayName),
      meta: args.meta,
      publicPackageFingerprint: packaged.fingerprint,
    });
  } catch (error) {
    return cleanupCreatedInstanceOrThrow({
      env: args.env,
      accountId,
      instanceId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  return { pointer: saved.pointer, config: args.config, content: args.content };
}

export async function saveAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  submittedWidgetType: string;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  publicPackage: SubmittedInstancePublicPackage;
  displayName?: unknown;
  baseLocale: string;
  hasDisplayName: boolean;
  meta?: unknown;
  hasMeta: boolean;
}): Promise<{
  ok: true;
  pointer: AccountInstanceSourcePointer;
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
  const nextMeta = {
    ...(normalizeSubmittedMeta(args.hasMeta ? args.meta : existing.value.pointer.meta) ?? {}),
    baseLocale: args.baseLocale,
  };
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
  const saved = await writeAccountInstanceSource({
    env: args.env,
    accountId,
    instanceId,
    widgetType: existingWidgetType,
    config: args.config,
    content: args.content,
    displayName: args.hasDisplayName ? args.displayName : existing.value.pointer.displayName,
    meta: nextMeta,
    publicPackageFingerprint: packaged.fingerprint,
  });
  const live = (await readInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: saved.pointer.widgetCode,
  })) === 'published';

  return {
    ok: true,
    pointer: saved.pointer,
    live,
  };
}

export async function publishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{ instanceId: string; status: 'published'; changed: boolean }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const existing = await readAccountInstanceSource({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const packageReady = await verifyInstancePublicPackageReady({
    env: args.env,
    accountId,
    instanceId,
    expectedFingerprint: existing.value.pointer.publicPackageFingerprint ?? null,
  });
  if (!packageReady.ok) {
    throw new AccountInstanceTransitionError({
      status: 409,
      kind: 'VALIDATION',
      reasonKey: packageReady.reasonKey,
      detail: packageReady.detail,
    });
  }

  const liveStatus = await readInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: existing.value.pointer.widgetCode,
  });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  await writeInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: existing.value.pointer.widgetCode,
    status: 'published',
  });
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
  const liveStatus = await readInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: existing.value.pointer.widgetCode,
  });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  if (liveStatus !== 'unpublished') {
    await writeInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      widgetCode: existing.value.pointer.widgetCode,
      status: 'unpublished',
    });
  }
  return { instanceId, status: 'unpublished', changed: liveStatus !== 'unpublished' };
}

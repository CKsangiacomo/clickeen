import { resolveWidgetOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import type { Env } from '../../types';
import {
  writeInstancePublicPackage,
  type SubmittedInstancePublicPackage,
} from './package-files';
import { accountInstanceCachePrefix } from './keys';
import { deleteAccountInstanceSubtree } from './delete';
import {
  listAccountInstanceIds,
  readAccountInstanceSourcePointer,
  writeAccountInstanceSource,
} from './source';
import { writeInstanceServeState } from './serve-state';
import type { AccountInstanceContentDocument, AccountInstanceSourcePointer } from './types';

export class AccountInstanceTransitionError extends Error {
  status: number;
  kind: 'VALIDATION' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  paths?: string[];
  capacity?: { current: number; limit: number };
  committed?: AccountInstancePublicationTransition;

  constructor(args: {
    status: number;
    kind: AccountInstanceTransitionError['kind'];
    reasonKey: string;
    detail?: string;
    issues?: Array<{ path: string }>;
    capacity?: { current: number; limit: number };
    committed?: AccountInstancePublicationTransition;
  }) {
    super(args.detail ?? args.reasonKey);
    this.name = 'AccountInstanceTransitionError';
    this.status = args.status;
    this.kind = args.kind;
    this.reasonKey = args.reasonKey;
    this.paths = args.issues?.map((issue) => issue.path);
    this.capacity = args.capacity;
    this.committed = args.committed;
  }
}

export type AccountInstancePublicationTransition = {
  instanceId: string;
  status: 'published' | 'unpublished';
  changed: boolean;
};

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

export async function purgeClkLiveEntryCache(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<void> {
  const zoneId = String(args.env.CLOUDFLARE_ZONE_ID || '').trim();
  const token = String(args.env.CLOUDFLARE_CACHE_PURGE_TOKEN || '').trim();
  const publicServingBaseUrl = String(args.env.PUBLIC_SERVING_BASE_URL || '').trim();
  if (!zoneId || !token || !publicServingBaseUrl) {
    throw new AccountInstanceTransitionError({
      status: 503,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeConfigMissing',
    });
  }
  let response: Response;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prefixes: [accountInstanceCachePrefix(publicServingBaseUrl, args.accountId, args.instanceId)],
      }),
    });
  } catch (error) {
    throw new AccountInstanceTransitionError({
      status: 502,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeFailed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
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

export async function createAccountInstanceFromSubmittedSource(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  baseLocale: string;
}): Promise<{
  pointer: AccountInstanceSourcePointer;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
}> {
  const { accountId, instanceId, widgetType } = args;
  const existing = await readAccountInstanceSourcePointer({
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

  const saved = await writeAccountInstanceSource({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: resolveWidgetOverlayCode(widgetType)!,
    widgetType,
    config: args.config,
    content: args.content,
    displayName: args.displayName,
    baseLocale: args.baseLocale,
  });
  return { pointer: saved.pointer, config: args.config, content: args.content };
}

export async function saveAccountInstanceSource(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
}): Promise<{
  pointer: AccountInstanceSourcePointer;
}> {
  const { accountId, instanceId } = args;
  const existing = await readAccountInstanceSourcePointer({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const saved = await writeAccountInstanceSource({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: existing.value.widgetCode,
    widgetType: existing.value.widgetType,
    config: args.config,
    content: args.content,
    displayName: existing.value.displayName,
    baseLocale: existing.value.baseLocale,
    existing: {
      createdAt: existing.value.createdAt,
      publishStatus: existing.value.publishStatus,
    },
  });
  return { pointer: saved.pointer };
}

export async function publishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publishedLimit: number;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<{ instanceId: string; status: 'published'; changed: boolean }> {
  const { accountId, instanceId } = args;
  const instanceIds = await listAccountInstanceIds({ env: args.env, accountId });
  const instancePointers = await Promise.all(
    instanceIds.map((listedInstanceId) =>
      readAccountInstanceSourcePointer({
        env: args.env,
        accountId,
        instanceId: listedInstanceId,
      }),
    ),
  );
  const pointers = instancePointers.map((pointer) => {
    if (!pointer.ok) transitionFailureFromSavedRead(pointer);
    return pointer.value;
  });
  const existing = pointers.find((pointer) => pointer.id === instanceId);
  if (!existing) {
    throw new AccountInstanceTransitionError({
      status: 404,
      kind: 'NOT_FOUND',
      reasonKey: 'coreui.errors.instance.notFound',
    });
  }

  const liveStatus = existing.publishStatus;
  const publishedTotal = pointers.filter(
    (pointer) => pointer.publishStatus === 'published',
  ).length;
  if (liveStatus !== 'published' && publishedTotal >= args.publishedLimit) {
    throw new AccountInstanceTransitionError({
      status: 402,
      kind: 'DENY',
      reasonKey: 'coreui.upsell.reason.limitReached',
      capacity: {
        current: publishedTotal,
        limit: args.publishedLimit,
      },
    });
  }

  const packageWrite = await writeInstancePublicPackage({
    env: args.env,
    accountId,
    instanceId,
    publicPackage: args.publicPackage,
  });
  if (!packageWrite.ok) {
    throw new AccountInstanceTransitionError({
      status: 502,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: packageWrite.reasonKey,
      detail: packageWrite.detail,
    });
  }
  await writeInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: existing.widgetCode,
    status: 'published',
  });
  return {
    instanceId,
    status: 'published',
    changed: liveStatus !== 'published',
  };
}

export async function unpublishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{ instanceId: string; status: 'unpublished'; changed: boolean }> {
  const { accountId, instanceId } = args;
  const existing = await readAccountInstanceSourcePointer({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const liveStatus = existing.value.publishStatus;
  if (liveStatus !== 'unpublished') {
    await writeInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      widgetCode: existing.value.widgetCode,
      status: 'unpublished',
    });
  }
  const transition = {
    instanceId,
    status: 'unpublished' as const,
    changed: liveStatus !== 'unpublished',
  };
  try {
    await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  } catch (error) {
    if (error instanceof AccountInstanceTransitionError) {
      error.committed = transition;
    }
    throw error;
  }
  return transition;
}

export async function deleteAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{ existed: boolean }> {
  const { accountId, instanceId } = args;
  const existing = await readAccountInstanceSourcePointer({ env: args.env, accountId, instanceId });
  if (!existing.ok) {
    if (existing.kind === 'NOT_FOUND') {
      await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
      return { existed: false };
    }
    transitionFailureFromSavedRead(existing);
  }
  await deleteAccountInstanceSubtree(
    args.env,
    instanceId,
    accountId,
    existing.value.widgetCode,
  );
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  return { existed: true };
}

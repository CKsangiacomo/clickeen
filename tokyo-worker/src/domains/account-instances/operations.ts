import type { Env } from '../../types';
import type { SubmittedInstancePublicPackage } from './package-files';
import { accountInstanceCacheTag } from './keys';
import { deleteAccountInstanceSourceAnchor } from './delete';
import {
  listAccountInstanceIds,
  nextAccountInstanceTimestamp,
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

  constructor(args: {
    status: number;
    kind: AccountInstanceTransitionError['kind'];
    reasonKey: string;
    detail?: string;
    issues?: Array<{ path: string }>;
    capacity?: { current: number; limit: number };
  }) {
    super(args.detail ?? args.reasonKey);
    this.name = 'AccountInstanceTransitionError';
    this.status = args.status;
    this.kind = args.kind;
    this.reasonKey = args.reasonKey;
    this.paths = args.issues?.map((issue) => issue.path);
    this.capacity = args.capacity;
  }
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

export function scheduleAccountInstanceCacheEviction(args: {
  cache: CacheContext | undefined;
  waitUntil: ExecutionContext['waitUntil'];
  accountId: string;
  instanceId: string;
}): void {
  if (!args.cache) return;
  try {
    args.waitUntil(
      args.cache
        .purge({
          tags: [accountInstanceCacheTag(args.accountId, args.instanceId)],
        })
        .then(
          () => undefined,
          () => undefined,
        ),
    );
  } catch {
    // Cache eviction is a delivery optimization, never product result truth.
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
    widgetType: existing.value.widgetType,
    config: args.config,
    content: args.content,
    displayName: existing.value.displayName,
    baseLocale: existing.value.baseLocale,
    existing: {
      createdAt: existing.value.createdAt,
      updatedAt: existing.value.updatedAt,
      serveState: {
        status: existing.value.publishStatus,
        publishedAt: existing.value.publishedAt,
      },
    },
  });
  return { pointer: saved.pointer };
}

export async function publishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  sourceUpdatedAt: string;
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
  if (existing.updatedAt !== args.sourceUpdatedAt) {
    throw new AccountInstanceTransitionError({
      status: 409,
      kind: 'DENY',
      reasonKey: 'coreui.errors.instance.sourceChanged',
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

  try {
    await writeInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      status: 'published',
      publicPackage: args.publicPackage,
      now: nextAccountInstanceTimestamp(existing.updatedAt, existing.publishedAt),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new AccountInstanceTransitionError({
      status: 502,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: detail.startsWith('artifact.') ? detail : 'artifact.package_write_failed',
      detail,
    });
  }
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
      status: 'unpublished',
    });
  }
  const transition = {
    instanceId,
    status: 'unpublished' as const,
    changed: liveStatus !== 'unpublished',
  };
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
      return { existed: false };
    }
    transitionFailureFromSavedRead(existing);
  }
  await deleteAccountInstanceSourceAnchor(
    args.env,
    instanceId,
    accountId,
  );
  return { existed: true };
}

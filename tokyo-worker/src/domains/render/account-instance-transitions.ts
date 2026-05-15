import { createCompactInstanceId, isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { resolvePolicyFromEntitlementsSnapshot, type RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import type { Env } from '../../types';
import {
  resolveWidgetDefaults,
} from '../widget-catalog';
import { readAccountInstanceIndex } from './instance-index';
import { syncLiveSurface } from './live-surface';
import {
  readInstanceServeState,
  readSavedRenderConfig,
  writeSavedRenderConfig,
} from './saved-config';
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

type AccountAuthzSnapshot = Pick<
  RomaAccountAuthzCapsulePayload,
  'profile' | 'role' | 'entitlements'
>;

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
  accountAuthz: AccountAuthzSnapshot;
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
  accountAuthz: AccountAuthzSnapshot;
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
  accountAuthz: AccountAuthzSnapshot;
}): Promise<{ instanceId: string; status: 'published'; changed: boolean }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const existing = await readSavedRenderConfig({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  if (liveStatus === 'published') {
    await syncLiveSurface(args.env, {
      v: 1,
      kind: 'sync-live-surface',
      accountId,
      instanceId,
      live: true,
      widgetType: existing.value.pointer.widgetType,
      widgetCode: existing.value.pointer.widgetCode,
      configFp: existing.value.pointer.configFp,
    });
    return { instanceId, status: 'published', changed: false };
  }

  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: args.accountAuthz.profile,
    role: args.accountAuthz.role,
    entitlements: args.accountAuthz.entitlements ?? null,
  });
  const publishedLimitRaw = policy.limits['instances.published.max'];
  const publishedLimit =
    typeof publishedLimitRaw === 'number' && Number.isFinite(publishedLimitRaw)
      ? Math.max(0, Math.floor(publishedLimitRaw))
      : null;
  if (publishedLimit != null) {
    if (publishedLimit === 0) {
      throw new AccountInstanceTransitionError({
        status: 403,
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.limitReached',
        detail: `instances.published.max=${publishedLimit}`,
      });
    }
    const index = await readAccountInstanceIndex({
      env: args.env,
      accountId,
    });
    if (!index.ok) {
      throw new AccountInstanceTransitionError({
        status: index.kind === 'NOT_FOUND' ? 404 : 422,
        kind: index.kind === 'NOT_FOUND' ? 'NOT_FOUND' : 'VALIDATION',
        reasonKey: index.reasonKey,
        detail: index.detail,
      });
    }
    const publishedCount = index.value.entries.filter((entry) => entry.publishStatus === 'published').length;
    if (publishedCount >= publishedLimit) {
      throw new AccountInstanceTransitionError({
        status: 403,
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.limitReached',
        detail: `instances.published.max=${publishedLimit}`,
      });
    }
  }

  await syncLiveSurface(args.env, {
    v: 1,
    kind: 'sync-live-surface',
    accountId,
    instanceId,
    live: true,
    widgetType: existing.value.pointer.widgetType,
    widgetCode: existing.value.pointer.widgetCode,
    configFp: existing.value.pointer.configFp,
  });
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
  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  if (liveStatus === 'unpublished') {
    return { instanceId, status: 'unpublished', changed: false };
  }
  await syncLiveSurface(args.env, {
    v: 1,
    kind: 'sync-live-surface',
    accountId,
    instanceId,
    live: false,
    widgetType: existing.value.pointer.widgetType,
  });
  return { instanceId, status: 'unpublished', changed: true };
}

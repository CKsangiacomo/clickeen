import { createCompactInstanceId, isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { resolvePolicy } from '@clickeen/ck-policy';
import type { Env } from '../../types';
import {
  resolveWidgetDefaults,
} from '../widget-catalog';
import {
  deleteInstancePublicArtifacts,
  materializeInstancePublicArtifacts,
  publicArtifactLocaleHtmlFile,
  publicArtifactLocaleScriptFile,
} from './public-artifacts';
import { listInstanceRegistryRows } from './instance-registry';
import {
  readInstanceServeState,
  readSavedRenderConfig,
  writeInstanceServeState,
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

async function purgeClkLiveEntryCache(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locales?: string[];
}): Promise<void> {
  const zoneId = String(args.env.CLOUDFLARE_ZONE_ID || '').trim();
  const token = String(args.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!zoneId || !token) return;
  const publicServingBase =
    String(args.env.PUBLIC_SERVING_BASE_URL || '').trim().replace(/\/+$/, '') || 'https://clk.live';
  const base = `${publicServingBase}/${args.accountId}/${args.instanceId}`;
  const files = new Set([base, `${base}/`, `${base}/index.html`, `${base}/styles.css`, `${base}/script.js`]);
  for (const locale of args.locales ?? []) {
    files.add(`${base}/${publicArtifactLocaleHtmlFile(locale)}`);
    files.add(`${base}/${publicArtifactLocaleScriptFile(locale)}`);
  }
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
  previousConfig: Record<string, unknown>;
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
  const materialized = await materializeInstancePublicArtifacts({ env: args.env, accountId, instanceId });
  if (!materialized.ok) {
    throw new AccountInstanceTransitionError({
      status: 409,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.embedNotReady',
      detail: materialized.detail,
    });
  }

  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  await writeInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetType: materialized.widgetType,
    status: 'published',
  });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId, locales: materialized.locales });
  return { instanceId, status: 'published', changed: liveStatus !== 'published' || materialized.publicFiles.length > 0 };
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
  const deleted = await deleteInstancePublicArtifacts({ env: args.env, accountId, instanceId });
  if (!deleted.ok) {
    throw new AccountInstanceTransitionError({
      status: 409,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.embedNotReady',
      detail: deleted.detail,
    });
  }
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
  return { instanceId, status: 'unpublished', changed: liveStatus !== 'unpublished' || deleted.publicFiles.length > 0 };
}

export type AccountServingPolicyMaterializationResult = {
  accountId: string;
  keptInstanceIds: string[];
  disabledInstanceIds: string[];
  materializedInstanceIds: string[];
  failed: Array<{ instanceId: string; reasonKey: string; detail: string }>;
};

function freePublishedInstanceLimit(): number | null {
  const policy = resolvePolicy({ profile: 'free', role: 'owner' });
  return policy.limits['instances.published.max'] ?? null;
}

function withinLimit(index: number, limit: number | null): boolean {
  return limit == null || index < limit;
}

export async function applyFreeTierServing(args: {
  env: Env;
  accountId: string;
}): Promise<AccountServingPolicyMaterializationResult> {
  const accountId = normalizeStorageId(args.accountId);
  if (!isCompactAccountPublicId(accountId)) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    });
  }
  const publishedRows = (await listInstanceRegistryRows({ env: args.env, accountId }))
    .filter((row) => row.publishStatus === 'published');
  const limit = freePublishedInstanceLimit();
  const keptInstanceIds: string[] = [];
  const disabledInstanceIds: string[] = [];
  const materializedInstanceIds: string[] = [];
  const failed: AccountServingPolicyMaterializationResult['failed'] = [];

  for (const [index, row] of publishedRows.entries()) {
    if (withinLimit(index, limit)) {
      keptInstanceIds.push(row.id);
      const materialized = await materializeInstancePublicArtifacts({
        env: args.env,
        accountId,
        instanceId: row.id,
      });
      if (materialized.ok) {
        materializedInstanceIds.push(row.id);
        await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId: row.id, locales: materialized.locales });
      } else {
        failed.push({ instanceId: row.id, reasonKey: materialized.reasonKey, detail: materialized.detail });
      }
      continue;
    }

    disabledInstanceIds.push(row.id);
    const deleted = await deleteInstancePublicArtifacts({ env: args.env, accountId, instanceId: row.id });
    if (!deleted.ok) {
      failed.push({ instanceId: row.id, reasonKey: deleted.reasonKey, detail: deleted.detail });
    }
    await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId: row.id });
  }

  return { accountId, keptInstanceIds, disabledInstanceIds, materializedInstanceIds, failed };
}

export async function restorePaidTierServing(args: {
  env: Env;
  accountId: string;
}): Promise<AccountServingPolicyMaterializationResult> {
  const accountId = normalizeStorageId(args.accountId);
  if (!isCompactAccountPublicId(accountId)) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    });
  }
  const publishedRows = (await listInstanceRegistryRows({ env: args.env, accountId }))
    .filter((row) => row.publishStatus === 'published');
  const keptInstanceIds = publishedRows.map((row) => row.id);
  const materializedInstanceIds: string[] = [];
  const failed: AccountServingPolicyMaterializationResult['failed'] = [];

  for (const row of publishedRows) {
    const materialized = await materializeInstancePublicArtifacts({
      env: args.env,
      accountId,
      instanceId: row.id,
    });
    if (materialized.ok) {
      materializedInstanceIds.push(row.id);
      await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId: row.id, locales: materialized.locales });
    } else {
      failed.push({ instanceId: row.id, reasonKey: materialized.reasonKey, detail: materialized.detail });
    }
  }

  return { accountId, keptInstanceIds, disabledInstanceIds: [], materializedInstanceIds, failed };
}

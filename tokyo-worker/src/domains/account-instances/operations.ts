import { validateWidgetLocaleSwitcherSettings } from '@clickeen/ck-contracts';
import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import {
  readStoredInstancePublicPackageSnapshot,
  restoreInstancePublicPackageSnapshot,
  type StoredInstancePublicPackageSnapshot,
  type SubmittedInstancePublicPackage,
  verifyInstancePublicPackageReady,
  writeInstancePublicPackage,
} from './package-files';
import { PUBLIC_INDEX_FILE, PUBLIC_RUNTIME_FILE, PUBLIC_STYLES_FILE } from './package-file-names';
import { deleteAccountInstanceSubtree } from './delete';
import { accountInstanceRoot } from './keys';
import {
  readAccountInstanceSource,
  readConfigDocumentByLocation,
  readContentDocumentByLocation,
  writeAccountInstanceSource,
} from './source';
import {
  readInstanceServeState,
  writeInstanceServeState,
} from './serve-state';
import type { AccountInstanceSourcePointer } from './types';
import type {
  AccountInstanceConfigDocument,
  AccountInstanceContentDocument,
  LocaleOverlayDocument,
} from './types';
import { normalizeStorageId } from './utils';
import { accountInstanceConfigKey, accountInstanceContentKey } from './keys';
import { listLocaleOverlaysStrict, writeLocaleOverlay } from '../account-translations/overlays';
import { deletePrefix, putJson } from '../storage';
import { updateInstanceRegistryEditedAt } from './registry';

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

function assertLocaleSwitcherConfig(config: Record<string, unknown>): void {
  const issue = validateWidgetLocaleSwitcherSettings(config.localeSwitcher);
  if (!issue) return;
  throw new AccountInstanceTransitionError({
    status: 422,
    kind: 'VALIDATION',
    reasonKey: issue.reasonKey,
    detail: issue.detail,
    issues: [{ path: issue.path }],
  });
}

async function deleteCreatedInstanceOrThrow(args: {
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
      reasonKey: 'coreui.errors.instance.rollbackFailed',
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

type StoredInstanceSourceSnapshot = {
  configDoc: AccountInstanceConfigDocument;
  contentDoc: AccountInstanceContentDocument;
  overlays: LocaleOverlayDocument[];
  editedAt: string;
};

async function readStoredInstanceSourceSnapshot(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode: string;
  editedAt: string;
}): Promise<StoredInstanceSourceSnapshot> {
  const configDoc = await readConfigDocumentByLocation(args);
  if (!configDoc) throw new Error('coreui.errors.instance.config.invalid');
  const contentDoc = await readContentDocumentByLocation({ ...args, configDoc });
  if (!contentDoc) throw new Error('coreui.errors.instance.content.invalid');
  const overlays = await listLocaleOverlaysStrict(args);
  return {
    configDoc,
    contentDoc,
    overlays,
    editedAt: args.editedAt,
  };
}

async function restoreStoredInstanceSourceSnapshot(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode: string;
  snapshot: StoredInstanceSourceSnapshot;
}): Promise<void> {
  await putJson(
    args.env,
    accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId),
    args.snapshot.configDoc,
  );
  await putJson(
    args.env,
    accountInstanceContentKey(args.accountId, args.widgetCode, args.instanceId),
    args.snapshot.contentDoc,
  );
  for (const overlay of args.snapshot.overlays) {
    await writeLocaleOverlay({
      env: args.env,
      accountId: args.accountId,
      widgetCode: args.widgetCode,
      instanceId: args.instanceId,
      overlay,
    });
  }
  await updateInstanceRegistryEditedAt({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    editedAt: args.snapshot.editedAt,
  });
}

async function restorePreviousSaveStateOrThrow(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode: string;
  sourceSnapshot: StoredInstanceSourceSnapshot;
  packageSnapshot: StoredInstancePublicPackageSnapshot;
  detail: string;
}): Promise<never> {
  const failures: string[] = [];
  try {
    await restoreInstancePublicPackageSnapshot({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      snapshot: args.packageSnapshot,
    });
  } catch (error) {
    failures.push(`package:${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    await restoreStoredInstanceSourceSnapshot({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      widgetCode: args.widgetCode,
      snapshot: args.sourceSnapshot,
    });
  } catch (error) {
    failures.push(`source:${error instanceof Error ? error.message : String(error)}`);
  }
  if (failures.length) {
    throw new AccountInstanceTransitionError({
      status: 500,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.instance.rollbackFailed',
      detail: `${args.detail}; rollback:${failures.join(';')}`,
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
  meta: Record<string, unknown>;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<{ pointer: AccountInstanceSourcePointer; config: Record<string, unknown> }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const widgetType = normalizeStorageId(args.widgetType);
  if (!widgetType) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.invalidPayload',
    });
  }
  assertLocaleSwitcherConfig(args.config);
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
      displayName: normalizeDisplayName(args.displayName),
      meta: args.meta,
    });
  } catch (error) {
    return deleteCreatedInstanceOrThrow({
      env: args.env,
      accountId,
      instanceId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  return { pointer: saved.pointer, config: args.config };
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
  assertLocaleSwitcherConfig(args.config);
  let packageSnapshot: StoredInstancePublicPackageSnapshot;
  let sourceSnapshot: StoredInstanceSourceSnapshot;
  try {
    packageSnapshot = await readStoredInstancePublicPackageSnapshot({ env: args.env, accountId, instanceId });
    sourceSnapshot = await readStoredInstanceSourceSnapshot({
      env: args.env,
      accountId,
      instanceId,
      widgetCode: existing.value.pointer.widgetCode,
      editedAt: existing.value.pointer.updatedAt,
    });
  } catch (error) {
    throw new AccountInstanceTransitionError({
      status: 409,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.embedNotReady',
      detail: error instanceof Error ? error.message : String(error),
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
      widgetType: existingWidgetType,
      config: args.config,
      displayName: args.hasDisplayName ? args.displayName : existing.value.pointer.displayName,
      meta: args.hasMeta ? args.meta : existing.value.pointer.meta ?? null,
    });
  } catch (error) {
    return restorePreviousSaveStateOrThrow({
      env: args.env,
      accountId,
      instanceId,
      widgetCode: existing.value.pointer.widgetCode,
      sourceSnapshot,
      packageSnapshot,
      detail: error instanceof Error ? error.message : String(error),
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
      reasonKey: packageReady.reasonKey,
      detail: packageReady.detail,
    });
  }
  const existing = await readAccountInstanceSource({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);

  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  await writeInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetType: existing.value.pointer.widgetType,
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
  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId });
  if (liveStatus !== 'unpublished') {
    await writeInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      widgetType: existing.value.pointer.widgetType,
      status: 'unpublished',
    });
  }
  return { instanceId, status: 'unpublished', changed: liveStatus !== 'unpublished' };
}

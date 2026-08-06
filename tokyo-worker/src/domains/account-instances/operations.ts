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
import { listLocaleOverlayCoordinates } from '../account-translations/overlays';
import type { AccountInstanceContentDocument, AccountInstanceSourcePointer } from './types';
import type { CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import { normalizeStorageId } from './utils';
import { deletePrefix } from '../storage';
import { PublicCachePurgeError, purgePublicServingFiles } from '../public-cache';

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

export function buildClkLiveEntryCachePurgeFiles(args: {
  publicServingBase: string;
  accountId: string;
  instanceId: string;
  locales?: string[];
}): string[] {
  const base = `${args.publicServingBase.replace(/\/+$/, '')}/${args.accountId}/${args.instanceId}`;
  const files = new Set([
    base,
    `${base}/`,
    `${base}/${PUBLIC_INDEX_FILE}`,
    `${base}/${PUBLIC_STYLES_FILE}`,
    `${base}/${PUBLIC_RUNTIME_FILE}`,
  ]);
  for (const locale of args.locales ?? []) {
    const coordinate = encodeURIComponent(locale);
    files.add(`${base}?locale=${coordinate}`);
    files.add(`${base}/?locale=${coordinate}`);
  }
  return [...files];
}

export function buildClkLiveLocaleCachePurgeFiles(args: {
  publicServingBase: string;
  accountId: string;
  instanceId: string;
  locale: string;
}): string[] {
  const base = `${args.publicServingBase.replace(/\/+$/, '')}/${args.accountId}/${args.instanceId}`;
  const coordinate = encodeURIComponent(args.locale);
  return [`${base}?locale=${coordinate}`, `${base}/?locale=${coordinate}`];
}

async function purgeClkLiveFiles(args: {
  env: Env;
  files: (publicServingBase: string) => string[];
}): Promise<void> {
  const publicServingBase = String(args.env.PUBLIC_SERVING_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!publicServingBase) {
    throw new AccountInstanceTransitionError({
      status: 503,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeConfigMissing',
    });
  }
  try {
    await purgePublicServingFiles({ env: args.env, files: args.files(publicServingBase) });
  } catch (error) {
    if (!(error instanceof PublicCachePurgeError)) throw error;
    throw new AccountInstanceTransitionError({
      status: error.status,
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: error.reasonKey,
      detail: error.message,
    });
  }
}

export async function purgeClkLiveEntryCache(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locales?: string[];
}): Promise<void> {
  await purgeClkLiveFiles({
    env: args.env,
    files: (publicServingBase) => buildClkLiveEntryCachePurgeFiles({ ...args, publicServingBase }),
  });
}

export async function purgeClkLiveLocaleCache(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
}): Promise<void> {
  await purgeClkLiveFiles({
    env: args.env,
    files: (publicServingBase) => buildClkLiveLocaleCachePurgeFiles({ ...args, publicServingBase }),
  });
}

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120 ? trimmed : null;
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
  isTemplate: boolean;
  baseLocale?: string;
  catalogPresentation?: CatalogPresentation;
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
      isTemplate: args.isTemplate,
      ...(args.baseLocale ? { baseLocale: args.baseLocale } : {}),
      ...(args.catalogPresentation ? { catalogPresentation: args.catalogPresentation } : {}),
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
  isTemplate: boolean;
  baseLocale?: string;
  catalogPresentation?: CatalogPresentation;
  hasDisplayName: boolean;
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
  if (existing.value.pointer.isTemplate !== args.isTemplate) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.templateMismatch',
    });
  }
  if (submittedWidgetType !== existingWidgetType) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.widgetMismatch',
      detail: `submitted widgetType "${submittedWidgetType}" does not match Tokyo instance widgetType "${existingWidgetType}"`,
    });
  }
  const live = existing.value.pointer.isTemplate
    ? false
    : (await readInstanceServeState({
        env: args.env,
        accountId,
        instanceId,
        widgetCode: existing.value.pointer.widgetCode,
      })) === 'published';
  const locales = !existing.value.pointer.isTemplate && live
    ? await listLocaleOverlayCoordinates({
        env: args.env,
        accountId,
        widgetCode: existing.value.pointer.widgetCode,
        instanceId,
      })
    : [];
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
    isTemplate: args.isTemplate,
    ...(args.baseLocale ? { baseLocale: args.baseLocale } : {}),
    ...(args.catalogPresentation ? { catalogPresentation: args.catalogPresentation } : {}),
  });
  if (!existing.value.pointer.isTemplate && live) {
    await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId, locales });
  }
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
  if (existing.value.pointer.isTemplate) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.templatePublicForbidden',
    });
  }
  const packageReady = await verifyInstancePublicPackageReady({
    env: args.env,
    accountId,
    instanceId,
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
  const locales = await listLocaleOverlayCoordinates({
    env: args.env,
    accountId,
    widgetCode: existing.value.pointer.widgetCode,
    instanceId,
  });
  await writeInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: existing.value.pointer.widgetCode,
    status: 'published',
  });
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId, locales });
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
  if (existing.value.pointer.isTemplate) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.templatePublicForbidden',
    });
  }
  const liveStatus = await readInstanceServeState({
    env: args.env,
    accountId,
    instanceId,
    widgetCode: existing.value.pointer.widgetCode,
  });
  const locales = await listLocaleOverlayCoordinates({
    env: args.env,
    accountId,
    widgetCode: existing.value.pointer.widgetCode,
    instanceId,
  });
  if (liveStatus !== 'unpublished') {
    await writeInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      widgetCode: existing.value.pointer.widgetCode,
      status: 'unpublished',
    });
  }
  await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId, locales });
  return { instanceId, status: 'unpublished', changed: liveStatus !== 'unpublished' };
}

export async function deleteAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{ existed: boolean }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const existing = await readAccountInstanceSource({ env: args.env, accountId, instanceId });
  if (!existing.ok) {
    if (existing.kind === 'NOT_FOUND') return { existed: false };
    transitionFailureFromSavedRead(existing);
  }
  if (existing.value.pointer.isTemplate) {
    return deleteAccountInstanceSubtree(args.env, instanceId, accountId);
  }
  const locales = await listLocaleOverlayCoordinates({
    env: args.env,
    accountId,
    widgetCode: existing.value.pointer.widgetCode,
    instanceId,
  });
  const deleted = await deleteAccountInstanceSubtree(args.env, instanceId, accountId);
  if (deleted.existed) {
    await purgeClkLiveEntryCache({ env: args.env, accountId, instanceId, locales });
  }
  return deleted;
}

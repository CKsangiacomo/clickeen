import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import type { AccountPageSource, PageLocaleOverlay } from '@clickeen/ck-contracts/pages';
import type { Env } from '../../types';
import { readAccountInstanceSourcePointer } from '../account-instances/source';
import { loadAccountAssetByRef } from '../assets';
import { deletePrefix, putJson } from '../storage';
import {
  isPageLocale,
  parseAccountPageSource,
  parsePageGeneratedFiles,
  parsePageLocaleOverlay,
  parsePageServeState,
  parsePageServingOverlays,
} from './contract';
import {
  accountPageIndexKey,
  accountPagesRoot,
  accountPageLocaleOverlayKey,
  accountPageRoot,
  accountPageRuntimeKey,
  accountPageServeStateKey,
  accountPageServingOverlaysKey,
  accountPageSourceKey,
  accountPageStylesKey,
} from './keys';
import { normalizePageId } from './ids';
import { purgePagePublicCache } from './cache';
import {
  PageOperationError,
  type PageGeneratedFiles,
  type PageServeState,
  type PageServingOverlays,
} from './types';

export { normalizePageId } from './ids';

function assertAccountId(raw: string): string {
  const accountId = String(raw || '').trim().toUpperCase();
  if (!isCompactAccountPublicId(accountId)) {
    throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidAccount' });
  }
  return accountId;
}

function sourceInvalid(paths?: string[]): never {
  throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.sourceInvalid', paths });
}

function overlayInvalid(paths?: string[]): never {
  throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.overlayInvalid', paths });
}

async function loadJson(args: {
  env: Env;
  key: string;
  invalid: (paths?: string[]) => never;
}): Promise<{ exists: true; value: unknown } | { exists: false }> {
  const object = await args.env.TOKYO_R2.get(args.key);
  if (!object) return { exists: false };
  try {
    return { exists: true, value: await object.json() };
  } catch {
    args.invalid([args.key]);
  }
}

async function loadText(args: {
  env: Env;
  key: string;
  expectedContentType: string;
}): Promise<{ exists: true; value: string } | { exists: false }> {
  const object = await args.env.TOKYO_R2.get(args.key);
  if (!object) return { exists: false };
  if (object.httpMetadata?.contentType !== args.expectedContentType) sourceInvalid([args.key]);
  try {
    return { exists: true, value: await object.text() };
  } catch {
    sourceInvalid([args.key]);
  }
}

async function putPageFiles(args: {
  env: Env;
  accountId: string;
  pageId: string;
  files: PageGeneratedFiles;
}): Promise<void> {
  const writes = await Promise.allSettled([
    args.env.TOKYO_R2.put(accountPageIndexKey(args.accountId, args.pageId), args.files.indexHtml, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
    }),
    args.env.TOKYO_R2.put(accountPageStylesKey(args.accountId, args.pageId), args.files.stylesCss, {
      httpMetadata: { contentType: 'text/css; charset=utf-8' },
    }),
    args.env.TOKYO_R2.put(accountPageRuntimeKey(args.accountId, args.pageId), args.files.runtimeJs, {
      httpMetadata: { contentType: 'text/javascript; charset=utf-8' },
    }),
  ]);
  const failed = writes.find((write): write is PromiseRejectedResult => write.status === 'rejected');
  if (failed) throw failed.reason;
}

async function readRequiredPageRuntime(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: AccountPageSource;
}): Promise<{ files: PageGeneratedFiles; overlaysJson: PageServingOverlays; serveState: PageServeState }> {
  if (args.source.isTemplate) sourceInvalid([accountPageSourceKey(args.accountId, args.pageId)]);
  const [index, styles, runtime, overlaysStored, serveStateStored] = await Promise.all([
    loadText({ env: args.env, key: accountPageIndexKey(args.accountId, args.pageId), expectedContentType: 'text/html; charset=utf-8' }),
    loadText({ env: args.env, key: accountPageStylesKey(args.accountId, args.pageId), expectedContentType: 'text/css; charset=utf-8' }),
    loadText({ env: args.env, key: accountPageRuntimeKey(args.accountId, args.pageId), expectedContentType: 'text/javascript; charset=utf-8' }),
    loadJson({ env: args.env, key: accountPageServingOverlaysKey(args.accountId, args.pageId), invalid: sourceInvalid }),
    loadJson({ env: args.env, key: accountPageServeStateKey(args.accountId, args.pageId), invalid: sourceInvalid }),
  ]);
  if (!index.exists || !styles.exists || !runtime.exists || !overlaysStored.exists || !serveStateStored.exists) {
    sourceInvalid([
      ...(!index.exists ? [accountPageIndexKey(args.accountId, args.pageId)] : []),
      ...(!styles.exists ? [accountPageStylesKey(args.accountId, args.pageId)] : []),
      ...(!runtime.exists ? [accountPageRuntimeKey(args.accountId, args.pageId)] : []),
      ...(!overlaysStored.exists ? [accountPageServingOverlaysKey(args.accountId, args.pageId)] : []),
      ...(!serveStateStored.exists ? [accountPageServeStateKey(args.accountId, args.pageId)] : []),
    ]);
  }
  const files = parsePageGeneratedFiles({ indexHtml: index.value, stylesCss: styles.value, runtimeJs: runtime.value });
  const overlaysJson = parsePageServingOverlays(overlaysStored.value, args.source);
  const serveState = parsePageServeState(serveStateStored.value);
  if (!files || !overlaysJson || !serveState) sourceInvalid();
  return { files, overlaysJson, serveState };
}

async function assertPageReferences(args: { env: Env; accountId: string; source: AccountPageSource }): Promise<void> {
  for (const placement of args.source.placements) {
    const instance = await readAccountInstanceSourcePointer({
      env: args.env,
      accountId: args.accountId,
      instanceId: placement.instanceId,
    });
    if (!instance.ok) {
      throw new PageOperationError({
        kind: 'VALIDATION',
        reasonKey: 'tokyo.errors.page.instanceMissing',
        paths: [`placements.${placement.placementId}.instanceId`],
      });
    }
  }
  const assetRef = args.source.values.socialImageAssetRef;
  if (assetRef && !(await loadAccountAssetByRef(args.env, args.accountId, assetRef))) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.assetMissing',
      paths: ['values.socialImageAssetRef'],
    });
  }
}

export async function readAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<AccountPageSource | null> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidPageId' });
  const key = accountPageSourceKey(accountId, pageId);
  const stored = await loadJson({ env: args.env, key, invalid: sourceInvalid });
  if (!stored.exists) return null;
  const source = parseAccountPageSource(stored.value, pageId);
  if (!source) sourceInvalid([key]);
  return source;
}

export async function listAccountPageSources(args: {
  env: Env;
  accountId: string;
}): Promise<{ accountId: string; sources: AccountPageSource[] }> {
  const accountId = assertAccountId(args.accountId);
  const sources: AccountPageSource[] = [];
  let cursor: string | undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix: `${accountPagesRoot(accountId)}/`, cursor });
    for (const object of listed.objects) {
      if (!object.key.endsWith('/source.json')) continue;
      const pageId = normalizePageId(object.key.split('/').at(-2));
      if (!pageId) sourceInvalid([object.key]);
      const source = await readAccountPageSource({ env: args.env, accountId, pageId });
      if (!source) sourceInvalid([object.key]);
      sources.push(source);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return { accountId, sources };
}

export async function createAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
  files: unknown;
  overlaysJson: unknown;
}): Promise<{ source: AccountPageSource; files: PageGeneratedFiles; overlaysJson: PageServingOverlays; serveState: PageServeState }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidPageId' });
  if (await readAccountPageSource({ env: args.env, accountId, pageId })) {
    throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.alreadyExists' });
  }
  const source = parseAccountPageSource(args.source, pageId);
  if (!source || source.isTemplate) sourceInvalid();
  const files = parsePageGeneratedFiles(args.files);
  const overlaysJson = parsePageServingOverlays(args.overlaysJson, source);
  if (!files || !overlaysJson) sourceInvalid();
  await assertPageReferences({ env: args.env, accountId, source });
  await putPageFiles({ env: args.env, accountId, pageId, files });
  await putJson(args.env, accountPageServingOverlaysKey(accountId, pageId), overlaysJson);
  const serveState = { published: false } as const;
  await putJson(args.env, accountPageServeStateKey(accountId, pageId), serveState);
  await putJson(args.env, accountPageSourceKey(accountId, pageId), source);
  return { source, files, overlaysJson, serveState };
}

export async function saveAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
  files: unknown;
  overlaysJson: unknown;
}): Promise<{ source: AccountPageSource; files: PageGeneratedFiles; overlaysJson: PageServingOverlays; serveState: PageServeState }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidPageId' });
  const existing = await readAccountPageSource({ env: args.env, accountId, pageId });
  if (!existing) {
    throw new PageOperationError({ kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' });
  }
  const current = await readRequiredPageRuntime({ env: args.env, accountId, pageId, source: existing });
  const source = parseAccountPageSource(args.source, pageId);
  if (!source || source.isTemplate) sourceInvalid();
  const files = parsePageGeneratedFiles(args.files);
  const overlaysJson = parsePageServingOverlays(args.overlaysJson, source);
  if (!files || !overlaysJson) sourceInvalid();
  await assertPageReferences({ env: args.env, accountId, source });
  await putPageFiles({ env: args.env, accountId, pageId, files });
  await putJson(args.env, accountPageServingOverlaysKey(accountId, pageId), overlaysJson);
  await putJson(args.env, accountPageSourceKey(accountId, pageId), source);
  if (current.serveState.published) {
    await purgePagePublicCache({
      env: args.env,
      accountId,
      pageId,
      locales: [
        existing.baseLocale!,
        ...Object.keys(current.overlaysJson),
        source.baseLocale,
        ...Object.keys(overlaysJson),
      ],
    });
  }
  return { source, files, overlaysJson, serveState: current.serveState };
}

export async function readAccountPage(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<{ source: Extract<AccountPageSource, { isTemplate: false }>; files: PageGeneratedFiles; overlaysJson: PageServingOverlays; serveState: PageServeState } | null> {
  const source = await readAccountPageSource(args);
  if (!source) return null;
  if (source.isTemplate) sourceInvalid([accountPageSourceKey(args.accountId, args.pageId)]);
  const runtime = await readRequiredPageRuntime({ ...args, source });
  return { source, ...runtime };
}

export async function publishAccountPage(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<{ published: true; changed: boolean }> {
  const page = await readAccountPage(args);
  if (!page) throw new PageOperationError({ kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' });
  if (page.source.isTemplate || page.source.placements.length === 0) {
    throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.publishInvalid' });
  }
  const changed = !page.serveState.published;
  await putJson(args.env, accountPageServeStateKey(assertAccountId(args.accountId), normalizePageId(args.pageId)!), { published: true });
  await purgePagePublicCache({
    env: args.env,
    accountId: args.accountId,
    pageId: args.pageId,
    locales: [page.source.baseLocale, ...Object.keys(page.overlaysJson)],
  });
  return { published: true, changed };
}

export async function unpublishAccountPage(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<{ published: false; changed: boolean }> {
  const page = await readAccountPage(args);
  if (!page) throw new PageOperationError({ kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' });
  const changed = page.serveState.published;
  await putJson(args.env, accountPageServeStateKey(assertAccountId(args.accountId), normalizePageId(args.pageId)!), { published: false });
  await purgePagePublicCache({
    env: args.env,
    accountId: args.accountId,
    pageId: args.pageId,
    locales: [page.source.baseLocale, ...Object.keys(page.overlaysJson)],
  });
  return { published: false, changed };
}

export async function readAccountPageLocaleOverlay(args: {
  env: Env;
  accountId: string;
  pageId: string;
  locale: string;
}): Promise<PageLocaleOverlay | null> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId || !isPageLocale(args.locale)) overlayInvalid();
  const source = await readAccountPageSource({ env: args.env, accountId, pageId });
  if (!source || source.isTemplate || args.locale === source.baseLocale) overlayInvalid();
  const key = accountPageLocaleOverlayKey(accountId, pageId, args.locale);
  const stored = await loadJson({ env: args.env, key, invalid: overlayInvalid });
  if (!stored.exists) return null;
  const overlay = parsePageLocaleOverlay(stored.value, source);
  if (!overlay) overlayInvalid([key]);
  return overlay;
}

export async function writeAccountPageLocaleOverlay(args: {
  env: Env;
  accountId: string;
  pageId: string;
  locale: string;
  overlay: unknown;
}): Promise<{ overlay: PageLocaleOverlay }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId || !isPageLocale(args.locale)) overlayInvalid();
  const source = await readAccountPageSource({ env: args.env, accountId, pageId });
  if (!source || source.isTemplate || args.locale === source.baseLocale) overlayInvalid();
  const overlay = parsePageLocaleOverlay(args.overlay, source);
  if (!overlay) overlayInvalid();
  await putJson(args.env, accountPageLocaleOverlayKey(accountId, pageId, args.locale), overlay);
  return { overlay };
}

export async function deleteAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<{ existed: boolean }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidPageId' });
  const page = await readAccountPage({ env: args.env, accountId, pageId });
  if (!page) return { existed: false };
  if (page.serveState.published) {
    throw new PageOperationError({ kind: 'DENY', reasonKey: 'tokyo.errors.page.deletePublished' });
  }
  const locales = [page.source.baseLocale, ...Object.keys(page.overlaysJson)];
  await deletePrefix(args.env, `${accountPageRoot(accountId, pageId)}/`);
  await purgePagePublicCache({ env: args.env, accountId, pageId, locales });
  return { existed: true };
}

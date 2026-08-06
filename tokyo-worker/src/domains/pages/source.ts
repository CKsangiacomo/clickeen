import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import type { AccountPageSource, PageLocaleOverlay } from '@clickeen/ck-contracts/pages';
import type { Env } from '../../types';
import { readAccountInstanceSourcePointer } from '../account-instances/source';
import { loadAccountAssetByRef } from '../assets';
import { deletePrefix, putJson } from '../storage';
import { isPageLocale, parseAccountPageSource, parsePageLocaleOverlay } from './contract';
import {
  accountPagesRoot,
  accountPageLocaleOverlayKey,
  accountPageRoot,
  accountPageSourceKey,
} from './keys';
import { normalizePageId } from './ids';
import { PageOperationError } from './types';

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
}): Promise<{ source: AccountPageSource }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidPageId' });
  if (await readAccountPageSource({ env: args.env, accountId, pageId })) {
    throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.alreadyExists' });
  }
  const source = parseAccountPageSource(args.source, pageId);
  if (!source) sourceInvalid();
  await assertPageReferences({ env: args.env, accountId, source });
  await putJson(args.env, accountPageSourceKey(accountId, pageId), source);
  return { source };
}

export async function saveAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
}): Promise<{ source: AccountPageSource }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidPageId' });
  if (!(await readAccountPageSource({ env: args.env, accountId, pageId }))) {
    throw new PageOperationError({ kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' });
  }
  const source = parseAccountPageSource(args.source, pageId);
  if (!source) sourceInvalid();
  await assertPageReferences({ env: args.env, accountId, source });
  await putJson(args.env, accountPageSourceKey(accountId, pageId), source);
  return { source };
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
  if (!(await readAccountPageSource({ env: args.env, accountId, pageId }))) return { existed: false };
  await deletePrefix(args.env, `${accountPageRoot(accountId, pageId)}/`);
  return { existed: true };
}

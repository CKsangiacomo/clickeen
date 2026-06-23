import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import { deletePrefix, putJson } from '../storage';
import {
  accountPagesRoot,
  accountPageRoot,
  accountPageSourceKey,
} from './keys';
import { normalizePageId } from './ids';
import { readAccountPageServeState } from './serve-state';
import { PageOperationError } from './types';

export { normalizePageId } from './ids';

function assertAccountId(accountId: string): string {
  const normalized = String(accountId || '').trim().toUpperCase();
  if (!isCompactAccountPublicId(normalized)) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidAccount',
    });
  }
  return normalized;
}

function failSourceInvalid(paths?: string[]): never {
  throw new PageOperationError({
    kind: 'VALIDATION',
    reasonKey: 'tokyo.errors.page.sourceInvalid',
    ...(paths ? { paths } : {}),
  });
}

async function loadStoredPageSource(args: {
  env: Env;
  key: string;
}): Promise<{ exists: true; value: unknown } | { exists: false }> {
  const obj = await args.env.TOKYO_R2.get(args.key);
  if (!obj) return { exists: false };
  try {
    return { exists: true, value: await obj.json() };
  } catch {
    failSourceInvalid([args.key]);
  }
}

export async function readAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<unknown | null> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  const source = await loadStoredPageSource({
    env: args.env,
    key: accountPageSourceKey(accountId, pageId),
  });
  if (!source.exists) return null;
  await readAccountPageServeState({ env: args.env, accountId, pageId });
  return source.value;
}

export async function listAccountPageSources(args: {
  env: Env;
  accountId: string;
}): Promise<{ accountId: string; sources: unknown[] }> {
  const accountId = assertAccountId(args.accountId);
  const sources: unknown[] = [];
  let cursor: string | undefined = undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({
      prefix: `${accountPagesRoot(accountId)}/`,
      cursor,
    });
    for (const object of listed.objects) {
      if (!object.key.endsWith('/source.json')) continue;
      const pageId = normalizePageId(object.key.split('/').at(-2));
      if (!pageId) {
        failSourceInvalid([object.key]);
      }
      const source = await readAccountPageSource({ env: args.env, accountId, pageId });
      if (!source) failSourceInvalid([object.key]);
      sources.push(source);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return { accountId, sources };
}

export async function saveAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
}): Promise<{ source: unknown }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  const previous = await readAccountPageSource({ env: args.env, accountId, pageId });
  if (!previous) {
    throw new PageOperationError({
      kind: 'NOT_FOUND',
      reasonKey: 'tokyo.errors.page.notFound',
    });
  }
  await putJson(args.env, accountPageSourceKey(accountId, pageId), args.source);
  return { source: args.source };
}

export async function createAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
}): Promise<{ source: unknown }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  const previous = await readAccountPageSource({ env: args.env, accountId, pageId });
  if (previous) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.alreadyExists',
    });
  }
  await putJson(args.env, accountPageSourceKey(accountId, pageId), args.source);
  return { source: args.source };
}

export async function deleteAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<{ existed: boolean }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  const previous = await readAccountPageSource({ env: args.env, accountId, pageId });
  if (!previous) return { existed: false };
  await deletePrefix(args.env, `${accountPageRoot(accountId, pageId)}/`);
  return { existed: true };
}

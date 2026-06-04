import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import { loadJson, putJson } from '../storage';
import { accountPageServeStateKey } from './keys';
import { normalizePageId, readAccountPageSource } from './source';
import type { AccountPageServeState, PageServeState } from './types';
import { PageOperationError } from './types';

function assertPageCoordinate(args: {
  accountId: string;
  pageId: string;
}): { accountId: string; pageId: string } {
  const accountId = String(args.accountId || '').trim().toUpperCase();
  const pageId = normalizePageId(args.pageId);
  if (!isCompactAccountPublicId(accountId)) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidAccount',
    });
  }
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  return { accountId, pageId };
}

function normalizeServeState(raw: unknown, args: {
  accountId: string;
  pageId: string;
}): AccountPageServeState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1 || record.accountId !== args.accountId || record.pageId !== args.pageId) return null;
  if (record.status !== 'published' && record.status !== 'unpublished') return null;
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : '';
  const publishedAt = typeof record.publishedAt === 'string' ? record.publishedAt : undefined;
  if (!updatedAt) return null;
  return {
    v: 1,
    accountId: args.accountId,
    pageId: args.pageId,
    status: record.status,
    ...(publishedAt ? { publishedAt } : {}),
    updatedAt,
  };
}

export async function readAccountPageServeState(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<PageServeState> {
  const coordinate = assertPageCoordinate(args);
  const stored = await loadJson<AccountPageServeState>(
    args.env,
    accountPageServeStateKey(coordinate.accountId, coordinate.pageId),
  );
  const state = normalizeServeState(stored, coordinate);
  return state?.status ?? 'unpublished';
}

export async function writeAccountPageServeState(args: {
  env: Env;
  accountId: string;
  pageId: string;
  status: PageServeState;
  now?: string;
}): Promise<{ status: PageServeState; changed: boolean }> {
  const coordinate = assertPageCoordinate(args);
  if (args.status !== 'published' && args.status !== 'unpublished') {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.serveStateInvalid',
    });
  }
  const source = await readAccountPageSource({
    env: args.env,
    accountId: coordinate.accountId,
    pageId: coordinate.pageId,
  });
  if (!source) {
    throw new PageOperationError({
      kind: 'NOT_FOUND',
      reasonKey: 'tokyo.errors.page.notFound',
    });
  }
  const previous = await readAccountPageServeState({
    env: args.env,
    accountId: coordinate.accountId,
    pageId: coordinate.pageId,
  });
  const now = args.now ?? new Date().toISOString();
  const payload: AccountPageServeState = {
    v: 1,
    accountId: coordinate.accountId,
    pageId: coordinate.pageId,
    status: args.status,
    ...(args.status === 'published' ? { publishedAt: now } : {}),
    updatedAt: now,
  };
  await putJson(args.env, accountPageServeStateKey(coordinate.accountId, coordinate.pageId), payload);
  return { status: args.status, changed: previous !== args.status };
}

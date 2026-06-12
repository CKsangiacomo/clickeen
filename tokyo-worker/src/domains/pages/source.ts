import { isRecord } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isCompactPageId,
} from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import { deletePrefix, loadJson, putJson } from '../storage';
import {
  accountPageRoot,
  accountPageSourceKey,
  accountPagesIndexKey,
} from './keys';
import type {
  AccountPageSummary,
  AccountPagesIndex,
} from './types';
import { PageOperationError } from './types';

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

export function normalizePageId(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return isCompactPageId(normalized) ? normalized : null;
}

function normalizeRobots(value: unknown): AccountPageSummary['robots'] | null {
  if (value === 'index,follow' || value === 'noindex,nofollow') return value;
  return null;
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
  const source = await loadJson<unknown>(args.env, accountPageSourceKey(accountId, pageId));
  if (source == null) return null;
  assertSubmittedPageSourceCoordinate({ source, accountId, pageId });
  return source;
}

function assertSubmittedPageSourceCoordinate(args: {
  source: unknown;
  accountId: string;
  pageId: string;
}): void {
  if (!isRecord(args.source)) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.sourceInvalid',
    });
  }
  const pageId = normalizePageId(args.source.pageId);
  const accountPublicId = typeof args.source.accountPublicId === 'string' ? args.source.accountPublicId.trim().toUpperCase() : '';
  if (pageId !== args.pageId || accountPublicId !== args.accountId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.sourceInvalid',
    });
  }
}

function normalizeSubmittedPageSummary(value: unknown, args: {
  pageId: string;
  previous: AccountPageSummary | null;
}): AccountPageSummary | null {
  if (!isRecord(value)) return null;
  const pageId = typeof value.pageId === 'string' ? value.pageId : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const robots = normalizeRobots(value.robots);
  const placementCount = typeof value.placementCount === 'number' && Number.isInteger(value.placementCount) && value.placementCount >= 0 ? value.placementCount : null;
  const updatedAt = typeof value.updatedAt === 'string' && value.updatedAt.trim() ? value.updatedAt.trim() : '';
  const submittedCreatedAt = typeof value.createdAt === 'string' && value.createdAt.trim() ? value.createdAt.trim() : '';
  if (pageId !== args.pageId || !title || !robots || placementCount == null || !updatedAt) return null;
  return {
    pageId,
    title,
    description,
    robots,
    placementCount,
    createdAt: args.previous?.createdAt ?? (submittedCreatedAt || updatedAt),
    updatedAt,
  };
}

async function readPagesIndex(env: Env, accountId: string): Promise<AccountPagesIndex> {
  const obj = await env.TOKYO_R2.get(accountPagesIndexKey(accountId));
  if (!obj) throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.indexMissing' });
  let stored: unknown;
  try {
    stored = await obj.json();
  } catch {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.indexInvalid',
    });
  }
  if (!isRecord(stored) || stored.v !== 1 || stored.accountId !== accountId || !Array.isArray(stored.pages)) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.indexInvalid',
    });
  }
  stored.pages.forEach((page, index) => {
    if (!isRecord(page) || normalizePageId(page.pageId) !== page.pageId || typeof page.title !== 'string' || typeof page.description !== 'string' || normalizeRobots(page.robots) == null || typeof page.placementCount !== 'number' || !Number.isInteger(page.placementCount) || page.placementCount < 0 || typeof page.createdAt !== 'string' || typeof page.updatedAt !== 'string') {
      throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.indexInvalid', paths: [`pages.${index}`] });
    }
  });
  return stored as AccountPagesIndex;
}

async function preparePageSummaryForIndex(args: {
  env: Env;
  accountId: string;
  pageId: string;
  summary: unknown;
}): Promise<{ index: AccountPagesIndex; summary: AccountPageSummary }> {
  const index = await readPagesIndex(args.env, args.accountId);
  const previous = index.pages.find((page) => page.pageId === args.pageId) ?? null;
  const summary = normalizeSubmittedPageSummary(args.summary, { pageId: args.pageId, previous });
  if (!summary) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.summaryInvalid',
    });
  }
  return { index, summary };
}

async function writePagesIndex(args: {
  env: Env;
  accountId: string;
  pageId: string;
  index: AccountPagesIndex;
  summary: AccountPageSummary;
}): Promise<AccountPageSummary> {
  const pages = [
    args.summary,
    ...args.index.pages.filter((page) => page.pageId !== args.pageId),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.pageId.localeCompare(right.pageId));
  await putJson(args.env, accountPagesIndexKey(args.accountId), { v: 1, accountId: args.accountId, pages });
  return args.summary;
}

export async function listAccountPages(args: {
  env: Env;
  accountId: string;
}): Promise<AccountPagesIndex> {
  const accountId = assertAccountId(args.accountId);
  return readPagesIndex(args.env, accountId);
}

export async function saveAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
  summary: unknown;
}): Promise<{ source: unknown; summary: AccountPageSummary }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  assertSubmittedPageSourceCoordinate({ source: args.source, accountId, pageId });
  const prepared = await preparePageSummaryForIndex({
    env: args.env,
    accountId,
    pageId,
    summary: args.summary,
  });
  await putJson(args.env, accountPageSourceKey(accountId, pageId), args.source);
  const summary = await writePagesIndex({
    env: args.env,
    accountId,
    pageId,
    index: prepared.index,
    summary: prepared.summary,
  });
  return { source: args.source, summary };
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
  const index = await readPagesIndex(args.env, accountId);
  if (!index.pages.some((page) => page.pageId === pageId)) throw new PageOperationError({ kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.indexInvalid' });
  const previous = await readAccountPageSource({ env: args.env, accountId, pageId });
  if (!previous) return { existed: false };
  await deletePrefix(args.env, `${accountPageRoot(accountId, pageId)}/`);
  await putJson(args.env, accountPagesIndexKey(accountId), { v: 1, accountId, pages: index.pages.filter((page) => page.pageId !== pageId) });
  return { existed: true };
}

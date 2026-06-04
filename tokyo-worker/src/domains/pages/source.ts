import { isRecord } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isCompactInstanceId,
  createCompactPageId,
  isCompactPageId,
} from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import { resolveAccountInstanceLocation } from '../account-instances/registry';
import { deletePrefix, loadJson, putJson } from '../storage';
import {
  accountPageRoot,
  accountPageSourceKey,
  accountPagesIndexKey,
  accountPlacementIndexKey,
} from './keys';
import type {
  AccountPageSource,
  AccountPageSummary,
  AccountPagesIndex,
  AccountPlacementIndex,
  PageHead,
  PagePlacement,
  PageRobots,
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

function normalizeRobots(value: unknown): PageRobots | null {
  if (value === 'index,follow' || value === 'noindex,nofollow') return value;
  return null;
}

function normalizeHead(value: unknown): PageHead | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const robots = normalizeRobots(value.robots);
  if (!title || title.length > 160 || description.length > 300 || !robots) return null;
  return { title, description, robots };
}

function normalizePlacement(value: unknown): PagePlacement | null {
  if (!isRecord(value)) return null;
  const instanceId = typeof value.instanceId === 'string' ? value.instanceId.trim().toUpperCase() : '';
  if (!isCompactInstanceId(instanceId)) return null;
  return { instanceId };
}

function normalizePlacements(value: unknown): PagePlacement[] | null {
  if (!Array.isArray(value)) return null;
  const placements = value.map(normalizePlacement);
  if (placements.some((placement) => !placement)) return null;
  return placements as PagePlacement[];
}

async function validatePlacementInstances(args: {
  env: Env;
  accountId: string;
  placements: PagePlacement[];
}): Promise<void> {
  const missing: string[] = [];
  await Promise.all(
    args.placements.map(async (placement, index) => {
      const location = await resolveAccountInstanceLocation({
        env: args.env,
        accountId: args.accountId,
        instanceId: placement.instanceId,
      });
      if (!location) missing.push(`placements.${index}.instanceId`);
    }),
  );
  if (missing.length) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.placementInstanceInvalid',
      paths: missing,
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
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  const source = await loadJson<AccountPageSource>(args.env, accountPageSourceKey(accountId, pageId));
  return source ? parseStoredPageSource(source, pageId) : null;
}

function parseStoredPageSource(raw: unknown, expectedPageId: string): AccountPageSource {
  const source = normalizePageSource(raw, expectedPageId);
  if (!source) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.sourceInvalid',
    });
  }
  return source;
}

function normalizePageSource(raw: unknown, expectedPageId: string): AccountPageSource | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const id = normalizePageId(raw.id);
  const head = normalizeHead(raw.head);
  const placements = normalizePlacements(raw.placements);
  if (!id || id !== expectedPageId || !head || !placements) return null;
  return { v: 1, id, head, placements };
}

function pageSummaryFromSource(source: AccountPageSource, previous: AccountPageSummary | null, now: string): AccountPageSummary {
  return {
    id: source.id,
    title: source.head.title,
    description: source.head.description,
    robots: source.head.robots,
    placementCount: source.placements.length,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

async function readPagesIndex(env: Env, accountId: string): Promise<AccountPagesIndex> {
  const stored = await loadJson<AccountPagesIndex>(env, accountPagesIndexKey(accountId));
  if (!stored || stored.v !== 1 || stored.accountId !== accountId || !Array.isArray(stored.pages)) {
    return { v: 1, accountId, pages: [] };
  }
  return {
    v: 1,
    accountId,
    pages: stored.pages.filter((page): page is AccountPageSummary => {
      return (
        isRecord(page) &&
        typeof page.id === 'string' &&
        typeof page.title === 'string' &&
        typeof page.description === 'string' &&
        normalizeRobots(page.robots) != null &&
        typeof page.placementCount === 'number' &&
        Number.isFinite(page.placementCount) &&
        typeof page.createdAt === 'string' &&
        typeof page.updatedAt === 'string'
      );
    }),
  };
}

async function writePagesIndex(args: {
  env: Env;
  accountId: string;
  source: AccountPageSource;
  now: string;
}): Promise<AccountPageSummary> {
  const index = await readPagesIndex(args.env, args.accountId);
  const previous = index.pages.find((page) => page.id === args.source.id) ?? null;
  const summary = pageSummaryFromSource(args.source, previous, args.now);
  const pages = [
    summary,
    ...index.pages.filter((page) => page.id !== args.source.id),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
  await putJson(args.env, accountPagesIndexKey(args.accountId), { v: 1, accountId: args.accountId, pages });
  return summary;
}

async function removePageFromPagesIndex(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<void> {
  const index = await readPagesIndex(args.env, args.accountId);
  await putJson(args.env, accountPagesIndexKey(args.accountId), {
    v: 1,
    accountId: args.accountId,
    pages: index.pages.filter((page) => page.id !== args.pageId),
  });
}

async function readPlacementIndex(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<AccountPlacementIndex> {
  const stored = await loadJson<AccountPlacementIndex>(
    args.env,
    accountPlacementIndexKey(args.accountId, args.instanceId),
  );
  if (!stored || stored.v !== 1 || stored.accountId !== args.accountId || stored.instanceId !== args.instanceId || !Array.isArray(stored.pageIds)) {
    return { v: 1, accountId: args.accountId, instanceId: args.instanceId, pageIds: [], updatedAt: new Date(0).toISOString() };
  }
  return {
    v: 1,
    accountId: args.accountId,
    instanceId: args.instanceId,
    pageIds: stored.pageIds.filter((pageId) => normalizePageId(pageId)),
    updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : new Date(0).toISOString(),
  };
}

async function writePlacementIndex(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  pageIds: string[];
  now: string;
}): Promise<void> {
  await putJson(args.env, accountPlacementIndexKey(args.accountId, args.instanceId), {
    v: 1,
    accountId: args.accountId,
    instanceId: args.instanceId,
    pageIds: Array.from(new Set(args.pageIds)).sort(),
    updatedAt: args.now,
  });
}

async function updatePlacementIndexes(args: {
  env: Env;
  accountId: string;
  pageId: string;
  previous: AccountPageSource | null;
  next: AccountPageSource | null;
  now: string;
}): Promise<void> {
  const previousIds = new Set(args.previous?.placements.map((placement) => placement.instanceId) ?? []);
  const nextIds = new Set(args.next?.placements.map((placement) => placement.instanceId) ?? []);
  const touchedIds = new Set([...previousIds, ...nextIds]);
  await Promise.all(
    [...touchedIds].map(async (instanceId) => {
      const index = await readPlacementIndex({
        env: args.env,
        accountId: args.accountId,
        instanceId,
      });
      const withoutPage = index.pageIds.filter((pageId) => pageId !== args.pageId);
      const pageIds = nextIds.has(instanceId) ? [...withoutPage, args.pageId] : withoutPage;
      await writePlacementIndex({
        env: args.env,
        accountId: args.accountId,
        instanceId,
        pageIds,
        now: args.now,
      });
    }),
  );
}

export async function listAccountPages(args: {
  env: Env;
  accountId: string;
}): Promise<AccountPagesIndex> {
  const accountId = assertAccountId(args.accountId);
  return readPagesIndex(args.env, accountId);
}

export async function listPagesPlacingInstance(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<string[]> {
  const accountId = assertAccountId(args.accountId);
  const instanceId = typeof args.instanceId === 'string' ? args.instanceId.trim().toUpperCase() : '';
  if (!isCompactInstanceId(instanceId)) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidInstanceId',
    });
  }
  const index = await readPlacementIndex({ env: args.env, accountId, instanceId });
  return index.pageIds;
}

export async function saveAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
  now?: string;
}): Promise<{ source: AccountPageSource; summary: AccountPageSummary }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  const source = normalizePageSource(args.source, pageId);
  if (!source) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.sourceInvalid',
    });
  }
  await validatePlacementInstances({ env: args.env, accountId, placements: source.placements });
  const previous = await readAccountPageSource({ env: args.env, accountId, pageId });
  const now = args.now ?? new Date().toISOString();
  await putJson(args.env, accountPageSourceKey(accountId, pageId), source);
  const summary = await writePagesIndex({ env: args.env, accountId, source, now });
  await updatePlacementIndexes({
    env: args.env,
    accountId,
    pageId,
    previous,
    next: source,
    now,
  });
  return { source, summary };
}

export async function validateAccountPageSourceCandidate(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
}): Promise<AccountPageSource> {
  const accountId = assertAccountId(args.accountId);
  const pageId = normalizePageId(args.pageId);
  if (!pageId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidPageId',
    });
  }
  const source = normalizePageSource(args.source, pageId);
  if (!source) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.sourceInvalid',
    });
  }
  await validatePlacementInstances({ env: args.env, accountId, placements: source.placements });
  return source;
}

export async function createAccountPageSource(args: {
  env: Env;
  accountId: string;
  head?: unknown;
  placements?: unknown;
  now?: string;
}): Promise<{ source: AccountPageSource; summary: AccountPageSummary }> {
  const accountId = assertAccountId(args.accountId);
  const pageId = createCompactPageId();
  const head = isRecord(args.head) ? args.head : {};
  const source = {
    v: 1,
    id: pageId,
    head: {
      title: typeof head.title === 'string' && head.title.trim() ? head.title.trim() : 'Untitled page',
      description: typeof head.description === 'string' ? head.description.trim() : '',
      robots: head.robots === 'noindex,nofollow' ? 'noindex,nofollow' : 'index,follow',
    },
    placements: Array.isArray(args.placements) ? args.placements : [],
  };
  return saveAccountPageSource({
    env: args.env,
    accountId,
    pageId,
    source,
    now: args.now,
  });
}

export async function deleteAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  now?: string;
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
  await removePageFromPagesIndex({ env: args.env, accountId, pageId });
  await updatePlacementIndexes({
    env: args.env,
    accountId,
    pageId,
    previous,
    next: null,
    now: args.now ?? new Date().toISOString(),
  });
  return { existed: true };
}

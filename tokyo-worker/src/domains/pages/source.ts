import { isRecord } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isCompactInstanceId,
  isCompactPageId,
} from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
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
  PageLocalization,
  PageMetadata,
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

function normalizeCanonicalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeMetadata(value: unknown): PageMetadata | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const robots = normalizeRobots(value.robots);
  if (!title || title.length > 160 || description.length > 300 || !robots) return null;
  const canonicalUrl = normalizeCanonicalUrl(value.canonicalUrl);
  return { title, description, robots, ...(canonicalUrl ? { canonicalUrl } : {}) };
}

function normalizeLocale(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z]{2}(?:-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : null;
}

function normalizeLocalization(value: unknown): PageLocalization | null {
  if (!isRecord(value)) return null;
  const defaultLocale = normalizeLocale(value.defaultLocale);
  if (!defaultLocale) return null;
  const countryLocaleRules = Array.isArray(value.countryLocaleRules)
    ? value.countryLocaleRules.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const country = typeof entry.country === 'string' ? entry.country.trim().toUpperCase() : '';
        const locale = normalizeLocale(entry.locale);
        return /^[A-Z]{2}$/.test(country) && locale ? [{ country, locale }] : [];
      })
    : null;
  if (!countryLocaleRules) return null;
  return {
    defaultLocale,
    ipLocalizationEnabled: value.ipLocalizationEnabled === true,
    countryLocaleRules,
    languageSwitcherEnabled: value.languageSwitcherEnabled === true,
    missingLocaleBehavior: 'block_publish',
  };
}

function normalizePlacement(value: unknown): PagePlacement | null {
  if (!isRecord(value)) return null;
  const placementId = typeof value.placementId === 'string' ? value.placementId.trim().toUpperCase() : '';
  const instanceId = typeof value.instanceId === 'string' ? value.instanceId.trim().toUpperCase() : '';
  if (!placementId || !/^[A-Z0-9_-]{1,40}$/.test(placementId)) return null;
  if (!isCompactInstanceId(instanceId)) return null;
  return { placementId, instanceId };
}

function normalizePlacements(value: unknown): PagePlacement[] | null {
  if (!Array.isArray(value)) return null;
  const placements = value.map(normalizePlacement);
  if (placements.some((placement) => !placement)) return null;
  return placements as PagePlacement[];
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
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const pageId = normalizePageId(raw.pageId);
  const accountPublicId = typeof raw.accountPublicId === 'string' ? raw.accountPublicId.trim().toUpperCase() : '';
  const displayName = typeof raw.displayName === 'string' ? raw.displayName.trim() : '';
  const metadata = normalizeMetadata(raw.metadata);
  const localization = normalizeLocalization(raw.localization);
  const placements = normalizePlacements(raw.placements);
  const version = typeof raw.version === 'number' && Number.isFinite(raw.version) ? Math.max(1, Math.floor(raw.version)) : null;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt.trim() : '';
  if (
    !pageId ||
    pageId !== expectedPageId ||
    !isCompactAccountPublicId(accountPublicId) ||
    !displayName ||
    !metadata ||
    !localization ||
    !placements ||
    version == null ||
    !updatedAt
  ) {
    return null;
  }
  return { schemaVersion: 1, pageId, accountPublicId, displayName, metadata, localization, placements, version, updatedAt };
}

function pageSummaryFromSource(source: AccountPageSource, previous: AccountPageSummary | null, now: string): AccountPageSummary {
  return {
    pageId: source.pageId,
    title: source.metadata.title,
    description: source.metadata.description,
    robots: source.metadata.robots,
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
        typeof page.pageId === 'string' &&
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
  const previous = index.pages.find((page) => page.pageId === args.source.pageId) ?? null;
  const summary = pageSummaryFromSource(args.source, previous, args.now);
  const pages = [
    summary,
    ...index.pages.filter((page) => page.pageId !== args.source.pageId),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.pageId.localeCompare(right.pageId));
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
    pages: index.pages.filter((page) => page.pageId !== args.pageId),
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
  if (source.accountPublicId !== accountId) {
    throw new PageOperationError({
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.page.invalidAccount',
    });
  }
  const previous = await readAccountPageSource({ env: args.env, accountId, pageId });
  const now = args.now ?? new Date().toISOString();
  const nextSource = {
    ...source,
    updatedAt: now,
    version: (previous?.version ?? 0) + 1,
  };
  await putJson(args.env, accountPageSourceKey(accountId, pageId), nextSource);
  const summary = await writePagesIndex({ env: args.env, accountId, source: nextSource, now });
  await updatePlacementIndexes({
    env: args.env,
    accountId,
    pageId,
    previous,
    next: nextSource,
    now,
  });
  return { source: nextSource, summary };
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

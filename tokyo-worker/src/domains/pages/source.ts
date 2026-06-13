import { isRecord } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isCompactInstanceId,
  isCompactPageId,
} from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import { deletePrefix, putJson } from '../storage';
import {
  accountPagesRoot,
  accountPageRoot,
  accountPageSourceKey,
} from './keys';
import type { AccountPageSummary } from './types';
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
  return isCompactPageId(value) ? value : null;
}

function normalizeRobots(value: unknown): AccountPageSummary['robots'] | null {
  if (value === 'index,follow' || value === 'noindex,nofollow') return value;
  return null;
}

function failSourceInvalid(paths?: string[]): never {
  throw new PageOperationError({
    kind: 'VALIDATION',
    reasonKey: 'tokyo.errors.page.sourceInvalid',
    ...(paths ? { paths } : {}),
  });
}

function normalizeLocale(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z]{2}(?:-[a-z0-9]{2,8})?$/.test(value) ? value : null;
}

function isExactNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isExactString(value: unknown): value is string {
  return typeof value === 'string' && value === value.trim();
}

function isValidCanonicalUrl(value: string): boolean {
  if (value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isCountryLocaleRule(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.country === 'string' &&
    /^[A-Z]{2}$/.test(value.country) &&
    Boolean(normalizeLocale(value.locale));
}

function isPagePlacement(value: unknown): boolean {
  return isRecord(value) && isExactNonEmptyString(value.placementId) && isCompactInstanceId(value.instanceId);
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

function assertPageSourceContract(args: {
  source: unknown;
  accountId: string;
  pageId: string;
}): void {
  const source = args.source;
  if (!isRecord(source) || source.schemaVersion !== 1 || source.pageId !== args.pageId || source.accountPublicId !== args.accountId) {
    failSourceInvalid();
  }
  const metadata = isRecord(source.metadata) ? source.metadata : null;
  const hasCanonical = Boolean(metadata && Object.prototype.hasOwnProperty.call(metadata, 'canonicalUrl'));
  if (
    !metadata ||
    !isExactNonEmptyString(metadata.title) ||
    !isExactString(metadata.description) ||
    normalizeRobots(metadata.robots) == null ||
    (hasCanonical && (typeof metadata.canonicalUrl !== 'string' || !metadata.canonicalUrl.trim() || !isValidCanonicalUrl(metadata.canonicalUrl)))
  ) {
    failSourceInvalid();
  }
  const localization = isRecord(source.localization) ? source.localization : null;
  if (
    !localization ||
    !normalizeLocale(localization.defaultLocale) ||
    !Array.isArray(localization.countryLocaleRules) ||
    !localization.countryLocaleRules.every(isCountryLocaleRule) ||
    localization.ipLocalizationEnabled !== true && localization.ipLocalizationEnabled !== false ||
    localization.languageSwitcherEnabled !== true && localization.languageSwitcherEnabled !== false ||
    localization.missingLocaleBehavior !== 'block_publish'
  ) {
    failSourceInvalid();
  }
  if (
    !Array.isArray(source.placements) ||
    !source.placements.every(isPagePlacement) ||
    !isExactNonEmptyString(source.displayName) ||
    typeof source.version !== 'number' ||
    !Number.isInteger(source.version) ||
    source.version < 1 ||
    !isExactNonEmptyString(source.createdAt) ||
    !isExactNonEmptyString(source.updatedAt)
  ) {
    failSourceInvalid();
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
  assertPageSourceContract({ source: source.value, accountId, pageId });
  return source.value;
}

function pageSummaryFromSource(source: unknown, pageId: string): AccountPageSummary {
  const accepted = source as {
    metadata: { title: string; description: string; robots: AccountPageSummary['robots'] };
    placements: unknown[];
    createdAt: string;
    updatedAt: string;
  };
  return {
    pageId,
    title: accepted.metadata.title,
    description: accepted.metadata.description,
    robots: accepted.metadata.robots,
    placementCount: accepted.placements.length,
    createdAt: accepted.createdAt,
    updatedAt: accepted.updatedAt,
  };
}

export async function listAccountPages(args: {
  env: Env;
  accountId: string;
}): Promise<{ v: 1; accountId: string; pages: AccountPageSummary[] }> {
  const accountId = assertAccountId(args.accountId);
  const pages: AccountPageSummary[] = [];
  let cursor: string | undefined = undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({
      prefix: `${accountPagesRoot(accountId)}/`,
      cursor,
    });
    for (const object of listed.objects) {
      if (!object.key.endsWith('/source.json')) continue;
      const source = await loadStoredPageSource({ env: args.env, key: object.key });
      const pageId = normalizePageId(object.key.split('/').at(-2));
      if (!source.exists || !pageId) {
        failSourceInvalid([object.key]);
      }
      assertPageSourceContract({ source: source.value, accountId, pageId });
      pages.push(pageSummaryFromSource(source.value, pageId));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  pages.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.pageId.localeCompare(right.pageId));
  return { v: 1, accountId, pages };
}

export async function saveAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
}): Promise<{ source: unknown; summary: AccountPageSummary }> {
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
  assertPageSourceContract({ source: args.source, accountId, pageId });
  const nextSource = {
    ...(args.source as Record<string, unknown>),
    version: (previous as { version: number }).version + 1,
    updatedAt: new Date().toISOString(),
  };
  const summary = pageSummaryFromSource(nextSource, pageId);
  await putJson(args.env, accountPageSourceKey(accountId, pageId), nextSource);
  return { source: nextSource, summary };
}

export async function createAccountPageSource(args: {
  env: Env;
  accountId: string;
  pageId: string;
  source: unknown;
}): Promise<{ source: unknown; summary: AccountPageSummary }> {
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
  assertPageSourceContract({ source: args.source, accountId, pageId });
  const summary = pageSummaryFromSource(args.source, pageId);
  await putJson(args.env, accountPageSourceKey(accountId, pageId), args.source);
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
  const previous = await readAccountPageSource({ env: args.env, accountId, pageId });
  if (!previous) return { existed: false };
  await deletePrefix(args.env, `${accountPageRoot(accountId, pageId)}/`);
  return { existed: true };
}

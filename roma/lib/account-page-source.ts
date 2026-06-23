import { isRecord } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isCompactInstanceId,
  isCompactPageId,
} from '@clickeen/ck-contracts/overlay-identity';
import type {
  AccountPageSource,
  AccountPageSummary,
  PageRobots,
} from './account-page-direct';

function normalizeRobots(value: unknown): PageRobots | null {
  return value === 'index,follow' || value === 'noindex,nofollow' ? value : null;
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

export function normalizeAccountPageSource(raw: unknown, expected?: {
  accountId?: string;
  pageId?: string;
}): AccountPageSource | null {
  if (!isRecord(raw)) return null;
  if (
    !isCompactPageId(raw.pageId) ||
    !isCompactAccountPublicId(raw.accountPublicId) ||
    (expected?.pageId && raw.pageId !== expected.pageId) ||
    (expected?.accountId && raw.accountPublicId !== expected.accountId)
  ) {
    return null;
  }

  const metadata = isRecord(raw.metadata) ? raw.metadata : null;
  const hasCanonical = Boolean(metadata && Object.prototype.hasOwnProperty.call(metadata, 'canonicalUrl'));
  if (
    !metadata ||
    !isExactNonEmptyString(metadata.title) ||
    !isExactString(metadata.description) ||
    normalizeRobots(metadata.robots) == null ||
    (hasCanonical && (typeof metadata.canonicalUrl !== 'string' || !metadata.canonicalUrl.trim() || !isValidCanonicalUrl(metadata.canonicalUrl)))
  ) {
    return null;
  }

  const localization = isRecord(raw.localization) ? raw.localization : null;
  if (
    !localization ||
    !normalizeLocale(localization.defaultLocale) ||
    !Array.isArray(localization.countryLocaleRules) ||
    !localization.countryLocaleRules.every(isCountryLocaleRule) ||
    localization.ipLocalizationEnabled !== true && localization.ipLocalizationEnabled !== false ||
    localization.languageSwitcherEnabled !== true && localization.languageSwitcherEnabled !== false ||
    localization.missingLocaleBehavior !== 'block_publish'
  ) {
    return null;
  }

  if (
    !Array.isArray(raw.placements) ||
    !raw.placements.every(isPagePlacement) ||
    !isExactNonEmptyString(raw.displayName) ||
    typeof raw.revision !== 'number' ||
    !Number.isInteger(raw.revision) ||
    raw.revision < 1 ||
    !isExactNonEmptyString(raw.createdAt) ||
    !isExactNonEmptyString(raw.updatedAt)
  ) {
    return null;
  }
  return raw as AccountPageSource;
}

export function accountPageSummaryFromSource(source: AccountPageSource): AccountPageSummary {
  return {
    pageId: source.pageId,
    title: source.metadata.title,
    description: source.metadata.description,
    robots: source.metadata.robots,
    placementCount: source.placements.length,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export function sortAccountPageSummaries(pages: AccountPageSummary[]): AccountPageSummary[] {
  return pages.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.pageId.localeCompare(right.pageId));
}

export function materializeAccountPageSourceSave(args: {
  accountId: string;
  pageId: string;
  current: unknown;
  submitted: unknown;
  now?: string;
}): AccountPageSource | null {
  const current = normalizeAccountPageSource(args.current, { accountId: args.accountId, pageId: args.pageId });
  const submitted = normalizeAccountPageSource(args.submitted, { accountId: args.accountId, pageId: args.pageId });
  if (!current || !submitted) return null;
  return {
    ...submitted,
    createdAt: current.createdAt,
    revision: current.revision + 1,
    updatedAt: args.now ?? new Date().toISOString(),
  };
}

export function pageIdsPlacingInstance(args: {
  sources: AccountPageSource[];
  instanceId: string;
}): string[] | null {
  if (!isCompactInstanceId(args.instanceId)) return null;
  const pageIds = args.sources
    .filter((source) => source.placements.some((placement) => placement.instanceId === args.instanceId))
    .map((source) => source.pageId);
  return Array.from(new Set(pageIds));
}

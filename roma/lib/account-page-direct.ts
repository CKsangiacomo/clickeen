import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { callTokyo, type TokyoCallContext } from './tokyo-client';
import {
  buildPagePublicPackage,
  type ComposedPagePublicPackage,
  type WidgetPackageForPage,
} from './page-package-composer';

export type DirectPageRouteError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  detail?: string;
  paths?: string[];
};

type RouteFailure = {
  ok: false;
  status: number;
  error: DirectPageRouteError;
};

export type PageRobots = 'index,follow' | 'noindex,nofollow';
export type PagePublishStatus = 'published' | 'unpublished';

export type AccountPageMetadata = {
  title: string;
  description: string;
  robots: PageRobots;
  canonicalUrl?: string;
};

export type AccountPageLocalization = {
  defaultLocale: string;
  ipLocalizationEnabled: boolean;
  countryLocaleRules: Array<{ country: string; locale: string }>;
  languageSwitcherEnabled: boolean;
  missingLocaleBehavior: 'block_publish';
};

export type AccountPagePlacement = {
  placementId: string;
  instanceId: string;
};

export type AccountPageSource = {
  schemaVersion: 1;
  pageId: string;
  accountPublicId: string;
  displayName: string;
  metadata: AccountPageMetadata;
  localization: AccountPageLocalization;
  placements: AccountPagePlacement[];
  version: number;
  updatedAt: string;
};

export type AccountPageSummary = {
  pageId: string;
  title: string;
  description: string;
  robots: PageRobots;
  placementCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountPageOpen = {
  source: AccountPageSource;
  publishStatus: PagePublishStatus;
};

export type AccountPagePublishResult = {
  accountId: string;
  pageId: string;
  publishStatus: PagePublishStatus;
  changed: boolean;
};

type TokyoStoredWidgetPackage = {
  v: 1;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

function tokyoCallContext(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): TokyoCallContext {
  return {
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
  };
}

function invalidTokyoPayload(detail: string): RouteFailure {
  return {
    ok: false,
    status: 502,
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.page.invalidPayload',
      detail,
    },
  };
}

function normalizeRobots(value: unknown): PageRobots | null {
  return value === 'index,follow' || value === 'noindex,nofollow' ? value : null;
}

function normalizePageMetadata(raw: unknown): AccountPageMetadata | null {
  if (!isRecord(raw)) return null;
  const title = asTrimmedString(raw.title);
  const description = typeof raw.description === 'string' ? raw.description.trim() : null;
  const robots = normalizeRobots(raw.robots);
  if (!title || description == null || !robots) return null;
  const canonicalUrl = typeof raw.canonicalUrl === 'string' && raw.canonicalUrl.trim() ? raw.canonicalUrl.trim() : undefined;
  return { title, description, robots, ...(canonicalUrl ? { canonicalUrl } : {}) };
}

function normalizeLocale(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z]{2}(?:-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : null;
}

function normalizePageLocalization(raw: unknown): AccountPageLocalization | null {
  if (!isRecord(raw)) return null;
  const defaultLocale = normalizeLocale(raw.defaultLocale);
  if (!defaultLocale) return null;
  const countryLocaleRules = Array.isArray(raw.countryLocaleRules)
    ? raw.countryLocaleRules.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const country = typeof entry.country === 'string' ? entry.country.trim().toUpperCase() : '';
        const locale = normalizeLocale(entry.locale);
        return /^[A-Z]{2}$/.test(country) && locale ? [{ country, locale }] : [];
      })
    : null;
  if (!countryLocaleRules) return null;
  return {
    defaultLocale,
    ipLocalizationEnabled: raw.ipLocalizationEnabled === true,
    countryLocaleRules,
    languageSwitcherEnabled: raw.languageSwitcherEnabled === true,
    missingLocaleBehavior: 'block_publish',
  };
}

function normalizePlacement(raw: unknown): AccountPagePlacement | null {
  if (!isRecord(raw)) return null;
  const placementId = asTrimmedString(raw.placementId);
  const instanceId = asTrimmedString(raw.instanceId);
  if (!placementId || !instanceId) return null;
  return { placementId, instanceId };
}

function normalizePlacements(raw: unknown): AccountPagePlacement[] | null {
  if (!Array.isArray(raw)) return null;
  const placements = raw.map(normalizePlacement);
  if (placements.some((placement) => !placement)) return null;
  return placements as AccountPagePlacement[];
}

function normalizePageSource(raw: unknown): AccountPageSource | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const pageId = asTrimmedString(raw.pageId);
  const accountPublicId = asTrimmedString(raw.accountPublicId);
  const displayName = asTrimmedString(raw.displayName);
  const metadata = normalizePageMetadata(raw.metadata);
  const localization = normalizePageLocalization(raw.localization);
  const placements = normalizePlacements(raw.placements);
  const version = typeof raw.version === 'number' && Number.isFinite(raw.version) ? Math.max(1, Math.floor(raw.version)) : null;
  const updatedAt = asTrimmedString(raw.updatedAt);
  if (!pageId || !accountPublicId || !displayName || !metadata || !localization || !placements || version == null || !updatedAt) {
    return null;
  }
  return { schemaVersion: 1, pageId, accountPublicId, displayName, metadata, localization, placements, version, updatedAt };
}

function normalizePageSummary(raw: unknown): AccountPageSummary | null {
  if (!isRecord(raw)) return null;
  const pageId = asTrimmedString(raw.pageId);
  const title = asTrimmedString(raw.title);
  const description = typeof raw.description === 'string' ? raw.description.trim() : null;
  const robots = normalizeRobots(raw.robots);
  const placementCount =
    typeof raw.placementCount === 'number' && Number.isFinite(raw.placementCount)
      ? Math.max(0, Math.floor(raw.placementCount))
      : null;
  const createdAt = asTrimmedString(raw.createdAt);
  const updatedAt = asTrimmedString(raw.updatedAt);
  if (!pageId || !title || description == null || !robots || placementCount == null || !createdAt || !updatedAt) {
    return null;
  }
  return { pageId, title, description, robots, placementCount, createdAt, updatedAt };
}

function normalizePublishStatus(value: unknown): PagePublishStatus | null {
  return value === 'published' || value === 'unpublished' ? value : null;
}

function normalizePageOpenPayload(raw: unknown): AccountPageOpen | null {
  if (!isRecord(raw)) return null;
  const source = normalizePageSource(raw.source);
  const publishStatus = normalizePublishStatus(raw.publishStatus);
  if (!source || !publishStatus) return null;
  return { source, publishStatus };
}

function normalizePagePublishPayload(raw: unknown): AccountPagePublishResult | null {
  if (!isRecord(raw)) return null;
  const accountId = asTrimmedString(raw.accountId);
  const pageId = asTrimmedString(raw.pageId);
  const publishStatus = normalizePublishStatus(raw.publishStatus);
  const changed = typeof raw.changed === 'boolean' ? raw.changed : null;
  if (!accountId || !pageId || !publishStatus || changed == null) return null;
  return { accountId, pageId, publishStatus, changed };
}

function normalizePageSummaries(raw: unknown): AccountPageSummary[] | null {
  if (!Array.isArray(raw)) return null;
  const pages = raw.map(normalizePageSummary);
  if (pages.some((page) => !page)) return null;
  return pages as AccountPageSummary[];
}

function normalizePageMutationPayload(raw: unknown): {
  source: AccountPageSource;
  summary: AccountPageSummary;
} | null {
  if (!isRecord(raw)) return null;
  const source = normalizePageSource(raw.source);
  const summary = normalizePageSummary(raw.summary);
  if (!source || !summary) return null;
  return { source, summary };
}

function normalizeStoredWidgetPackage(raw: unknown): TokyoStoredWidgetPackage | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  if (typeof raw.indexHtml !== 'string' || typeof raw.stylesCss !== 'string' || typeof raw.runtimeJs !== 'string') {
    return null;
  }
  return {
    v: 1,
    indexHtml: raw.indexHtml,
    stylesCss: raw.stylesCss,
    runtimeJs: raw.runtimeJs,
  };
}

function pagePackageBuildFailure(error: unknown): RouteFailure {
  const detail = error instanceof Error ? error.message : String(error);
  const reasonKey = detail.includes(':') ? detail.split(':')[0] || 'page.package.buildFailed' : 'page.package.buildFailed';
  return {
    ok: false,
    status: 409,
    error: {
      kind: 'VALIDATION',
      reasonKey,
      detail,
    },
  };
}

async function readAccountInstancePackageFromTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: TokyoStoredWidgetPackage } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/package`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_instance_package_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const publicPackage = normalizeStoredWidgetPackage(payload?.publicPackage);
  if (!publicPackage) return invalidTokyoPayload('invalid Tokyo instance package payload');
  return { ok: true, value: publicPackage };
}

async function buildPagePackageForTokyo(args: {
  accountId: string;
  source: AccountPageSource;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: ComposedPagePublicPackage } | RouteFailure> {
  const uniqueInstanceIds = Array.from(new Set(args.source.placements.map((placement) => placement.instanceId)));
  const widgetPackages: WidgetPackageForPage[] = [];
  for (const instanceId of uniqueInstanceIds) {
    const read = await readAccountInstancePackageFromTokyo({
      accountId: args.accountId,
      instanceId,
      accountCapsule: args.accountCapsule,
      internalServiceName: args.internalServiceName,
      requestId: args.requestId,
    });
    if (!read.ok) return read;
    widgetPackages.push({
      instanceId,
      indexHtml: read.value.indexHtml,
      stylesCss: read.value.stylesCss,
      runtimeJs: read.value.runtimeJs,
    });
  }
  try {
    return {
      ok: true,
      value: buildPagePublicPackage({
        accountId: args.accountId,
        source: args.source,
        widgetPackages,
      }),
    };
  } catch (error) {
    return pagePackageBuildFailure(error);
  }
}

export async function listAccountPagesInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { accountId: string; pages: AccountPageSummary[] } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/pages`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_pages_list_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const accountId = asTrimmedString(payload?.accountId);
  const pages = normalizePageSummaries(payload?.pages);
  if (!accountId || !pages) return invalidTokyoPayload('invalid Tokyo account pages list payload');
  return { ok: true, value: { accountId, pages } };
}

export async function createAccountPageInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  source: AccountPageSource;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { source: AccountPageSource; summary: AccountPageSummary } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: '/__internal/pages',
    method: 'POST',
    body: { source: args.source },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_create_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = normalizePageMutationPayload(result.value);
  if (!payload) return invalidTokyoPayload('invalid Tokyo create page payload');
  return { ok: true, value: payload };
}

export async function loadAccountPageFromTokyo(args: {
  accountId: string;
  pageId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountPageOpen | null } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_open_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) {
    if (result.status === 404) return { ok: true, value: null };
    return result;
  }
  const payload = normalizePageOpenPayload(result.value);
  if (!payload) return invalidTokyoPayload('invalid Tokyo open page payload');
  return { ok: true, value: payload };
}

export async function saveAccountPageInTokyo(args: {
  accountId: string;
  pageId: string;
  source: AccountPageSource;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { source: AccountPageSource; summary: AccountPageSummary } } | RouteFailure> {
  const pagePackage = await buildPagePackageForTokyo({
    accountId: args.accountId,
    source: args.source,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
  });
  if (!pagePackage.ok) return pagePackage;

  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'PUT',
    body: { source: args.source, pagePackage: pagePackage.value },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_save_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = normalizePageMutationPayload(result.value);
  if (!payload) return invalidTokyoPayload('invalid Tokyo save page payload');
  return { ok: true, value: payload };
}

export async function deleteAccountPageFromTokyo(args: {
  accountId: string;
  pageId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ existed: boolean }> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'DELETE',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_delete_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok && result.status !== 404) {
    throw new Error(result.error.detail ?? result.error.reasonKey);
  }
  const payload = result.ok && isRecord(result.value) ? result.value : null;
  return { existed: payload?.existed === true || payload?.deleted === true };
}

export async function publishAccountPageInTokyo(args: {
  accountId: string;
  pageId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountPagePublishResult } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}/publish`,
    method: 'POST',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_publish_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = normalizePagePublishPayload(result.value);
  if (!payload) return invalidTokyoPayload('invalid Tokyo publish page payload');
  return { ok: true, value: payload };
}

export async function unpublishAccountPageInTokyo(args: {
  accountId: string;
  pageId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountPagePublishResult } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}/unpublish`,
    method: 'POST',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_unpublish_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = normalizePagePublishPayload(result.value);
  if (!payload) return invalidTokyoPayload('invalid Tokyo unpublish page payload');
  return { ok: true, value: payload };
}

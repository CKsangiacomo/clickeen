import { isRecord } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isCompactPageId,
} from '@clickeen/ck-contracts/overlay-identity';
import {
  accountPageSummaryFromSource,
  normalizeAccountPageSource,
  sortAccountPageSummaries,
} from './account-page-source';
import { callTokyo, type TokyoCallContext } from './tokyo-client';

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
  createdAt: string;
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

function notFoundFailure(args: { reasonKey: string; detail?: string }): RouteFailure {
  return {
    ok: false,
    status: 404,
    error: {
      kind: 'NOT_FOUND',
      reasonKey: args.reasonKey,
      ...(args.detail ? { detail: args.detail } : {}),
    },
  };
}

function normalizePageSource(raw: unknown): AccountPageSource | null {
  return normalizeAccountPageSource(raw);
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
  const accountId = isCompactAccountPublicId(raw.accountId) ? raw.accountId : null;
  const pageId = isCompactPageId(raw.pageId) ? raw.pageId : null;
  const publishStatus = normalizePublishStatus(raw.publishStatus);
  const changed = typeof raw.changed === 'boolean' ? raw.changed : null;
  if (!accountId || !pageId || !publishStatus || changed == null) return null;
  return { accountId, pageId, publishStatus, changed };
}

function normalizePageSources(raw: unknown): AccountPageSource[] | null {
  if (!Array.isArray(raw)) return null;
  const sources = raw.map((entry) => normalizeAccountPageSource(entry));
  if (sources.some((source) => !source)) return null;
  return sources as AccountPageSource[];
}

function normalizePageMutationPayload(raw: unknown): {
  source: AccountPageSource;
} | null {
  if (!isRecord(raw)) return null;
  const source = normalizePageSource(raw.source);
  if (!source) return null;
  return { source };
}

export async function listAccountPageSourcesInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { accountId: string; sources: AccountPageSource[] } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/pages`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_pages_list_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const accountId = isCompactAccountPublicId(payload?.accountId) ? payload.accountId : null;
  const sources = normalizePageSources(payload?.sources);
  if (!accountId || !sources) return invalidTokyoPayload('invalid Tokyo account page sources list payload');
  return { ok: true, value: { accountId, sources } };
}

export async function listAccountPagesInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { accountId: string; pages: AccountPageSummary[] } } | RouteFailure> {
  const result = await listAccountPageSourcesInTokyo(args);
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      accountId: result.value.accountId,
      pages: sortAccountPageSummaries(result.value.sources.map(accountPageSummaryFromSource)),
    },
  };
}

export async function createAccountPageInTokyo(args: {
  accountId: string;
  source: AccountPageSource;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { source: AccountPageSource; summary: AccountPageSummary; publishStatus: PagePublishStatus } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: '/__internal/pages',
    method: 'POST',
    body: { source: args.source },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_create_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = normalizePageOpenPayload(result.value);
  if (!payload) return invalidTokyoPayload('invalid Tokyo create page payload');
  const summary = accountPageSummaryFromSource(payload.source);
  return {
    ok: true,
    value: {
      source: payload.source,
      summary,
      publishStatus: payload.publishStatus,
    },
  };
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
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'PUT',
    body: { source: args.source },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_save_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const payload = normalizePageMutationPayload(result.value);
  if (!payload) return invalidTokyoPayload('invalid Tokyo save page payload');
  return { ok: true, value: { source: payload.source, summary: accountPageSummaryFromSource(payload.source) } };
}

export async function deleteAccountPageFromTokyo(args: {
  accountId: string;
  pageId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { existed: boolean } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'DELETE',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_delete_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) {
    if (result.status === 404) {
      return notFoundFailure({
        reasonKey: 'coreui.errors.page.notFound',
        detail: result.error.detail,
      });
    }
    return result;
  }
  const payload = result.ok && isRecord(result.value) ? result.value : null;
  if (payload?.existed === false || payload?.deleted === false) {
    return notFoundFailure({ reasonKey: 'coreui.errors.page.notFound' });
  }
  if (payload?.existed !== true && payload?.deleted !== true) {
    return invalidTokyoPayload('invalid Tokyo delete page payload');
  }
  return { ok: true, value: { existed: true } };
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

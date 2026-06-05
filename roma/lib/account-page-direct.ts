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

export type TokyoPageRobots = 'index,follow' | 'noindex,nofollow';
export type TokyoPagePublishStatus = 'published' | 'unpublished';

export type TokyoAccountPageHead = {
  title: string;
  description: string;
  robots: TokyoPageRobots;
};

export type TokyoAccountPagePlacement = {
  instanceId: string;
};

export type TokyoAccountPageSource = {
  v: 1;
  id: string;
  head: TokyoAccountPageHead;
  placements: TokyoAccountPagePlacement[];
};

export type TokyoAccountPageSummary = {
  id: string;
  title: string;
  description: string;
  robots: TokyoPageRobots;
  placementCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TokyoAccountPageOpen = {
  source: TokyoAccountPageSource;
  publishStatus: TokyoPagePublishStatus;
};

export type TokyoAccountPagePublishResult = {
  accountId: string;
  pageId: string;
  publishStatus: TokyoPagePublishStatus;
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

function normalizeRobots(value: unknown): TokyoPageRobots | null {
  return value === 'index,follow' || value === 'noindex,nofollow' ? value : null;
}

function normalizePageHead(raw: unknown): TokyoAccountPageHead | null {
  if (!isRecord(raw)) return null;
  const title = asTrimmedString(raw.title);
  const description = typeof raw.description === 'string' ? raw.description.trim() : null;
  const robots = normalizeRobots(raw.robots);
  if (!title || description == null || !robots) return null;
  return { title, description, robots };
}

function normalizePlacement(raw: unknown): TokyoAccountPagePlacement | null {
  if (!isRecord(raw)) return null;
  const instanceId = asTrimmedString(raw.instanceId);
  if (!instanceId) return null;
  return { instanceId };
}

function normalizePlacements(raw: unknown): TokyoAccountPagePlacement[] | null {
  if (!Array.isArray(raw)) return null;
  const placements = raw.map(normalizePlacement);
  if (placements.some((placement) => !placement)) return null;
  return placements as TokyoAccountPagePlacement[];
}

function normalizePageSource(raw: unknown): TokyoAccountPageSource | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const id = asTrimmedString(raw.id);
  const head = normalizePageHead(raw.head);
  const placements = normalizePlacements(raw.placements);
  if (!id || !head || !placements) return null;
  return { v: 1, id, head, placements };
}

function normalizePageSummary(raw: unknown): TokyoAccountPageSummary | null {
  if (!isRecord(raw)) return null;
  const id = asTrimmedString(raw.id);
  const title = asTrimmedString(raw.title);
  const description = typeof raw.description === 'string' ? raw.description.trim() : null;
  const robots = normalizeRobots(raw.robots);
  const placementCount =
    typeof raw.placementCount === 'number' && Number.isFinite(raw.placementCount)
      ? Math.max(0, Math.floor(raw.placementCount))
      : null;
  const createdAt = asTrimmedString(raw.createdAt);
  const updatedAt = asTrimmedString(raw.updatedAt);
  if (!id || !title || description == null || !robots || placementCount == null || !createdAt || !updatedAt) {
    return null;
  }
  return { id, title, description, robots, placementCount, createdAt, updatedAt };
}

function normalizePublishStatus(value: unknown): TokyoPagePublishStatus | null {
  return value === 'published' || value === 'unpublished' ? value : null;
}

function normalizePageOpenPayload(raw: unknown): TokyoAccountPageOpen | null {
  if (!isRecord(raw)) return null;
  const source = normalizePageSource(raw.source);
  const publishStatus = normalizePublishStatus(raw.publishStatus);
  if (!source || !publishStatus) return null;
  return { source, publishStatus };
}

function normalizePagePublishPayload(raw: unknown): TokyoAccountPagePublishResult | null {
  if (!isRecord(raw)) return null;
  const accountId = asTrimmedString(raw.accountId);
  const pageId = asTrimmedString(raw.pageId);
  const publishStatus = normalizePublishStatus(raw.publishStatus);
  const changed = typeof raw.changed === 'boolean' ? raw.changed : null;
  if (!accountId || !pageId || !publishStatus || changed == null) return null;
  return { accountId, pageId, publishStatus, changed };
}

function normalizePageSummaries(raw: unknown): TokyoAccountPageSummary[] | null {
  if (!Array.isArray(raw)) return null;
  const pages = raw.map(normalizePageSummary);
  if (pages.some((page) => !page)) return null;
  return pages as TokyoAccountPageSummary[];
}

function normalizePageMutationPayload(raw: unknown): {
  source: TokyoAccountPageSource;
  summary: TokyoAccountPageSummary;
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
  source: TokyoAccountPageSource;
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
}): Promise<{ ok: true; value: { accountId: string; pages: TokyoAccountPageSummary[] } } | RouteFailure> {
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
  source: TokyoAccountPageSource;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { source: TokyoAccountPageSource; summary: TokyoAccountPageSummary } } | RouteFailure> {
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
}): Promise<{ ok: true; value: TokyoAccountPageOpen | null } | RouteFailure> {
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
  source: TokyoAccountPageSource;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { source: TokyoAccountPageSource; summary: TokyoAccountPageSummary } } | RouteFailure> {
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
}): Promise<{ ok: true; value: TokyoAccountPagePublishResult } | RouteFailure> {
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
}): Promise<{ ok: true; value: TokyoAccountPagePublishResult } | RouteFailure> {
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

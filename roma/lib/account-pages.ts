import { isRecord } from '@clickeen/ck-contracts';
import type { AccountPageSource } from '@clickeen/ck-contracts/pages';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import { parseAccountPageSource } from './account-page-contract';
import { callTokyo, type TokyoCallContext, type TokyoCallFailure } from './tokyo-client';

type PageList = { accountId: string; sources: AccountPageSource[] };

export type PageGeneratedFiles = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type PageServingOverlays = Record<
  string,
  {
    page: Record<string, string>;
    placements: Record<string, Record<string, string>>;
  }
>;

export type StoredAccountPage = {
  source: AccountPageSource;
  files: PageGeneratedFiles;
  overlaysJson: PageServingOverlays;
  serveState: { published: boolean };
};

function context(args: {
  accountId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): TokyoCallContext {
  return {
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  };
}

function invalidPayload(detail: string): TokyoCallFailure {
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

function decodeStoredPage(raw: unknown): StoredAccountPage | null {
  if (!isRecord(raw)) return null;
  const source = parseAccountPageSource(raw.source);
  const files = isRecord(raw.files) ? raw.files : null;
  const serveState = isRecord(raw.serveState) ? raw.serveState : null;
  if (
    !source ||
    !files ||
    typeof files.indexHtml !== 'string' ||
    typeof files.stylesCss !== 'string' ||
    typeof files.runtimeJs !== 'string' ||
    !isRecord(raw.overlaysJson) ||
    !serveState ||
    typeof serveState.published !== 'boolean'
  ) return null;
  return {
    source,
    files: {
      indexHtml: files.indexHtml,
      stylesCss: files.stylesCss,
      runtimeJs: files.runtimeJs,
    },
    overlaysJson: raw.overlaysJson as PageServingOverlays,
    serveState: { published: serveState.published },
  };
}

export async function listAccountPageSources(args: {
  accountId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/pages`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_pages_list_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  if (!isRecord(result.value) || !isCompactAccountPublicId(result.value.accountId) || !Array.isArray(result.value.sources)) {
    return invalidPayload('invalid Tokyo Page list payload');
  }
  const sources = result.value.sources.map((entry) => parseAccountPageSource(entry));
  if (sources.some((entry) => !entry)) return invalidPayload('invalid Tokyo Page source');
  return { ok: true as const, value: { accountId: result.value.accountId, sources: sources as AccountPageSource[] } satisfies PageList };
}

export async function createAccountPage(args: {
  accountId: string;
  source: AccountPageSource;
  files: PageGeneratedFiles;
  overlaysJson: PageServingOverlays;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: '/__internal/pages',
    method: 'POST',
    body: { source: args.source, files: args.files, overlaysJson: args.overlaysJson },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_create_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const page = decodeStoredPage(result.value);
  return page ? { ok: true as const, value: page } : invalidPayload('invalid Tokyo Page create payload');
}

export async function readAccountPage(args: {
  accountId: string;
  pageId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_read_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  const page = decodeStoredPage(result.value);
  return page ? { ok: true as const, value: page } : invalidPayload('invalid Tokyo Page read payload');
}

export async function saveAccountPage(args: {
  accountId: string;
  pageId: string;
  source: AccountPageSource;
  files: PageGeneratedFiles;
  overlaysJson: PageServingOverlays;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'PUT',
    body: { source: args.source, files: args.files, overlaysJson: args.overlaysJson },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_save_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const page = decodeStoredPage(result.value);
  return page ? { ok: true as const, value: page } : invalidPayload('invalid Tokyo Page save payload');
}

async function changeAccountPagePublication(args: {
  accountId: string;
  pageId: string;
  action: 'publish' | 'unpublish';
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}/${args.action}`,
    method: 'POST',
    body: {},
    decode: (payload) => payload,
    errorDetail: `tokyo_account_page_${args.action}_http_error`,
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  if (!isRecord(result.value) || result.value.published !== (args.action === 'publish')) {
    return invalidPayload(`invalid Tokyo Page ${args.action} payload`);
  }
  return {
    ok: true as const,
    value: {
      pageId: args.pageId,
      published: result.value.published,
      changed: result.value.changed === true,
    },
  };
}

export function publishAccountPage(args: Omit<Parameters<typeof changeAccountPagePublication>[0], 'action'>) {
  return changeAccountPagePublication({ ...args, action: 'publish' });
}

export function unpublishAccountPage(args: Omit<Parameters<typeof changeAccountPagePublication>[0], 'action'>) {
  return changeAccountPagePublication({ ...args, action: 'unpublish' });
}

export async function deleteAccountPage(args: {
  accountId: string;
  pageId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  return callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'DELETE',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_delete_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
}

import { isRecord } from '@clickeen/ck-contracts';
import type { AccountPageSource } from '@clickeen/ck-contracts/pages';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import { parseAccountPageSource } from './account-page-contract';
import { callTokyo, type TokyoCallContext, type TokyoCallFailure } from './tokyo-client';

type PageList = { accountId: string; sources: AccountPageSource[] };

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

function decodeSource(raw: unknown): AccountPageSource | null {
  return isRecord(raw) ? parseAccountPageSource(raw.source) : null;
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
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: '/__internal/pages',
    method: 'POST',
    body: { source: args.source },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_create_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const source = decodeSource(result.value);
  return source ? { ok: true as const, value: { source } } : invalidPayload('invalid Tokyo Page create payload');
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
  const source = decodeSource(result.value);
  return source ? { ok: true as const, value: { source } } : invalidPayload('invalid Tokyo Page read payload');
}

export async function saveAccountPage(args: {
  accountId: string;
  pageId: string;
  source: AccountPageSource;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'PUT',
    body: { source: args.source },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_save_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  const source = decodeSource(result.value);
  return source ? { ok: true as const, value: { source } } : invalidPayload('invalid Tokyo Page save payload');
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

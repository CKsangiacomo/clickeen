import { isRecord } from '@clickeen/ck-contracts';
import type { AccountPageSource, PageLocaleOverlay } from '@clickeen/ck-contracts/pages';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import { parseAccountPageSource } from './account-page-contract';
import { callTokyo, type TokyoCallContext, type TokyoCallFailure } from './tokyo-client';

export type AccountPageInventoryFact = {
  source: Extract<AccountPageSource, { isTemplate: false }>;
  serveState: { published: boolean; needsUpdate: boolean };
  savedLocales: string[];
};

type PageList = {
  accountId: string;
  sources: AccountPageSource[];
  pages: AccountPageInventoryFact[];
};

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
  source: Extract<AccountPageSource, { isTemplate: false }>;
  files: PageGeneratedFiles;
  overlaysJson: PageServingOverlays;
  serveState: { published: boolean; needsUpdate: boolean };
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
    source.isTemplate ||
    !files ||
    typeof files.indexHtml !== 'string' ||
    typeof files.stylesCss !== 'string' ||
    typeof files.runtimeJs !== 'string' ||
    !isRecord(raw.overlaysJson) ||
    !serveState ||
    typeof serveState.published !== 'boolean' ||
    typeof serveState.needsUpdate !== 'boolean'
  ) return null;
  return {
    source,
    files: {
      indexHtml: files.indexHtml,
      stylesCss: files.stylesCss,
      runtimeJs: files.runtimeJs,
    },
    overlaysJson: raw.overlaysJson as PageServingOverlays,
    serveState: { published: serveState.published, needsUpdate: serveState.needsUpdate },
  };
}

function decodePageLocaleOverlay(raw: unknown): PageLocaleOverlay | null {
  if (!isRecord(raw) || !isRecord(raw.values)) return null;
  const allowed = new Set(['title', 'description', 'socialTitle', 'socialDescription']);
  if (
    Object.keys(raw).length !== 1 ||
    Object.keys(raw.values).some((key) => !allowed.has(key)) ||
    typeof raw.values.title !== 'string' ||
    !raw.values.title ||
    raw.values.title !== raw.values.title.trim()
  ) return null;
  for (const key of ['description', 'socialTitle', 'socialDescription'] as const) {
    if (Object.prototype.hasOwnProperty.call(raw.values, key) && typeof raw.values[key] !== 'string') return null;
  }
  return {
    values: {
      title: raw.values.title,
      ...(typeof raw.values.description === 'string' ? { description: raw.values.description } : {}),
      ...(typeof raw.values.socialTitle === 'string' ? { socialTitle: raw.values.socialTitle } : {}),
      ...(typeof raw.values.socialDescription === 'string' ? { socialDescription: raw.values.socialDescription } : {}),
    },
  };
}

function decodePageInventoryFact(raw: unknown): AccountPageInventoryFact | null {
  if (!isRecord(raw) || Object.keys(raw).length !== 3) return null;
  const source = parseAccountPageSource(raw.source);
  const serveState = isRecord(raw.serveState) ? raw.serveState : null;
  if (
    !source ||
    source.isTemplate ||
    !serveState ||
    Object.keys(serveState).length !== 2 ||
    typeof serveState.published !== 'boolean' ||
    typeof serveState.needsUpdate !== 'boolean' ||
    !Array.isArray(raw.savedLocales) ||
    raw.savedLocales.length === 0 ||
    raw.savedLocales.some((locale) => typeof locale !== 'string' || !locale || locale !== locale.trim()) ||
    new Set(raw.savedLocales).size !== raw.savedLocales.length ||
    raw.savedLocales[0] !== source.baseLocale
  ) return null;
  return {
    source,
    serveState: { published: serveState.published, needsUpdate: serveState.needsUpdate },
    savedLocales: [...raw.savedLocales] as string[],
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
  if (
    !isRecord(result.value) ||
    !isCompactAccountPublicId(result.value.accountId) ||
    result.value.accountId !== args.accountId ||
    !Array.isArray(result.value.sources) ||
    !Array.isArray(result.value.pages)
  ) {
    return invalidPayload('invalid Tokyo Page list payload');
  }
  const sources = result.value.sources.map((entry) => parseAccountPageSource(entry));
  if (sources.some((entry) => !entry)) return invalidPayload('invalid Tokyo Page source');
  const pages = result.value.pages.map(decodePageInventoryFact);
  if (pages.some((entry) => !entry)) return invalidPayload('invalid Tokyo Page inventory fact');
  const exactSources = sources as AccountPageSource[];
  const exactPages = pages as AccountPageInventoryFact[];
  const ordinarySources = exactSources.filter((source) => !source.isTemplate);
  if (
    ordinarySources.length !== exactPages.length ||
    exactPages.some((page) => !ordinarySources.some((source) =>
      source.pageId === page.source.pageId && JSON.stringify(source) === JSON.stringify(page.source)))
  ) return invalidPayload('Tokyo Page inventory does not match Page sources');
  return {
    ok: true as const,
    value: {
      accountId: result.value.accountId,
      sources: exactSources,
      pages: exactPages,
    } satisfies PageList,
  };
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
  operation: 'save' | 'update';
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}`,
    method: 'PUT',
    body: { source: args.source, files: args.files, overlaysJson: args.overlaysJson, operation: args.operation },
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

export async function renameAccountPage(args: {
  accountId: string;
  pageId: string;
  displayName: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}/rename`,
    method: 'POST',
    body: { displayName: args.displayName },
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_rename_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  if (
    !isRecord(result.value) ||
    result.value.accountId !== args.accountId ||
    result.value.pageId !== args.pageId ||
    result.value.displayName !== args.displayName
  ) return invalidPayload('invalid Tokyo Page rename payload');
  return {
    ok: true as const,
    value: { pageId: args.pageId, displayName: args.displayName },
  };
}

export async function readAccountPageLocaleOverlay(args: {
  accountId: string;
  pageId: string;
  locale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}/translations/${encodeURIComponent(args.locale)}`,
    method: 'GET',
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_translation_read_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  if (
    !isRecord(result.value) ||
    result.value.accountId !== args.accountId ||
    result.value.pageId !== args.pageId ||
    result.value.locale !== args.locale
  ) {
    return invalidPayload('invalid Tokyo Page translation read payload');
  }
  const overlay = decodePageLocaleOverlay(result.value.overlay);
  return overlay
    ? { ok: true as const, value: { pageId: args.pageId, locale: args.locale, overlay } }
    : invalidPayload('invalid Tokyo Page translation overlay');
}

export async function writeAccountPageLocaleOverlay(args: {
  accountId: string;
  pageId: string;
  locale: string;
  overlay: PageLocaleOverlay;
  accountCapsule?: string | null;
  requestId?: string | null;
}) {
  const result = await callTokyo(context(args), {
    path: `/__internal/pages/${encodeURIComponent(args.pageId)}/translations/${encodeURIComponent(args.locale)}`,
    method: 'PUT',
    body: args.overlay,
    decode: (payload) => payload,
    errorDetail: 'tokyo_account_page_translation_write_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  if (
    !isRecord(result.value) ||
    result.value.accountId !== args.accountId ||
    result.value.pageId !== args.pageId ||
    result.value.locale !== args.locale
  ) {
    return invalidPayload('invalid Tokyo Page translation write payload');
  }
  const overlay = decodePageLocaleOverlay(result.value.overlay);
  return overlay
    ? { ok: true as const, value: { pageId: args.pageId, locale: args.locale, overlay } }
    : invalidPayload('invalid Tokyo Page translation overlay');
}

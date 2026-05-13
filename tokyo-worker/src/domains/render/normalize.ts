import { asTrimmedString } from '@clickeen/ck-contracts';
import { normalizeLocale } from '../../asset-utils';
import type { AllowlistEntry } from '@clickeen/l10n';
import type {
  AccountInstanceDocument,
  AccountInstanceIndexDocument,
  AccountInstanceIndexEntry,
  LocalePolicy,
  PublishDocument,
  PublishedWidgetLookupDocument,
  SavedRenderL10nFailure,
  SavedRenderPointer,
} from './types';
import { normalizeFingerprint, normalizeLocaleList, normalizeStorageId, normalizeSavedL10nFailures, normalizeSavedL10nStatus } from './utils';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function normalizeLocalePolicy(raw: unknown): LocalePolicy | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const baseLocale = normalizeLocale(payload.baseLocale) ?? '';
  const readyLocales = normalizeLocaleList(payload.readyLocales);
  if (!baseLocale || !readyLocales.length || !readyLocales.includes(baseLocale)) return null;

  const ipRecord = asRecord(payload.ip);
  const switcherRecord = asRecord(payload.switcher);
  const countryToLocaleRaw = asRecord(ipRecord?.countryToLocale);
  const countryToLocale: Record<string, string> = {};
  if (countryToLocaleRaw) {
    for (const [country, locale] of Object.entries(countryToLocaleRaw)) {
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const normalized = normalizeLocale(locale);
      if (!normalized || !readyLocales.includes(normalized)) continue;
      countryToLocale[country] = normalized;
    }
  }
  const alwaysShowLocale = normalizeLocale(switcherRecord?.alwaysShowLocale);

  return {
    baseLocale,
    readyLocales,
    ip: {
      enabled: ipRecord?.enabled === true,
      countryToLocale,
    },
    switcher: {
      enabled: switcherRecord?.enabled === true,
      ...(alwaysShowLocale && readyLocales.includes(alwaysShowLocale) ? { alwaysShowLocale } : {}),
    },
  };
}

function normalizeL10nStatus(raw: unknown): AccountInstanceDocument['l10n'] | undefined {
  const payload = asRecord(raw);
  if (!payload) return undefined;
  const baseFingerprint = normalizeFingerprint(payload.baseFingerprint);
  if (!baseFingerprint) return undefined;
  const summaryRaw = asRecord(payload.summary);
  const summaryBaseLocale = normalizeLocale(summaryRaw?.baseLocale) ?? '';
  const summaryDesiredLocales = normalizeLocaleList(summaryRaw?.desiredLocales);
  const summary =
    summaryBaseLocale && summaryDesiredLocales.includes(summaryBaseLocale)
      ? { baseLocale: summaryBaseLocale, desiredLocales: summaryDesiredLocales }
      : null;
  const generationId = asTrimmedString(payload.generationId);
  const status = normalizeSavedL10nStatus(payload.status);
  const updatedAt = asTrimmedString(payload.updatedAt);
  const startedAt = asTrimmedString(payload.startedAt);
  const finishedAt = asTrimmedString(payload.finishedAt);
  const lastError = asTrimmedString(payload.lastError);
  return {
    baseFingerprint,
    ...(summary ? { summary } : {}),
    ...(generationId ? { generationId } : {}),
    ...(status ? { status } : {}),
    ...(payload.readyLocales ? { readyLocales: normalizeLocaleList(payload.readyLocales) } : {}),
    ...(payload.failedLocales ? { failedLocales: normalizeSavedL10nFailures(payload.failedLocales) } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(lastError ? { lastError } : {}),
  };
}

export function normalizeAccountInstanceDocument(raw: unknown): AccountInstanceDocument | null {
  const payload = asRecord(raw);
  if (!payload || payload.v !== 1) return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const displayName = asTrimmedString(payload.displayName);
  const createdAt = asTrimmedString(payload.createdAt) ?? '';
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  if (!id || !accountId || !widgetType || !createdAt || !updatedAt) return null;
  const meta = asRecord(payload.meta) ?? (payload.meta === null || payload.meta === undefined ? null : null);
  return {
    v: 1,
    id,
    accountId,
    widgetType,
    displayName,
    meta,
    createdAt,
    updatedAt,
    ...(normalizeL10nStatus(payload.l10n) ? { l10n: normalizeL10nStatus(payload.l10n) } : {}),
  };
}

export function normalizePublishDocument(raw: unknown): PublishDocument | null {
  const payload = asRecord(raw);
  if (!payload || payload.v !== 1) return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const status = payload.status === 'published' ? 'published' : payload.status === 'unpublished' ? 'unpublished' : null;
  const configFp = normalizeFingerprint(payload.configFp);
  const localePolicy = normalizeLocalePolicy(payload.localePolicy);
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  if (!id || !accountId || !widgetType || !status || !updatedAt) return null;
  return {
    v: 1,
    id,
    accountId,
    widgetType,
    status,
    configFp,
    ...(localePolicy ? { localePolicy } : {}),
    ...(payload.seoGeo === true ? { seoGeo: true } : {}),
    updatedAt,
  };
}

export function normalizePublishedWidgetLookupDocument(raw: unknown): PublishedWidgetLookupDocument | null {
  const payload = asRecord(raw);
  if (!payload || payload.v !== 1 || payload.status !== 'published') return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  if (!id || !accountId || !widgetType || !updatedAt) return null;
  return { v: 1, id, accountId, widgetType, status: 'published', updatedAt };
}

export function normalizeSavedRenderPointer(raw: unknown): SavedRenderPointer | null {
  const instance = normalizeAccountInstanceDocument(raw);
  if (!instance) return null;
  const configFp = normalizeFingerprint((raw as Record<string, unknown>).configFp) ?? '';
  if (!configFp) return null;
  return {
    v: 1,
    id: instance.id,
    accountId: instance.accountId,
    widgetType: instance.widgetType,
    displayName: instance.displayName,
    meta: instance.meta ?? null,
    configFp,
    updatedAt: instance.updatedAt,
    ...(instance.l10n ? { l10n: instance.l10n } : {}),
  };
}

export function resolveSavedRenderValidationReason(raw: unknown): string {
  const payload = asRecord(raw);
  const widgetType = asTrimmedString(payload?.widgetType);
  if (!widgetType) return 'coreui.errors.instance.widgetMissing';
  return 'coreui.errors.instance.config.invalid';
}

export function normalizeAllowlistEntries(raw: unknown): AllowlistEntry[] {
  const payload = asRecord(raw);
  if (!payload) return [];
  const paths = Array.isArray(payload.paths) ? payload.paths : [];
  return paths.reduce<AllowlistEntry[]>((entries, entry) => {
    const record = asRecord(entry);
    if (!record) return entries;
    const path = asTrimmedString(record.path);
    if (!path) return entries;
    entries.push({
      path,
      type: record.type === 'richtext' ? 'richtext' : 'string',
    });
    return entries;
  }, []);
}

export function normalizeSavedL10nSnapshot(raw: unknown): Record<string, string> | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const snapshot: Record<string, string> = {};
  for (const [path, value] of Object.entries(payload)) {
    const normalizedPath = asTrimmedString(path);
    if (!normalizedPath || typeof value !== 'string') return null;
    snapshot[normalizedPath] = value;
  }
  return snapshot;
}

export function normalizeIndexEntry(raw: unknown): AccountInstanceIndexEntry | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const id = normalizeStorageId(payload.id) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const displayName = asTrimmedString(payload.displayName) ?? id;
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  const publishStatus = payload.publishStatus === 'published' ? 'published' : 'unpublished';
  if (!accountId || !id || !widgetType || !displayName || !updatedAt) return null;
  return { accountId, id, widgetType, displayName, publishStatus, updatedAt };
}

export function normalizeIndexDocument(raw: unknown, accountId: string): AccountInstanceIndexDocument | null {
  const payload = asRecord(raw);
  if (!payload || payload.v !== 1) return null;
  const docAccountId = normalizeStorageId(payload.accountId);
  const updatedAt = asTrimmedString(payload.updatedAt);
  const entriesRaw = Array.isArray(payload.entries) ? payload.entries : null;
  if (docAccountId !== accountId || !updatedAt || !entriesRaw) return null;
  const entries = entriesRaw.map((entry) => normalizeIndexEntry(entry));
  if (entries.some((entry) => !entry)) return null;
  return { v: 1, accountId, entries: entries as AccountInstanceIndexEntry[], updatedAt };
}

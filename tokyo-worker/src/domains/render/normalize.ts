import { asTrimmedString } from '@clickeen/ck-contracts';
import { isCompactAccountPublicId, isCompactInstanceId, isWidgetOverlayCode, isOverlayId } from '@clickeen/ck-contracts/overlay-identity';
import { normalizeLocale } from '../../asset-utils';
import type {
  AccountInstanceDocument,
  AccountInstanceIndexDocument,
  AccountInstanceIndexEntry,
  LocalePolicy,
  PublishDocument,
  PublishedOverlayProjection,
  SavedRenderPointer,
} from './types';
import { normalizeFingerprint, normalizeStorageId } from './utils';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function normalizeLocalePolicy(raw: unknown): LocalePolicy | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const baseLocale = normalizeLocale(payload.baseLocale) ?? '';
  if (!baseLocale) return null;

  const ipRecord = asRecord(payload.ip);
  const switcherRecord = asRecord(payload.switcher);
  const countryToLocaleRaw = asRecord(ipRecord?.countryToLocale);
  const countryToLocale: Record<string, string> = {};
  if (countryToLocaleRaw) {
    for (const [country, locale] of Object.entries(countryToLocaleRaw)) {
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const normalized = normalizeLocale(locale);
      if (!normalized) continue;
      countryToLocale[country] = normalized;
    }
  }
  const alwaysShowLocale = normalizeLocale(switcherRecord?.alwaysShowLocale);

  return {
    baseLocale,
    ip: {
      enabled: ipRecord?.enabled === true,
      countryToLocale,
    },
    switcher: {
      enabled: switcherRecord?.enabled === true,
      ...(alwaysShowLocale ? { alwaysShowLocale } : {}),
    },
  };
}

function normalizePublishedOverlayProjection(raw: unknown): PublishedOverlayProjection | null {
  const payload = asRecord(raw);
  const languagesRaw = asRecord(payload?.languages);
  if (!payload || !languagesRaw) return null;
  const languages: Record<string, string> = {};
  for (const [languageCode, overlayId] of Object.entries(languagesRaw)) {
    if (!/^[0-9A-Z]{4}$/.test(languageCode) || !isOverlayId(overlayId)) return null;
    languages[languageCode] = overlayId;
  }
  return { languages };
}

export function normalizeAccountInstanceDocument(raw: unknown): AccountInstanceDocument | null {
  const payload = asRecord(raw);
  if (!payload || payload.v !== 1) return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetCode = asTrimmedString(payload.widgetCode) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const displayName = asTrimmedString(payload.displayName);
  const createdAt = asTrimmedString(payload.createdAt) ?? '';
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  if (!isCompactInstanceId(id) || !isCompactAccountPublicId(accountId) || !isWidgetOverlayCode(widgetCode) || !widgetType || !createdAt || !updatedAt) return null;
  const meta = asRecord(payload.meta) ?? (payload.meta === null || payload.meta === undefined ? null : null);
  return {
    v: 1,
    id,
    accountId,
    widgetCode,
    widgetType,
    displayName,
    meta,
    createdAt,
    updatedAt,
  };
}

export function normalizePublishDocument(raw: unknown): PublishDocument | null {
  const payload = asRecord(raw);
  if (!payload || payload.v !== 1) return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetCode = asTrimmedString(payload.widgetCode) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const status = payload.status === 'published' ? 'published' : payload.status === 'unpublished' ? 'unpublished' : null;
  const configFp = normalizeFingerprint(payload.configFp);
  const localePolicy = normalizeLocalePolicy(payload.localePolicy);
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  if (!isCompactInstanceId(id) || !isCompactAccountPublicId(accountId) || !isWidgetOverlayCode(widgetCode) || !widgetType || !status || !updatedAt) return null;
  return {
    v: 1,
    id,
    accountId,
    widgetCode,
    widgetType,
    status,
    configFp,
    ...(localePolicy ? { localePolicy } : {}),
    ...(normalizePublishedOverlayProjection(payload.overlays) ? { overlays: normalizePublishedOverlayProjection(payload.overlays)! } : {}),
    ...(payload.seoGeo === true ? { seoGeo: true } : {}),
    updatedAt,
  };
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
    widgetCode: instance.widgetCode,
    widgetType: instance.widgetType,
    displayName: instance.displayName,
    meta: instance.meta ?? null,
    configFp,
    updatedAt: instance.updatedAt,
  };
}

export function resolveSavedRenderValidationReason(raw: unknown): string {
  const payload = asRecord(raw);
  const widgetType = asTrimmedString(payload?.widgetType);
  if (!widgetType) return 'coreui.errors.instance.widgetMissing';
  return 'coreui.errors.instance.config.invalid';
}

export function normalizeIndexEntry(raw: unknown): AccountInstanceIndexEntry | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const id = normalizeStorageId(payload.id) ?? '';
  const widgetCode = asTrimmedString(payload.widgetCode) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const displayName = asTrimmedString(payload.displayName) ?? id;
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  const publishStatus = payload.publishStatus === 'published' ? 'published' : 'unpublished';
  if (!isCompactAccountPublicId(accountId) || !isCompactInstanceId(id) || !isWidgetOverlayCode(widgetCode) || !widgetType || !displayName || !updatedAt) return null;
  return { accountId, id, widgetCode, widgetType, displayName, publishStatus, updatedAt };
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

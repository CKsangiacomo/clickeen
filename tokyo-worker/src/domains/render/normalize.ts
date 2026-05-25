import { asTrimmedString } from '@clickeen/ck-contracts';
import { isCompactAccountPublicId, isCompactInstanceId, isWidgetOverlayCode } from '@clickeen/ck-contracts/overlay-identity';
import { normalizeLocale } from '../../asset-utils';
import type {
  AccountInstanceConfigDocument,
  AccountInstanceContentDocument,
  AccountInstanceContentFieldStatus,
  LocalePolicy,
} from './types';
import { normalizeLocaleList, normalizeStorageId } from './utils';

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

function normalizeEmbedBuildShape(raw: unknown): AccountInstanceConfigDocument['embedBuildShape'] | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const rendering = payload.rendering === 'html' || payload.rendering === 'iframe' ? payload.rendering : null;
  const seoMode = payload.seoMode === 'off' || payload.seoMode === 'lite' || payload.seoMode === 'full' ? payload.seoMode : null;
  const clientSide = payload.clientSide === 'static' || payload.clientSide === 'minimal-js' || payload.clientSide === 'interactive'
    ? payload.clientSide
    : null;
  const locales = normalizeLocaleList(payload.locales);
  if (!rendering || !seoMode || !clientSide || locales.length === 0) return null;
  return { rendering, seoMode, locales, clientSide };
}

export function normalizeAccountInstanceConfigDocument(raw: unknown): AccountInstanceConfigDocument | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetCode = asTrimmedString(payload.widgetCode) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const displayName = asTrimmedString(payload.displayName);
  const accountPublicId = normalizeStorageId(payload.accountPublicId) ?? accountId;
  const createdAt = asTrimmedString(payload.createdAt) ?? '';
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  const config = asRecord(payload.config);
  const baseLocale = normalizeLocale(payload.baseLocale) ?? '';
  const targetLocales = normalizeLocaleList(payload.targetLocales);
  const embedBuildShape = normalizeEmbedBuildShape(payload.embedBuildShape);
  if (!isCompactInstanceId(id) || !isCompactAccountPublicId(accountId) || accountPublicId !== accountId || !isWidgetOverlayCode(widgetCode) || !widgetType || !config || !baseLocale || !embedBuildShape || !createdAt || !updatedAt) return null;
  const meta = asRecord(payload.meta) ?? (payload.meta === null || payload.meta === undefined ? null : null);
  return {
    id,
    accountId,
    accountPublicId,
    widgetCode,
    widgetType,
    displayName,
    meta,
    config,
    baseLocale,
    targetLocales,
    embedBuildShape,
    createdAt,
    updatedAt,
  };
}

function normalizeContentFieldStatus(value: unknown): AccountInstanceContentFieldStatus | null {
  return value === 'ok' || value === 'changed' ? value : null;
}

export function normalizeAccountInstanceContentDocument(raw: unknown): AccountInstanceContentDocument | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  const rawFields = asRecord(payload.fields);
  if (!isCompactInstanceId(id) || !isCompactAccountPublicId(accountId) || !widgetType || !updatedAt || !rawFields) return null;
  const fields: AccountInstanceContentDocument['fields'] = {};
  for (const [path, rawField] of Object.entries(rawFields)) {
    const field = asRecord(rawField);
    if (!field) return null;
    const value = typeof field.value === 'string' ? field.value : null;
    const status = normalizeContentFieldStatus(field.status);
    if (value == null || !status) return null;
    const rawLocaleStatus = asRecord(field.localeStatus);
    const localeStatus: Record<string, AccountInstanceContentFieldStatus> = {};
    if (rawLocaleStatus) {
      for (const [locale, rawStatus] of Object.entries(rawLocaleStatus)) {
        const normalized = normalizeContentFieldStatus(rawStatus);
        if (!normalized) return null;
        localeStatus[locale] = normalized;
      }
    }
    const rawTranslatedValues = asRecord(field.translatedValues);
    const translatedValues: Record<string, string> = {};
    if (rawTranslatedValues) {
      for (const [locale, translatedValue] of Object.entries(rawTranslatedValues)) {
        if (typeof translatedValue !== 'string') return null;
        translatedValues[locale] = translatedValue;
      }
    }
    fields[path] = {
      ...(typeof field.identityKey === 'string' && field.identityKey ? { identityKey: field.identityKey } : {}),
      ...(typeof field.fieldPattern === 'string' && field.fieldPattern ? { fieldPattern: field.fieldPattern } : {}),
      value,
      status,
      ...(Object.keys(localeStatus).length ? { localeStatus } : {}),
      ...(Object.keys(translatedValues).length ? { translatedValues } : {}),
    };
  }
  return { id, accountId, widgetType, fields, updatedAt };
}

export function resolveSavedRenderValidationReason(raw: unknown): string {
  const payload = asRecord(raw);
  const widgetType = asTrimmedString(payload?.widgetType);
  if (!widgetType) return 'coreui.errors.instance.widgetMissing';
  return 'coreui.errors.instance.config.invalid';
}

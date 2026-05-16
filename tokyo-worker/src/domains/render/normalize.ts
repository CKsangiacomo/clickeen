import { asTrimmedString } from '@clickeen/ck-contracts';
import { isCompactAccountPublicId, isCompactInstanceId, isWidgetOverlayCode, isOverlayId } from '@clickeen/ck-contracts/overlay-identity';
import { normalizeLocale } from '../../asset-utils';
import type {
  AccountInstanceDocument,
  AccountInstanceIndexDocument,
  AccountInstanceIndexEntry,
  InstanceGenerationLane,
  InstanceGenerationState,
  InstanceGenerationStatus,
  LocalePolicy,
  PublishedOverlayProjection,
  SavedRenderPointer,
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

function normalizeGenerationStatus(value: unknown): InstanceGenerationStatus | null {
  return value === 'not_generated' ||
    value === 'queued' ||
    value === 'building' ||
    value === 'ready' ||
    value === 'stale' ||
    value === 'failed' ||
    value === 'unavailable'
    ? value
    : null;
}

function normalizeGenerationLane(raw: unknown): InstanceGenerationLane | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const status = normalizeGenerationStatus(payload.status);
  const sourceVersion = typeof payload.sourceVersion === 'number' && Number.isInteger(payload.sourceVersion) && payload.sourceVersion >= 0
    ? payload.sourceVersion
    : null;
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  const requestedAt = asTrimmedString(payload.requestedAt);
  const error = asTrimmedString(payload.error);
  const startedAt = asTrimmedString(payload.startedAt);
  const finishedAt = asTrimmedString(payload.finishedAt);
  const blockingReason = asTrimmedString(payload.blockingReason);
  const files = Array.isArray(payload.files)
    ? Array.from(new Set(payload.files.map(asTrimmedString).filter((entry): entry is string => Boolean(entry))))
    : [];
  if (!status || sourceVersion === null || !updatedAt) return null;
  return {
    status,
    sourceVersion,
    ...(requestedAt ? { requestedAt } : {}),
    updatedAt,
    ...(error ? { error } : {}),
    ...(files.length ? { files } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(blockingReason ? { blockingReason } : {}),
  };
}

function normalizeGenerationState(raw: unknown): InstanceGenerationState | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const translations = normalizeGenerationLane(payload.translations);
  const embed = normalizeGenerationLane(payload.embed);
  return translations && embed ? { translations, embed } : null;
}

function normalizeEmbedBuildShape(raw: unknown): AccountInstanceDocument['embedBuildShape'] | null {
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

export function normalizeAccountInstanceDocument(raw: unknown): AccountInstanceDocument | null {
  const payload = asRecord(raw);
  if (!payload || payload.v !== 1) return null;
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
  const sourceVersion = typeof payload.sourceVersion === 'number' && Number.isInteger(payload.sourceVersion) && payload.sourceVersion >= 1
    ? payload.sourceVersion
    : null;
  const generation = normalizeGenerationState(payload.generation);
  const publishStatus = payload.publishStatus === 'published' ? 'published' : 'unpublished';
  if (!isCompactInstanceId(id) || !isCompactAccountPublicId(accountId) || accountPublicId !== accountId || !isWidgetOverlayCode(widgetCode) || !widgetType || !config || !baseLocale || !embedBuildShape || sourceVersion === null || !generation || !createdAt || !updatedAt) return null;
  const meta = asRecord(payload.meta) ?? (payload.meta === null || payload.meta === undefined ? null : null);
  return {
    v: 1,
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
    sourceVersion,
    generation,
    publishStatus,
    createdAt,
    updatedAt,
  };
}

export function normalizeSavedRenderPointer(raw: unknown): SavedRenderPointer | null {
  const instance = normalizeAccountInstanceDocument(raw);
  if (!instance) return null;
  return {
    v: 1,
    id: instance.id,
    accountId: instance.accountId,
    widgetCode: instance.widgetCode,
    widgetType: instance.widgetType,
    displayName: instance.displayName,
    meta: instance.meta ?? null,
    sourceVersion: instance.sourceVersion,
    generation: instance.generation,
    publishStatus: instance.publishStatus,
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

import { normalizeLocale } from '../../asset-utils';
import type { AllowlistEntry } from '@clickeen/l10n';
import type { LiveRenderPointer, L10nLivePointer, LocalePolicy, MetaLivePointer, SavedRenderL10nFailure, SavedRenderPointer } from './types';
import { normalizeFingerprint, normalizeLocaleList, normalizePublicId, normalizeSavedL10nFailures, normalizeSavedL10nStatus } from './utils';

export function normalizeLocalePolicy(raw: unknown): LocalePolicy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  const baseLocale = normalizeLocale(payload.baseLocale) ?? '';
  const readyLocalesRaw = Array.isArray(payload.readyLocales)
    ? payload.readyLocales
    : [];
  const readyLocales = readyLocalesRaw
    .map((value) => normalizeLocale(value))
    .filter((value): value is string => Boolean(value));
  if (!baseLocale || !readyLocales.length) return null;
  if (!readyLocales.includes(baseLocale)) return null;
  const outReadyLocales = Array.from(new Set(readyLocales));

  const ipRaw = payload.ip;
  const ipRecord =
    ipRaw && typeof ipRaw === 'object' && !Array.isArray(ipRaw)
      ? (ipRaw as Record<string, unknown>)
      : null;
  const switcherRaw = payload.switcher;
  const switcherRecord =
    switcherRaw && typeof switcherRaw === 'object' && !Array.isArray(switcherRaw)
      ? (switcherRaw as Record<string, unknown>)
      : null;
  const ipEnabled = typeof ipRecord?.enabled === 'boolean' ? ipRecord.enabled : false;
  const switcherEnabled = typeof switcherRecord?.enabled === 'boolean' ? switcherRecord.enabled : false;
  const alwaysShowLocaleRaw =
    typeof switcherRecord?.alwaysShowLocale === 'string' ? switcherRecord.alwaysShowLocale : '';
  const alwaysShowLocale = normalizeLocale(alwaysShowLocaleRaw);

  const countryToLocaleRaw = ipRecord?.countryToLocale;
  const countryToLocale: Record<string, string> = {};
  if (
    countryToLocaleRaw &&
    typeof countryToLocaleRaw === 'object' &&
    !Array.isArray(countryToLocaleRaw)
  ) {
    for (const [country, locale] of Object.entries(countryToLocaleRaw as Record<string, unknown>)) {
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const normalized = normalizeLocale(locale);
      if (!normalized) continue;
      if (!outReadyLocales.includes(normalized)) continue;
      countryToLocale[country] = normalized;
    }
  }

  return {
    baseLocale,
    readyLocales: outReadyLocales,
    ip: { enabled: ipEnabled, countryToLocale },
    switcher: {
      enabled: switcherEnabled,
      ...(alwaysShowLocale && outReadyLocales.includes(alwaysShowLocale)
        ? { alwaysShowLocale }
        : {}),
    },
  };
}

export function normalizeLiveRenderPointer(raw: unknown): LiveRenderPointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const widgetType = typeof payload.widgetType === 'string' ? payload.widgetType.trim() : '';
  const configFp = normalizeFingerprint(payload.configFp) ?? '';
  const localePolicy = normalizeLocalePolicy(payload.localePolicy);
  if (!publicId || !widgetType || !configFp || !localePolicy) return null;
  const l10n = payload.l10n;
  const liveBase =
    l10n &&
    typeof l10n === 'object' &&
    !Array.isArray(l10n) &&
    typeof (l10n as any).liveBase === 'string'
      ? String((l10n as any).liveBase).trim()
      : '';
  const packsBase =
    l10n &&
    typeof l10n === 'object' &&
    !Array.isArray(l10n) &&
    typeof (l10n as any).packsBase === 'string'
      ? String((l10n as any).packsBase).trim()
      : '';
  if (!liveBase || !packsBase) return null;
  const seoGeoRaw = payload.seoGeo;
  const seoGeo =
    seoGeoRaw &&
    typeof seoGeoRaw === 'object' &&
    !Array.isArray(seoGeoRaw) &&
    typeof (seoGeoRaw as any).metaLiveBase === 'string' &&
    typeof (seoGeoRaw as any).metaPacksBase === 'string'
      ? {
          metaLiveBase: String((seoGeoRaw as any).metaLiveBase).trim(),
          metaPacksBase: String((seoGeoRaw as any).metaPacksBase).trim(),
        }
      : undefined;
  return {
    v: 1,
    publicId,
    widgetType,
    configFp,
    localePolicy,
    l10n: { liveBase, packsBase },
    seoGeo: seoGeo?.metaLiveBase && seoGeo?.metaPacksBase ? seoGeo : undefined,
  };
}

export function normalizeSavedRenderPointer(raw: unknown): SavedRenderPointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const accountId = normalizePublicId(payload.accountId) ?? '';
  const widgetType = typeof payload.widgetType === 'string' ? payload.widgetType.trim() : '';
  const displayNameRaw = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
  const source =
    payload.source === 'curated'
      ? 'curated'
      : payload.source === 'account' || payload.source === undefined
        ? 'account'
        : null;
  const meta =
    payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)
      ? (payload.meta as Record<string, unknown>)
      : payload.meta === null || payload.meta === undefined
        ? null
        : null;
  const l10nRaw =
    payload.l10n && typeof payload.l10n === 'object' && !Array.isArray(payload.l10n)
      ? (payload.l10n as Record<string, unknown>)
      : null;
  const baseFingerprint = normalizeFingerprint(l10nRaw?.baseFingerprint);
  const summaryRaw =
    l10nRaw?.summary && typeof l10nRaw.summary === 'object' && !Array.isArray(l10nRaw.summary)
      ? (l10nRaw.summary as Record<string, unknown>)
      : null;
  const summaryBaseLocale = normalizeLocale(summaryRaw?.baseLocale) ?? '';
  const summaryDesiredLocales = normalizeLocaleList(summaryRaw?.desiredLocales);
  const summary =
    summaryBaseLocale && summaryDesiredLocales.includes(summaryBaseLocale)
      ? {
          baseLocale: summaryBaseLocale,
          desiredLocales: summaryDesiredLocales,
        }
      : null;
  const generationId =
    typeof l10nRaw?.generationId === 'string' ? l10nRaw.generationId.trim() : '';
  const status = normalizeSavedL10nStatus(l10nRaw?.status);
  const readyLocales = normalizeLocaleList(l10nRaw?.readyLocales);
  const failedLocales = normalizeSavedL10nFailures(l10nRaw?.failedLocales);
  const l10nUpdatedAt =
    typeof l10nRaw?.updatedAt === 'string' ? l10nRaw.updatedAt.trim() : '';
  const l10nStartedAt =
    typeof l10nRaw?.startedAt === 'string' ? l10nRaw.startedAt.trim() : '';
  const l10nFinishedAt =
    typeof l10nRaw?.finishedAt === 'string' ? l10nRaw.finishedAt.trim() : '';
  const lastError =
    typeof l10nRaw?.lastError === 'string' ? l10nRaw.lastError.trim() : '';
  const configFp = normalizeFingerprint(payload.configFp) ?? '';
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!publicId || !accountId || !widgetType || !source || !configFp || !updatedAt) return null;
  const l10nStatus =
    baseFingerprint && generationId && status && l10nUpdatedAt
      ? {
          generationId,
          status,
          readyLocales,
          failedLocales,
          updatedAt: l10nUpdatedAt,
          ...(l10nStartedAt ? { startedAt: l10nStartedAt } : {}),
          ...(l10nFinishedAt ? { finishedAt: l10nFinishedAt } : {}),
          ...(lastError ? { lastError } : {}),
        }
      : null;
  return {
    v: 1,
    publicId,
    accountId,
    widgetType,
    displayName: displayNameRaw || null,
    source,
    meta,
    configFp,
    updatedAt,
    ...(baseFingerprint
      ? {
          l10n: {
            baseFingerprint,
            ...(summary ? { summary } : {}),
            ...(l10nStatus ?? {}),
          },
        }
      : {}),
  };
}

export function resolveSavedRenderValidationReason(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return 'coreui.errors.instance.config.invalid';
  }
  const payload = raw as Record<string, unknown>;
  const widgetType =
    typeof payload.widgetType === 'string' ? payload.widgetType.trim() : '';
  if (!widgetType) return 'coreui.errors.instance.widgetMissing';
  return 'coreui.errors.instance.config.invalid';
}

export function normalizeAllowlistEntries(raw: unknown): AllowlistEntry[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const paths = Array.isArray((raw as { paths?: unknown }).paths)
    ? (raw as { paths: unknown[] }).paths
    : [];
  return paths.reduce<AllowlistEntry[]>((entries, entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entries;
    const path = typeof (entry as { path?: unknown }).path === 'string'
      ? (entry as { path: string }).path.trim()
      : '';
    if (!path) return entries;
    entries.push({
      path,
      type: (entry as { type?: unknown }).type === 'richtext' ? 'richtext' : 'string',
    });
    return entries;
  }, []);
}

export function normalizeSavedL10nSnapshot(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const snapshot: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalizedPath = typeof path === 'string' ? path.trim() : '';
    if (!normalizedPath || typeof value !== 'string') return null;
    snapshot[normalizedPath] = value;
  }
  return snapshot;
}

export function normalizeTextPointer(raw: unknown): L10nLivePointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const locale = normalizeLocale(payload.locale) ?? '';
  const textFp = normalizeFingerprint(payload.textFp) ?? '';
  const baseFingerprint = normalizeFingerprint(payload.baseFingerprint);
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!publicId || !locale || !textFp || !updatedAt) return null;
  return { v: 1, publicId, locale, textFp, baseFingerprint, updatedAt };
}

export function normalizeMetaPointer(raw: unknown): MetaLivePointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const locale = normalizeLocale(payload.locale) ?? '';
  const metaFp = normalizeFingerprint(payload.metaFp) ?? '';
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!publicId || !locale || !metaFp || !updatedAt) return null;
  return { v: 1, publicId, locale, metaFp, updatedAt };
}

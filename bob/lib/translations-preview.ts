import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';

export type TranslationSetup = {
  v: 1;
  baseLocale: string;
  planTranslationsMax: number | null;
  activeLocales: string[];
};

export type LocaleOverlayInventoryEntry = {
  locale: string;
  overlayId: string;
};

export type LocaleOverlayInventoryData = {
  v: 1;
  baseLocale: string;
  overlays: LocaleOverlayInventoryEntry[];
};

export type LocaleOverlayObjectData = {
  v: 1;
  overlayId: string;
  values: Record<string, string>;
};

function normalizeValueMap(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const values: Record<string, string> = {};
  for (const [pathRaw, value] of Object.entries(raw)) {
    const path = asTrimmedString(pathRaw);
    if (!path || typeof value !== 'string') return null;
    values[path] = value;
  }
  return values;
}

function normalizeLocaleList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((entry) => asTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function normalizeOverlayEntry(raw: unknown): LocaleOverlayInventoryEntry | null {
  if (!isRecord(raw)) return null;
  const overlayId = asTrimmedString(raw.overlayId);
  const locale = asTrimmedString(raw.locale);
  if (!locale || !overlayId) return null;
  return {
    locale,
    overlayId,
  };
}

export function normalizeTranslationSetup(payload: unknown): TranslationSetup | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const baseLocale = asTrimmedString(payload.baseLocale);
  if (!baseLocale) return null;
  const planTranslationsMax =
    typeof payload.planTranslationsMax === 'number' && Number.isFinite(payload.planTranslationsMax)
      ? Math.max(0, Math.floor(payload.planTranslationsMax))
      : null;
  return {
    v: 1,
    baseLocale,
    planTranslationsMax,
    activeLocales: normalizeLocaleList(payload.activeLocales).filter((locale) => locale !== baseLocale),
  };
}

export function normalizeLocaleOverlayInventory(payload: unknown): LocaleOverlayInventoryData | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const baseLocale = asTrimmedString(payload.baseLocale);
  if (!baseLocale || !Array.isArray(payload.overlays)) return null;

  const overlays = payload.overlays
    .map((entry) => normalizeOverlayEntry(entry))
    .filter((entry): entry is LocaleOverlayInventoryEntry => Boolean(entry));
  if (overlays.length !== payload.overlays.length) return null;

  return {
    v: 1,
    baseLocale,
    overlays,
  };
}

export function normalizeLocaleOverlayObject(payload: unknown): LocaleOverlayObjectData | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const overlayId = asTrimmedString(payload.overlayId);
  if (!overlayId) return null;
  const values = normalizeValueMap(payload.values);
  if (!values) return null;
  return {
    v: 1,
    overlayId,
    values,
  };
}

export function listPreviewableLocales(data: LocaleOverlayInventoryData | null): string[] {
  if (!data) return [];
  return Array.from(new Set([data.baseLocale, ...data.overlays.map((entry) => entry.locale)]));
}

import {
  extractSavedTextFieldsForEditableFields,
  type WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts/translated-value-primitives';

export type TranslationSetup = {
  baseLocale: string;
  planTranslationsMax: number | null;
  activeLocales: string[];
};

export type TranslatedLocaleEntry = {
  locale: string;
};

export type TranslatedLocalesData = {
  baseLocale: string;
  translations: TranslatedLocaleEntry[];
};

export type TranslatedLocaleValuesData = {
  locale: string;
  values: Record<string, string>;
};

export type TranslationOverlayItem = {
  label: string;
  path: string;
  value: string;
  missingPaths: string[];
};

export type TranslationOverlaySection = {
  title: string;
  items: TranslationOverlayItem[];
};

export type TranslationOverlayInspection = {
  sections: TranslationOverlaySection[];
  missingPaths: string[];
};

export type TranslationPanelLocaleState = {
  localeValues: string[];
  localeValue: string;
  selectedTranslationEntry: TranslatedLocaleEntry | null;
};

export function listPreviewableLocales(
  baseLocale: string,
  data: TranslatedLocalesData | null,
): string[] {
  if (!baseLocale) return [];
  return [baseLocale, ...(data?.translations.map((entry) => entry.locale) ?? [])];
}

export function listActivePreviewLocales(args: { baseLocale: string; activeLocales: string[] }): string[] {
  return [args.baseLocale, ...args.activeLocales];
}

export function retainTranslatedLocaleValues(
  current: Record<string, Record<string, string>>,
  translatedLocales: TranslatedLocalesData,
): Record<string, Record<string, string>> {
  const translatedLocaleSet = new Set(translatedLocales.translations.map((entry) => entry.locale));
  const next: Record<string, Record<string, string>> = {};
  for (const [locale, values] of Object.entries(current)) {
    if (translatedLocaleSet.has(locale)) next[locale] = values;
  }
  return next;
}

export function buildTranslationPanelLocaleState(args: {
  baseLocale: string;
  activeLocales: string[];
  translatedLocales: TranslatedLocalesData | null;
  requestedLocale: string;
}): TranslationPanelLocaleState {
  const localeValues = listActivePreviewLocales({
    baseLocale: args.baseLocale,
    activeLocales: args.activeLocales,
  });
  const localeValue =
    args.requestedLocale && localeValues.includes(args.requestedLocale)
      ? args.requestedLocale
      : args.baseLocale;
  const selectedTranslationEntry =
    localeValue && localeValue !== args.baseLocale
      ? args.translatedLocales?.translations.find((entry) => entry.locale === localeValue) ?? null
      : null;

  return {
    localeValues,
    localeValue,
    selectedTranslationEntry,
  };
}

function stringAt(root: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = root;
  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0) return '';
      current = current[index];
      continue;
    }
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : '';
}

function valueForCoordinate(
  values: Record<string, string>,
  coordinate: string,
  missing: string[],
): string {
  const value = values[coordinate];
  if (value !== undefined) return value;
  missing.push(coordinate);
  return '';
}

function titleCaseSegment(value: string): string {
  const words = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!words) return 'Content';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function overlayGroupKey(path: string): string {
  const parts = path.split('.').filter(Boolean);
  const firstIndex = parts.findIndex((part) => /^\d+$/.test(part));
  if (firstIndex > 0) return parts.slice(0, firstIndex + 1).join('.');
  return parts[0] || 'content';
}

function overlayGroupTitle(args: {
  config: Record<string, unknown>;
  values: Record<string, string>;
  groupKey: string;
}): string {
  if (!args.groupKey.split('.').some((part) => /^\d+$/.test(part))) {
    return titleCaseSegment(args.groupKey);
  }

  const candidates = ['title', 'label', 'name', 'question'].map((leaf) => `${args.groupKey}.${leaf}`);
  for (const path of candidates) {
    const translated = args.values[path];
    if (typeof translated === 'string' && translated.trim()) return translated;
    const base = stringAt(args.config, path);
    if (base.trim()) return base;
  }

  const parts = args.groupKey.split('.');
  const lastText = [...parts].reverse().find((part) => !/^\d+$/.test(part)) ?? args.groupKey;
  const index = [...parts].reverse().find((part) => /^\d+$/.test(part));
  return index ? `${titleCaseSegment(lastText)} ${Number(index) + 1}` : titleCaseSegment(lastText);
}

export function mapTranslationOverlayValuesToCurrentPaths(args: {
  contract: WidgetEditableFieldsContract;
  config: Record<string, unknown>;
  values: Record<string, string>;
}): Record<string, string> {
  const valuesByPath: Record<string, string> = {};
  for (const field of extractSavedTextFieldsForEditableFields({
    contract: args.contract,
    config: args.config,
  })) {
    const value = args.values[field.identityKey];
    if (value !== undefined) valuesByPath[field.path] = value;
  }
  return valuesByPath;
}

export function buildEditableFieldsTranslationOverlayInspection(args: {
  contract: WidgetEditableFieldsContract;
  config: Record<string, unknown>;
  values: Record<string, string>;
}): TranslationOverlayInspection {
  const missingPaths: string[] = [];
  const sectionsByKey = new Map<string, TranslationOverlaySection>();
  const fields = extractSavedTextFieldsForEditableFields({
    contract: args.contract,
    config: args.config,
  });
  const valuesByPath: Record<string, string> = {};
  for (const field of fields) {
    const value = args.values[field.identityKey];
    if (value !== undefined) valuesByPath[field.path] = value;
  }

  for (const field of fields) {
    const groupKey = overlayGroupKey(field.path);
    let section = sectionsByKey.get(groupKey);
    if (!section) {
      section = {
        title: overlayGroupTitle({ config: args.config, values: valuesByPath, groupKey }),
        items: [],
      };
      sectionsByKey.set(groupKey, section);
    }

    const itemMissing = args.values[field.identityKey] === undefined ? [field.identityKey] : [];
    section.items.push({
      label: field.label,
      path: field.identityKey,
      value: valueForCoordinate(args.values, field.identityKey, missingPaths),
      missingPaths: itemMissing,
    });
  }

  return {
    sections: Array.from(sectionsByKey.values()),
    missingPaths,
  };
}

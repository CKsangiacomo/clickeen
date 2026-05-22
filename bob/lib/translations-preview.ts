import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import type { WidgetEditableFieldsContract, WidgetEditableField } from '@clickeen/ck-contracts/overlay-primitives';

export type TranslationSetup = {
  v: 1;
  baseLocale: string;
  planTranslationsMax: number | null;
  activeLocales: string[];
};

export type TranslatedLocaleEntry = {
  locale: string;
};

export type TranslatedLocalesData = {
  v: 1;
  baseLocale: string;
  translations: TranslatedLocaleEntry[];
};

export type TranslatedLocaleValuesData = {
  v: 1;
  locale: string;
  values: Record<string, string>;
};

export type TranslationReviewItem = {
  label: string;
  path: string;
  value: string;
  missingPaths: string[];
};

export type TranslationReviewSection = {
  title: string;
  items: TranslationReviewItem[];
};

export type TranslationReview = {
  sections: TranslationReviewSection[];
  missingPaths: string[];
};

export type TranslationPanelLocaleState = {
  expectedTranslationsCount: number;
  readyTranslationsCount: number;
  allExpectedTranslationsReady: boolean;
  localeValues: string[];
  localeValue: string;
  selectedTranslationEntry: TranslatedLocaleEntry | null;
  shouldRefreshOnDropdownOpen: boolean;
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

function normalizeTranslatedLocaleEntry(raw: unknown): TranslatedLocaleEntry | null {
  if (!isRecord(raw)) return null;
  const locale = asTrimmedString(raw.locale);
  return locale ? { locale } : null;
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

export function normalizeTranslatedLocales(payload: unknown): TranslatedLocalesData | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const baseLocale = asTrimmedString(payload.baseLocale);
  if (!baseLocale || !Array.isArray(payload.translations)) return null;

  const translations = payload.translations
    .map((entry) => normalizeTranslatedLocaleEntry(entry))
    .filter((entry): entry is TranslatedLocaleEntry => Boolean(entry));
  if (translations.length !== payload.translations.length) return null;

  return {
    v: 1,
    baseLocale,
    translations,
  };
}

export function normalizeTranslatedLocaleValues(payload: unknown): TranslatedLocaleValuesData | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const locale = asTrimmedString(payload.locale);
  if (!locale) return null;
  const values = normalizeValueMap(payload.values);
  if (!values) return null;
  return {
    v: 1,
    locale,
    values,
  };
}

export function listPreviewableLocales(data: TranslatedLocalesData | null): string[] {
  if (!data) return [];
  return Array.from(new Set([data.baseLocale, ...data.translations.map((entry) => entry.locale)]));
}

export function retainTranslatedLocaleValues(
  current: Record<string, Record<string, string>>,
  translatedLocales: TranslatedLocalesData,
): Record<string, Record<string, string>> {
  const readyLocales = new Set(translatedLocales.translations.map((entry) => entry.locale));
  const next: Record<string, Record<string, string>> = {};
  for (const [locale, values] of Object.entries(current)) {
    if (readyLocales.has(locale)) next[locale] = values;
  }
  return next;
}

export function buildTranslationPanelLocaleState(args: {
  baseLocale: string;
  activeLocales: string[];
  translatedLocales: TranslatedLocalesData | null;
  requestedLocale: string;
}): TranslationPanelLocaleState {
  const expectedLocales = new Set(args.activeLocales.filter((locale) => locale !== args.baseLocale));
  const readyLocales = new Set(
    (args.translatedLocales?.translations ?? [])
      .map((entry) => entry.locale)
      .filter((locale) => expectedLocales.has(locale)),
  );
  const expectedTranslationsCount = expectedLocales.size;
  const readyTranslationsCount = readyLocales.size;
  const allExpectedTranslationsReady =
    expectedTranslationsCount > 0 && readyTranslationsCount === expectedTranslationsCount;
  const localeValues = args.baseLocale
    ? [
        args.baseLocale,
        ...(args.translatedLocales?.translations ?? [])
          .filter((entry) => expectedLocales.has(entry.locale))
          .map((entry) => entry.locale),
      ]
    : [];
  const localeValue =
    args.requestedLocale && localeValues.includes(args.requestedLocale)
      ? args.requestedLocale
      : args.baseLocale || localeValues[0] || '';
  const selectedTranslationEntry =
    localeValue && localeValue !== args.baseLocale
      ? args.translatedLocales?.translations.find((entry) => entry.locale === localeValue) ?? null
      : null;

  return {
    expectedTranslationsCount,
    readyTranslationsCount,
    allExpectedTranslationsReady,
    localeValues,
    localeValue,
    selectedTranslationEntry,
    shouldRefreshOnDropdownOpen: readyTranslationsCount !== expectedTranslationsCount,
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

function valueForPath(values: Record<string, string>, path: string, missing: string[]): string {
  if (typeof values[path] === 'string') return values[path];
  missing.push(path);
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

function expandFieldPaths(root: Record<string, unknown>, pattern: string): string[] {
  const segments = pattern
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const out: string[] = [];

  const visit = (node: unknown, index: number, built: string[]) => {
    if (index >= segments.length) {
      if (built.length) out.push(built.join('.'));
      return;
    }

    const segment = segments[index]!;
    if (segment.endsWith('[]')) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      const key = segment.slice(0, -2);
      const next = (node as Record<string, unknown>)[key];
      if (!Array.isArray(next)) return;
      next.forEach((item, itemIndex) => {
        visit(item, index + 1, [...built, key, String(itemIndex)]);
      });
      return;
    }

    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const next = (node as Record<string, unknown>)[segment];
    visit(next, index + 1, [...built, segment]);
  };

  visit(root, 0, []);
  return out;
}

function reviewGroupKey(path: string): string {
  const parts = path.split('.').filter(Boolean);
  const firstIndex = parts.findIndex((part) => /^\d+$/.test(part));
  if (firstIndex > 0) return parts.slice(0, firstIndex + 1).join('.');
  return parts[0] || 'content';
}

function reviewGroupTitle(args: {
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

function isReviewableTextField(field: WidgetEditableField): boolean {
  return field.type === 'string' || field.type === 'richtext';
}

export function buildEditableFieldsTranslationReview(args: {
  contract: WidgetEditableFieldsContract;
  config: Record<string, unknown>;
  values: Record<string, string>;
}): TranslationReview {
  const missingPaths: string[] = [];
  const sectionsByKey = new Map<string, TranslationReviewSection>();

  for (const field of args.contract.fields) {
    if (!isReviewableTextField(field)) continue;
    for (const path of expandFieldPaths(args.config, field.path)) {
      const groupKey = reviewGroupKey(path);
      let section = sectionsByKey.get(groupKey);
      if (!section) {
        section = {
          title: reviewGroupTitle({ config: args.config, values: args.values, groupKey }),
          items: [],
        };
        sectionsByKey.set(groupKey, section);
      }

      const itemMissing = typeof args.values[path] === 'string' ? [] : [path];
      section.items.push({
        label: field.label,
        path,
        value: valueForPath(args.values, path, missingPaths),
        missingPaths: itemMissing,
      });
    }
  }

  return {
    sections: Array.from(sectionsByKey.values()),
    missingPaths,
  };
}

import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';

export type TranslationPreviewLanguage = {
  language: string;
  label: string;
  overlayId: string | null;
};

export type TranslationPreviewProgress = {
  language: string;
  message: string;
};

export type TranslationsPreviewData = {
  v: 1;
  baseLanguage: string;
  languages: TranslationPreviewLanguage[];
  valuesByLanguage: Record<string, Record<string, string>>;
  progress: TranslationPreviewProgress[];
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

function normalizeLanguageRow(raw: unknown): TranslationPreviewLanguage | null {
  if (!isRecord(raw)) return null;
  const language = asTrimmedString(raw.language);
  if (!language) return null;
  const label = asTrimmedString(raw.label) ?? language;
  const overlayId = asTrimmedString(raw.overlayId);
  return {
    language,
    label,
    overlayId: overlayId ?? null,
  };
}

function normalizeProgressRow(raw: unknown): TranslationPreviewProgress | null {
  if (!isRecord(raw)) return null;
  const language = asTrimmedString(raw.language);
  const message = asTrimmedString(raw.message);
  if (!language || !message) return null;
  return { language, message };
}

export function normalizeTranslationsPreviewData(payload: unknown): TranslationsPreviewData | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const baseLanguage = asTrimmedString(payload.baseLanguage);
  if (!baseLanguage || !Array.isArray(payload.languages)) return null;

  const languages = payload.languages
    .map((entry) => normalizeLanguageRow(entry))
    .filter((entry): entry is TranslationPreviewLanguage => Boolean(entry));
  if (languages.length !== payload.languages.length) return null;

  const valuesByLanguageRaw = isRecord(payload.valuesByLanguage) ? payload.valuesByLanguage : {};
  const valuesByLanguage: Record<string, Record<string, string>> = {};
  for (const language of languages) {
    if (!language.overlayId) continue;
    const values = normalizeValueMap(valuesByLanguageRaw[language.language]);
    if (!values) return null;
    valuesByLanguage[language.language] = values;
  }

  const progress = Array.isArray(payload.progress)
    ? payload.progress
        .map((entry) => normalizeProgressRow(entry))
        .filter((entry): entry is TranslationPreviewProgress => Boolean(entry))
    : [];

  return {
    v: 1,
    baseLanguage,
    languages,
    valuesByLanguage,
    progress,
  };
}

export function listPreviewableLanguages(data: TranslationsPreviewData | null): string[] {
  if (!data) return [];
  return [
    data.baseLanguage,
    ...data.languages
      .filter((entry) => Boolean(entry.overlayId && data.valuesByLanguage[entry.language]))
      .map((entry) => entry.language),
  ];
}

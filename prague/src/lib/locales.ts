import localesJson from '../../../config/locales.json';

const LOCALES_FILE_LABEL = 'config/locales.json';

function normalizeCanonicalLocales(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new Error(`[prague] Invalid canonical locales file (expected array): ${LOCALES_FILE_LABEL}`);
  }
  const locales = raw
    .map((entry: any) => {
      if (typeof entry === 'string') return entry.trim().toLowerCase();
      if (entry && typeof entry === 'object' && typeof entry.code === 'string') return entry.code.trim().toLowerCase();
      return '';
    })
    .filter(Boolean);

  if (!locales.includes('en')) {
    throw new Error(`[prague] Canonical locales must include "en": ${LOCALES_FILE_LABEL}`);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const l of locales) {
    if (seen.has(l)) continue;
    seen.add(l);
    unique.push(l);
  }

  return unique;
}

export const PRAGUE_CANONICAL_LOCALES = normalizeCanonicalLocales(localesJson);

export type PragueLocale = string;

export function listPragueLocales(): string[] {
  return [...PRAGUE_CANONICAL_LOCALES];
}

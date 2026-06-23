import { normalizeCanonicalLocalesFile, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);

export function localeLabel(locale: string, uiLocale = 'en'): string {
  return resolveLocaleLabel({ locales: CANONICAL_LOCALES, uiLocale, locale });
}

import { normalizeCanonicalLocalesFile, normalizeLocaleToken } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import type { PolicyProfile } from '@clickeen/ck-policy';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson).map((entry) => entry.code);
const SYSTEM_LOCALE_PRIORITY = Array.from(new Set(['en', ...CANONICAL_LOCALES]));

export function normalizeAdditionalAccountLocales(value: unknown, baseLocale: string): string[] {
  const normalizedBase = normalizeLocaleToken(baseLocale) ?? 'en';
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry) && entry !== normalizedBase),
    ),
  );
}

export function resolveSystemChosenAdditionalLocale(args: { baseLocale: string }): string | null {
  const baseLocale = normalizeLocaleToken(args.baseLocale) ?? 'en';
  for (const locale of SYSTEM_LOCALE_PRIORITY) {
    if (locale !== baseLocale) return locale;
  }
  return null;
}

export function materializeAccountAdditionalLocales(args: {
  profile: PolicyProfile | null | undefined;
  baseLocale: string;
  requestedLocales: unknown;
}): string[] {
  const requestedLocales = normalizeAdditionalAccountLocales(args.requestedLocales, args.baseLocale);
  if (args.profile !== 'free') return requestedLocales;
  const systemLocale = resolveSystemChosenAdditionalLocale({ baseLocale: args.baseLocale });
  return systemLocale ? [systemLocale] : [];
}

export function usesSystemChosenAdditionalLocale(profile: PolicyProfile | null | undefined): boolean {
  return profile === 'free';
}

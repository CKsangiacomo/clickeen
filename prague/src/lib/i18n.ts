import type { PragueLocale } from './locales';

// Prague chrome i18n (system-owned strings).
// - Deterministic: no runtime fetches, no fallbacks, fail-fast if missing.
// - Scope: UI chrome only (nav/tabs/common CTAs). Widget page content lives in widget-owned JSON.

export type PragueI18nKey =
  | 'nav.widgets'
  | 'nav.viewAllWidgets'
  | 'tabs.overview'
  | 'tabs.templates'
  | 'tabs.examples'
  | 'tabs.features'
  | 'tabs.pricing'
  | 'cta.createFree'
  | 'cta.seeTemplates'
  | 'common.comingSoon';

const EN: Record<PragueI18nKey, string> = {
  'nav.widgets': 'Widgets',
  'nav.viewAllWidgets': 'View all widgets',
  'tabs.overview': 'Overview',
  'tabs.templates': 'Templates',
  'tabs.examples': 'Examples',
  'tabs.features': 'Features',
  'tabs.pricing': 'Pricing',
  'cta.createFree': 'Create free',
  'cta.seeTemplates': 'See templates',
  'common.comingSoon': 'Coming soon.',
};

// Phase 1: wiring-first. These locales intentionally mirror EN until we populate real translations.
const CATALOG: Record<PragueLocale, Record<PragueI18nKey, string>> = {
  en: EN,
  es: EN,
  pt: EN,
  de: EN,
  fr: EN,
};

export function t(locale: string, key: PragueI18nKey): string {
  const l = String(locale || '').trim() as PragueLocale;
  const dict = (CATALOG as any)[l] as Record<PragueI18nKey, string> | undefined;
  if (!dict) {
    throw new Error(`[prague] Unsupported locale '${locale}' for i18n key '${key}'`);
  }
  const value = dict[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`[prague] Missing i18n string for '${l}.${key}'`);
  }
  return value;
}



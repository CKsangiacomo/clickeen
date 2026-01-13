import { PRAGUE_CANONICAL_LOCALES, type PragueLocale } from './locales';

// Prague chrome i18n (system-owned strings).
// - Deterministic: no runtime fetches, no fallbacks, fail-fast if missing.
// - Scope: UI chrome only (nav/tabs/common CTAs). Widget page content lives in widget-owned JSON.

export type PragueI18nKey =
  | 'prague.nav.widgets'
  | 'prague.nav.viewAllWidgets'
  | 'prague.tabs.overview'
  | 'prague.tabs.templates'
  | 'prague.tabs.examples'
  | 'prague.tabs.features'
  | 'prague.tabs.pricing'
  | 'prague.cta.createFree'
  | 'prague.cta.seeTemplates'
  | 'prague.common.comingSoon'
  | 'prague.creative.useThisWidgetOnYourWebsite'
  | 'prague.share.share'
  | 'prague.share.copy'
  | 'prague.share.copied'
  | 'prague.share.more'
  | 'prague.share.sms'
  | 'prague.share.email'
  | 'prague.share.whatsapp'
  | 'prague.share.telegram'
  | 'prague.share.x'
  | 'prague.share.linkedin'
  | 'prague.share.facebook'
  | 'prague.share.reddit'
  | 'prague.share.title'
  | 'prague.share.text';

const EN: Record<PragueI18nKey, string> = {
  'prague.nav.widgets': 'Widgets',
  'prague.nav.viewAllWidgets': 'View all widgets',
  'prague.tabs.overview': 'Overview',
  'prague.tabs.templates': 'Templates',
  'prague.tabs.examples': 'Examples',
  'prague.tabs.features': 'Features',
  'prague.tabs.pricing': 'Pricing',
  'prague.cta.createFree': 'Create free',
  'prague.cta.seeTemplates': 'See templates',
  'prague.common.comingSoon': 'Coming soon.',
  'prague.creative.useThisWidgetOnYourWebsite': 'Use this widget on your website',
  'prague.share.share': 'Share',
  'prague.share.copy': 'Copy link',
  'prague.share.copied': 'Copied',
  'prague.share.more': 'More',
  'prague.share.sms': 'Text message',
  'prague.share.email': 'Email',
  'prague.share.whatsapp': 'WhatsApp',
  'prague.share.telegram': 'Telegram',
  'prague.share.x': 'X',
  'prague.share.linkedin': 'LinkedIn',
  'prague.share.facebook': 'Facebook',
  'prague.share.reddit': 'Reddit',
  'prague.share.title': 'Clickeen widget',
  'prague.share.text': 'Use this widget on your website.',
};

// Phase 1: wiring-first. All canonical locales intentionally mirror EN until we populate real translations.
// This must align with config/locales.json, because Prague statically generates pages for every canonical locale.
const CATALOG: Record<string, Record<PragueI18nKey, string>> = Object.fromEntries(
  PRAGUE_CANONICAL_LOCALES.map((l) => [l, EN])
);

// IMPORTANT: Do NOT name this function `t()` — the repo-wide i18n validator extracts `t("...")`
// calls across the monorepo. Prague chrome uses its own mechanism and must not pollute Bob's i18n keyset.
export function pragueT(locale: string, key: PragueI18nKey): string {
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



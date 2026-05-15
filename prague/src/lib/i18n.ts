import { localeCandidates } from '@clickeen/l10n';
import { PRAGUE_CANONICAL_LOCALES, type PragueLocale } from './locales';
import chromeJson from '../../content/base/v1/chrome.json';

// Prague chrome i18n (system-owned strings).
// - Pre-GA PRD 098 cut: Prague widget pages do not own an overlay/layer runtime.
// - Scope: UI chrome only (nav/tabs/common CTAs). Widget overlays belong to Builder/Tokyo/Venice.

export type PragueI18nKey =
  | 'prague.nav.widgets'
  | 'prague.nav.viewAllWidgets'
  | 'prague.tabs.overview'
  | 'prague.tabs.examples'
  | 'prague.tabs.features'
  | 'prague.tabs.pricing'
  | 'prague.hero.overview.subheadOne'
  | 'prague.hero.overview.subheadTwo'
  | 'prague.hero.overview.subheadMany'
  | 'prague.cta.createFree'
  | 'prague.localeShowcase.title'
  | 'prague.localeShowcase.subtitle'
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
  | 'prague.share.signal'
  | 'prague.share.messenger'
  | 'prague.share.wechat'
  | 'prague.share.line'
  | 'prague.share.slack'
  | 'prague.share.teams'
  | 'prague.share.discord'
  | 'prague.share.x'
  | 'prague.share.linkedin'
  | 'prague.share.facebook'
  | 'prague.share.reddit'
  | 'prague.share.instagram'
  | 'prague.share.tiktok'
  | 'prague.share.sectionMessageTitle'
  | 'prague.share.sectionSocialTitle'
  | 'prague.share.title'
  | 'prague.share.text'
  | 'prague.footer.brand'
  | 'prague.footer.pricing'
  | 'prague.footer.widgets'
  | 'prague.footer.rights';

function resolveLocale(locale: string): string {
  const candidates = localeCandidates(locale, PRAGUE_CANONICAL_LOCALES);
  if (!candidates.length) {
    throw new Error(`[prague] Unsupported locale '${locale}'`);
  }
  return candidates[0];
}

function getChromeStrings(locale: string): Record<string, unknown> {
  resolveLocale(locale);
  if (!chromeJson || typeof chromeJson !== 'object' || Array.isArray(chromeJson)) {
    throw new Error('[prague] Invalid chrome base file: prague/content/base/v1/chrome.json');
  }
  const strings = (chromeJson as Record<string, unknown>).strings;
  if (!strings || typeof strings !== 'object' || Array.isArray(strings)) {
    throw new Error('[prague] Missing chrome strings: prague/content/base/v1/chrome.json');
  }
  return strings as Record<string, unknown>;
}

function getValueAtPath(root: Record<string, unknown>, pathParts: string[]): unknown {
  let cur: unknown = root;
  for (const part of pathParts) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// IMPORTANT: Do NOT name this function `t()` — the repo-wide i18n validator extracts `t("...")`
// calls across the monorepo. Prague chrome uses its own mechanism and must not pollute Bob's i18n keyset.
export async function pragueT(locale: string, key: PragueI18nKey): Promise<string> {
  const resolved = resolveLocale(String(locale || '').trim() as PragueLocale);
  const strings = getChromeStrings(resolved);
  if (!key.startsWith('prague.')) {
    throw new Error(`[prague] Invalid i18n key '${key}'`);
  }
  const pathParts = key.replace(/^prague\./, '').split('.');
  const value = getValueAtPath(strings, pathParts);
  if (typeof value !== 'string' || !value) {
    throw new Error(`[prague] Missing i18n string for '${resolved}.${key}'`);
  }
  return value;
}

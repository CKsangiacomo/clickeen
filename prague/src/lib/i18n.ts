import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localeCandidates } from '@clickeen/l10n';
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

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const STRINGS_ROOT = path.join(REPO_ROOT, 'prague-strings', 'compiled', 'v1');

const chromeCache = new Map<string, Record<string, unknown>>();

function resolveLocale(locale: string): string {
  const candidates = localeCandidates(locale, PRAGUE_CANONICAL_LOCALES);
  if (!candidates.length) {
    throw new Error(`[prague] Unsupported locale '${locale}'`);
  }
  return candidates[0];
}

function loadChromeStringsSync(locale: string): Record<string, unknown> {
  const filePath = path.join(STRINGS_ROOT, locale, 'chrome.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw) as unknown;
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`[prague] Invalid chrome strings file: ${filePath}`);
  }
  const v = (json as any).v;
  const strings = (json as any).strings;
  if (v !== 1 || !strings || typeof strings !== 'object' || Array.isArray(strings)) {
    throw new Error(`[prague] Invalid chrome strings shape: ${filePath}`);
  }
  return strings as Record<string, unknown>;
}

function getChromeStrings(locale: string): Record<string, unknown> {
  if (!chromeCache.has(locale)) {
    chromeCache.set(locale, loadChromeStringsSync(locale));
  }
  return chromeCache.get(locale) as Record<string, unknown>;
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
export function pragueT(locale: string, key: PragueI18nKey): string {
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


import marketsJson from '../../../config/markets.json';
import { PRAGUE_CANONICAL_LOCALES } from './locales';

const MARKETS_FILE_LABEL = 'config/markets.json';
const MARKET_KEY_REGEX = /^[a-z][a-z0-9-]{0,31}$/;
const COUNTRY_REGEX = /^[A-Z]{2}$/;

export type PragueMarket = {
  key: string;
  country: string | null;
  defaultLocale: string;
  locales: string[];
};

export type PragueMarketsConfig = {
  v: 1;
  markets: PragueMarket[];
};

function normalizeMarketsConfig(raw: unknown): PragueMarketsConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`[prague] Invalid markets config (expected object): ${MARKETS_FILE_LABEL}`);
  }

  const v = (raw as any).v;
  if (v !== 1) {
    throw new Error(`[prague] Invalid markets config version (expected v=1): ${MARKETS_FILE_LABEL}`);
  }

  const marketsRaw = (raw as any).markets;
  if (!Array.isArray(marketsRaw)) {
    throw new Error(`[prague] Invalid markets config (expected markets[]): ${MARKETS_FILE_LABEL}`);
  }

  const seenKeys = new Set<string>();
  const markets: PragueMarket[] = marketsRaw.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`[prague] Invalid markets[${index}] entry (expected object): ${MARKETS_FILE_LABEL}`);
    }

    const key = String((entry as any).key || '').trim().toLowerCase();
    if (!MARKET_KEY_REGEX.test(key)) {
      throw new Error(`[prague] Invalid markets[${index}].key "${key}": ${MARKETS_FILE_LABEL}`);
    }
    if (seenKeys.has(key)) {
      throw new Error(`[prague] Duplicate markets key "${key}": ${MARKETS_FILE_LABEL}`);
    }
    seenKeys.add(key);

    const countryRaw = (entry as any).country;
    const country = countryRaw == null ? null : String(countryRaw || '').trim().toUpperCase();
    if (country !== null && !COUNTRY_REGEX.test(country)) {
      throw new Error(`[prague] Invalid markets[${index}].country "${country}": ${MARKETS_FILE_LABEL}`);
    }

    const defaultLocale = String((entry as any).defaultLocale || '').trim().toLowerCase();
    if (!defaultLocale) {
      throw new Error(`[prague] Missing markets[${index}].defaultLocale: ${MARKETS_FILE_LABEL}`);
    }
    if (!PRAGUE_CANONICAL_LOCALES.includes(defaultLocale)) {
      throw new Error(
        `[prague] Invalid markets[${index}].defaultLocale "${defaultLocale}" (not in config/locales.json): ${MARKETS_FILE_LABEL}`,
      );
    }

    const localesRaw = (entry as any).locales;
    if (!Array.isArray(localesRaw)) {
      throw new Error(`[prague] Invalid markets[${index}].locales (expected string[]): ${MARKETS_FILE_LABEL}`);
    }
    const locales = localesRaw
      .map((l) => (typeof l === 'string' ? l.trim().toLowerCase() : ''))
      .filter(Boolean);
    if (!locales.length) {
      throw new Error(`[prague] Invalid markets[${index}].locales (empty): ${MARKETS_FILE_LABEL}`);
    }
    for (const l of locales) {
      if (!PRAGUE_CANONICAL_LOCALES.includes(l)) {
        throw new Error(
          `[prague] Invalid markets[${index}].locales entry "${l}" (not in config/locales.json): ${MARKETS_FILE_LABEL}`,
        );
      }
    }

    const localesUnique = Array.from(new Set(locales));
    if (!localesUnique.includes(defaultLocale)) {
      throw new Error(
        `[prague] Invalid markets[${index}] (defaultLocale not in locales): ${MARKETS_FILE_LABEL}`,
      );
    }

    return { key, country, defaultLocale, locales: localesUnique };
  });

  return { v: 1, markets };
}

export const PRAGUE_MARKETS: PragueMarketsConfig = normalizeMarketsConfig(marketsJson);

const MARKETS_BY_KEY = new Map<string, PragueMarket>(PRAGUE_MARKETS.markets.map((m) => [m.key, m]));

export function listPragueMarkets(): string[] {
  return PRAGUE_MARKETS.markets.map((m) => m.key);
}

export function getPragueMarket(market: string): PragueMarket | null {
  const key = String(market || '').trim().toLowerCase();
  return MARKETS_BY_KEY.get(key) ?? null;
}

export function isValidMarket(market: string): boolean {
  return Boolean(getPragueMarket(market));
}

export function isValidLocaleForMarket(args: { market: string; locale: string }): boolean {
  const m = getPragueMarket(args.market);
  if (!m) return false;
  const locale = String(args.locale || '').trim().toLowerCase();
  return m.locales.includes(locale);
}

export function resolveMarketDefaultLocale(market: string): string | null {
  const m = getPragueMarket(market);
  return m ? m.defaultLocale : null;
}

export function resolveMarketCountry(market: string): string | null {
  const m = getPragueMarket(market);
  return m ? m.country : null;
}

export function resolveMarketFromCountry(country: string | null): PragueMarket | null {
  const c = String(country || '').trim().toUpperCase();
  if (!c || c === 'XX') return null;
  return PRAGUE_MARKETS.markets.find((m) => m.country === c) ?? null;
}

function toTitleCase(value: string): string {
  if (!value) return value;
  return value[0]!.toUpperCase() + value.slice(1).toLowerCase();
}

function hasRegionSubtag(parts: string[]): boolean {
  return parts.some((part) => /^[a-z]{2}$/.test(part) || /^\d{3}$/.test(part));
}

// BCP47-ish hreflang formatting. Google is case-insensitive, but case it nicely.
// - Language: lower (en)
// - Script: TitleCase (Hans)
// - Region: upper (GB)
export function toMarketHreflang(args: { locale: string; country: string | null }): string {
  const locale = String(args.locale || '').trim().toLowerCase().replace(/_/g, '-');
  const rawParts = locale.split('-').filter(Boolean);
  if (!rawParts.length) return 'en';

  const [languageRaw, ...restRaw] = rawParts;
  const parts: string[] = [String(languageRaw || '').toLowerCase()];

  const hasRegion = hasRegionSubtag(restRaw);
  for (const part of restRaw) {
    if (/^[a-z]{4}$/.test(part)) {
      parts.push(toTitleCase(part));
      continue;
    }
    if (/^[a-z]{2}$/.test(part)) {
      parts.push(part.toUpperCase());
      continue;
    }
    if (/^\d{3}$/.test(part)) {
      parts.push(part);
      continue;
    }
    parts.push(part.toLowerCase());
  }

  if (!hasRegion && args.country) {
    parts.push(String(args.country).toUpperCase());
  }

  return parts.join('-');
}

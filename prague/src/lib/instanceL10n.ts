import { normalizeCanonicalLocalesFile, normalizeLocaleToken, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '../../../config/locales.json';
import type { PragueMarket } from './markets';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);

type InstanceLayerIndex = {
  v: 1;
  publicId: string;
  layers?: {
    locale?: {
      keys?: string[];
    };
  };
};

function readEnv(name: string): string | undefined {
  const proc = typeof process !== 'undefined' ? process : undefined;
  const procValue = proc?.env ? proc.env[name] : undefined;
  if (typeof procValue === 'string' && procValue.trim()) return procValue.trim();
  return undefined;
}

function getTokyoBaseUrl(): string {
  const meta = String((import.meta as any)?.env?.PUBLIC_TOKYO_URL || '').trim();
  const raw = meta || readEnv('PUBLIC_TOKYO_URL') || '';
  if (!raw.trim()) {
    throw new Error('[prague] PUBLIC_TOKYO_URL is required to resolve instance locales');
  }
  return raw.replace(/\/+$/, '');
}

function getPragueBuildId(): string | null {
  const metaEnv = (import.meta as any)?.env || {};
  const metaPublic = String(metaEnv.PUBLIC_PRAGUE_BUILD_ID || '').trim();
  const metaCommit = String(metaEnv.CF_PAGES_COMMIT_SHA || '').trim();
  const raw = metaPublic || metaCommit || readEnv('PUBLIC_PRAGUE_BUILD_ID') || readEnv('CF_PAGES_COMMIT_SHA') || '';
  return raw.trim() ? raw.trim() : null;
}

async function fetchJson(url: string): Promise<{ status: number; ok: boolean; json: unknown | null }> {
  const res = await fetch(url, { method: 'GET' });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

function normalizeLocaleKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return keys
    .map((k) => normalizeLocaleToken(k))
    .filter((k): k is string => Boolean(k));
}

export async function resolveTokyoInstanceLocales(publicId: string): Promise<string[] | null> {
  const id = String(publicId || '').trim();
  if (!id) return null;

  const baseUrl = getTokyoBaseUrl();
  const buildId = getPragueBuildId();

  const candidates: string[] = [];
  if (buildId) {
    candidates.push(`${baseUrl}/l10n/v/${encodeURIComponent(buildId)}/instances/${encodeURIComponent(id)}/index.json`);
  }
  candidates.push(`${baseUrl}/l10n/instances/${encodeURIComponent(id)}/index.json`);

  for (const url of candidates) {
    const { status, ok, json } = await fetchJson(url);
    if (status === 404) continue;
    if (!ok || !json || typeof json !== 'object') return null;

    const parsed = json as InstanceLayerIndex;
    if (parsed.v !== 1) return null;

    const keys = normalizeLocaleKeys(parsed.layers?.locale?.keys);
    if (!keys.length) return null;

    // Keep stable order but ensure 'en' is present.
    const unique = Array.from(new Set(keys));
    if (!unique.includes('en')) unique.unshift('en');
    return unique;
  }

  return null;
}

export function chooseShowcaseTiles(allLocales: string[]): string[] {
  const unique = Array.from(new Set(allLocales.map((l) => normalizeLocaleToken(l)).filter((l): l is string => Boolean(l))));
  const preferred = ['en', 'es', 'ja'];
  const picked: string[] = [];
  for (const p of preferred) {
    if (unique.includes(p)) picked.push(p);
  }
  for (const l of unique) {
    if (picked.length >= 3) break;
    if (!picked.includes(l)) picked.push(l);
  }
  return picked.slice(0, 3);
}

type OverviewHeroLocalesArgs = {
  market: PragueMarket | null;
  instanceLocales: string[];
  max?: number;
};

export function chooseOverviewHeroLocales(args: OverviewHeroLocalesArgs): { locales: string[]; availableLocales: string[] } {
  const max = Number.isFinite(args.max) ? Math.max(1, Number(args.max)) : 3;
  const instanceUnique = Array.from(
    new Set(args.instanceLocales.map((l) => normalizeLocaleToken(l)).filter((l): l is string => Boolean(l))),
  );
  const market = args.market;
  const marketLocales = market
    ? Array.from(new Set(market.locales.map((l) => normalizeLocaleToken(l)).filter((l): l is string => Boolean(l))))
    : instanceUnique;
  const availableLocales = market ? instanceUnique.filter((l) => marketLocales.includes(l)) : instanceUnique;
  if (!availableLocales.length) return { locales: [], availableLocales: [] };

  const strategy = market?.overviewHero.strategy ?? 'tier1';
  const priority: string[] = [];

  if (strategy === 'tier1') {
    priority.push(...(market?.overviewHero.tier1Locales ?? []));
  } else {
    priority.push(market?.overviewHero.nativeLocale ?? market?.defaultLocale ?? 'en');
    priority.push('en');
  }

  priority.push(market?.defaultLocale ?? 'en');
  priority.push(...(market?.overviewHero.regionalFallbackLocales ?? []));
  priority.push(...availableLocales);

  const selected: string[] = [];
  for (const candidateRaw of priority) {
    const candidate = normalizeLocaleToken(candidateRaw);
    if (!candidate) continue;
    if (!availableLocales.includes(candidate)) continue;
    if (selected.includes(candidate)) continue;
    selected.push(candidate);
    if (selected.length >= max) break;
  }

  if (selected.length < max) {
    for (const localeCode of availableLocales) {
      if (selected.includes(localeCode)) continue;
      selected.push(localeCode);
      if (selected.length >= max) break;
    }
  }

  return { locales: selected.slice(0, max), availableLocales };
}

const OVERVIEW_HERO_MIN_NAMED_LOCALES = 2;
const OVERVIEW_HERO_MAX_NAMED_LOCALES = 4;

function clampOverviewHeroNamedLocaleCount(value: number): number {
  return Math.min(OVERVIEW_HERO_MAX_NAMED_LOCALES, Math.max(OVERVIEW_HERO_MIN_NAMED_LOCALES, value));
}

export function resolveOverviewHeroNamedLocaleCount(market: PragueMarket | null): number {
  if (!market) return 3;

  const strategy = market.overviewHero.strategy;
  if (strategy === 'tier1') {
    return clampOverviewHeroNamedLocaleCount(market.overviewHero.tier1Locales.length);
  }

  const marketLocales = new Set(
    market.locales.map((localeCode) => normalizeLocaleToken(localeCode)).filter((localeCode): localeCode is string => Boolean(localeCode)),
  );
  const priority = Array.from(
    new Set(
      [
        market.overviewHero.nativeLocale ?? market.defaultLocale,
        'en',
        ...market.overviewHero.regionalFallbackLocales,
      ]
        .map((localeCode) => normalizeLocaleToken(localeCode))
        .filter((localeCode): localeCode is string => Boolean(localeCode)),
    ),
  );
  const inMarketPriorityCount = priority.filter((localeCode) => marketLocales.has(localeCode)).length;
  return clampOverviewHeroNamedLocaleCount(inMarketPriorityCount);
}

export function sortLocaleOptions(locales: string[]): string[] {
  const unique = Array.from(new Set(locales.map((l) => normalizeLocaleToken(l)).filter((l): l is string => Boolean(l))));
  const pinned = ['en', 'es', 'ja'];
  const pinnedSet = new Set(pinned);
  const head = pinned.filter((l) => unique.includes(l));
  const tail = unique.filter((l) => !pinnedSet.has(l)).sort((a, b) => a.localeCompare(b));
  return [...head, ...tail];
}

export function localeLabel(locale: string, uiLocale = 'en'): string {
  return resolveLocaleLabel({ locales: CANONICAL_LOCALES, uiLocale, targetLocale: locale });
}

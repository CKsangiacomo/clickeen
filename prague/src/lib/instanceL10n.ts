import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { normalizeCanonicalLocalesFile, normalizeLocaleToken, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import type { PragueMarket } from './markets';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);

export async function resolveTokyoInstanceLocales(accountPublicId: string, instanceId: string): Promise<string[] | null> {
  const accountId = String(accountPublicId || '').trim();
  const id = String(instanceId || '').trim();
  if (!isCompactAccountPublicId(accountId) || !isCompactInstanceId(id)) return null;
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

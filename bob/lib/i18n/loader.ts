import { resolveTokyoBaseUrl } from '../env/tokyo';

type CatalogValue = string | Record<string, string>;
type Catalog = Record<string, CatalogValue>;

export type I18nManifest = {
  v: number;
  gitSha: string;
  locales: Record<string, { dir: 'ltr' | 'rtl' }>;
  bundles: Record<string, Record<string, string>>;
};

const manifestCache = new Map<string, Promise<I18nManifest>>();
const catalogCache = new Map<string, Promise<Catalog>>();

export function resolveLocale(): string {
  if (typeof window === 'undefined') return 'en';

  const fromQuery = new URLSearchParams(window.location.search).get('locale')?.trim();
  if (fromQuery) return fromQuery.toLowerCase();

  const cookieMatch = document.cookie.match(/(?:^|;\s*)ck_locale=([^;]+)/);
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1] || '').trim() : '';
  if (fromCookie) return fromCookie.toLowerCase();

  const nav = (navigator.language || '').trim();
  if (nav) return nav.split('-')[0]?.toLowerCase() || 'en';
  return 'en';
}

export function resolveTokyoI18nBaseUrl(): string {
  return `${resolveTokyoBaseUrl().replace(/\/+$/, '')}/i18n`;
}

export async function loadI18nManifest(): Promise<I18nManifest> {
  const base = resolveTokyoI18nBaseUrl();
  const url = `${base}/manifest.json`;
  const cached = manifestCache.get(url);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`[i18n] Failed to load manifest (${res.status}) ${url}`);
    const json = (await res.json()) as I18nManifest;
    if (!json || typeof json !== 'object' || typeof json.v !== 'number') {
      throw new Error(`[i18n] Invalid manifest ${url}`);
    }
    if (!json.locales || typeof json.locales !== 'object') throw new Error(`[i18n] manifest.locales missing (${url})`);
    if (!json.bundles || typeof json.bundles !== 'object') throw new Error(`[i18n] manifest.bundles missing (${url})`);
    return json;
  })();
  manifestCache.set(url, promise);
  return promise;
}

async function loadCatalogFile(locale: string, bundle: string): Promise<Catalog> {
  const manifest = await loadI18nManifest();
  const base = resolveTokyoI18nBaseUrl();

  const resolveFile = (candidate: string): string | null => {
    const file = manifest.bundles?.[candidate]?.[bundle];
    return typeof file === 'string' && file.trim() ? file.trim() : null;
  };

  const chosenLocale = resolveFile(locale) ? locale : resolveFile('en') ? 'en' : null;
  if (!chosenLocale) return {};

  const file = resolveFile(chosenLocale);
  if (!file) return {};

  const url = `${base}/${encodeURIComponent(chosenLocale)}/${encodeURIComponent(file)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[i18n] Failed to load catalog (${res.status}) ${url}`);
  const json = (await res.json()) as Catalog;
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`[i18n] Invalid catalog ${url}`);
  }
  return json;
}

export async function loadI18nCatalog(locale: string, bundle: string): Promise<Catalog> {
  const key = `${locale}::${bundle}`;
  const cached = catalogCache.get(key);
  if (cached) return cached;
  const promise = loadCatalogFile(locale, bundle);
  catalogCache.set(key, promise);
  return promise;
}

export function createTranslator(args: {
  locale: string;
  coreui: Catalog;
  widget: Catalog;
}): (key: string, params?: Record<string, unknown>) => string {
  const pluralRules = new Intl.PluralRules(args.locale);

  const interpolate = (text: string, params: Record<string, unknown>) =>
    text.replace(/\{(\w+)\}/g, (_m, name: string) => {
      const value = params[name];
      return value == null ? '' : String(value);
    });

  return (key: string, params: Record<string, unknown> = {}) => {
    const dict = key.startsWith('coreui.') ? args.coreui : args.widget;
    const raw = dict[key];
    if (raw == null) return key;

    if (typeof raw === 'string') return interpolate(raw, params);

    const countRaw = params.count;
    const count = typeof countRaw === 'number' && Number.isFinite(countRaw) ? countRaw : 0;
    const form = pluralRules.select(count);
    const chosen = raw[form] ?? raw.other;
    if (typeof chosen !== 'string') return key;
    return interpolate(chosen, params);
  };
}


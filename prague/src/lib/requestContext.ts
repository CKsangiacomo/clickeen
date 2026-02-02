import type { PragueOverlayContext } from './pragueL10n';
import { resolveMarketCountry } from './markets';

type ParsedCookies = Record<string, string>;

function parseCookies(header: string | null): ParsedCookies {
  if (!header) return {};
  return header.split(';').reduce<ParsedCookies>((acc, part) => {
    const [rawKey, ...rest] = part.split('=');
    const key = String(rawKey || '').trim();
    if (!key) return acc;
    const value = rest.join('=').trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function parseList(value?: string | null): string[] | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? Array.from(new Set(parts)) : null;
}

function isDev(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

export function getPragueOverlayContext(req: Request): PragueOverlayContext {
  const cookies = parseCookies(req.headers.get('cookie'));
  const url = new URL(req.url);

  const geoHeader = req.headers.get('cf-ipcountry');
  const geoOverride = isDev() ? url.searchParams.get('geo') || url.searchParams.get('country') : null;
  const country = geoOverride ? geoOverride.toUpperCase() : geoHeader && geoHeader !== 'XX' ? geoHeader : null;

  const industry = url.searchParams.get('industry') || cookies.ck_industry || '';
  const account = url.searchParams.get('account') || cookies.ck_account || '';
  const experimentRaw = url.searchParams.get('exp') || cookies.ck_exp || '';
  const behaviorRaw = url.searchParams.get('behavior') || cookies.ck_behavior || '';

  return {
    country,
    layerContext: {
      industryKey: industry || null,
      accountKey: account || null,
      experimentKeys: parseList(experimentRaw),
      behaviorKeys: parseList(behaviorRaw),
    },
  };
}

export function getPragueCanonicalOverlayContext(args: { req: Request; market: string }): PragueOverlayContext {
  const country = resolveMarketCountry(args.market);
  return { country, layerContext: undefined };
}

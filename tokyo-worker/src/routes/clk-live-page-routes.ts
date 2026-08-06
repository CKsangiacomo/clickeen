import { isCompactAccountPublicId, isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { completePagePublicHtml, readAccountPage } from '../domains/pages';
import { respondMethodNotAllowed, type TokyoRouteArgs } from '../route-helpers';

type ParsedPagePath = {
  accountId: string;
  pageId: string;
  target: 'stable' | 'locale' | 'styles.css' | 'runtime.js';
  locale?: string;
};

function noStoreResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      'cache-control': 'no-store',
      'cdn-cache-control': 'no-store',
      'cloudflare-cdn-cache-control': 'no-store',
    },
  });
}

function parsePagePath(pathname: string): ParsedPagePath | null {
  if (pathname.includes('%2f') || pathname.includes('%2F') || pathname.includes('\\')) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('..') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter(Boolean);
  if (segments.length !== 3 && segments.length !== 4) return null;
  const [accountId, pages, pageId, last] = segments;
  if (pages !== 'pages' || !isCompactAccountPublicId(accountId) || !isCompactPageId(pageId)) return null;
  if (!last) return { accountId, pageId, target: 'stable' };
  if (last === 'styles.css' || last === 'runtime.js') return { accountId, pageId, target: last };
  return { accountId, pageId, target: 'locale', locale: last };
}

function localeParts(locale: string): { language: string; region: string | null } {
  const [language = '', ...rest] = locale.toLowerCase().split('-');
  const region = rest.find((part) => part.length === 2 || /^\d{3}$/.test(part)) ?? null;
  return { language, region };
}

function preferredLocale(args: {
  available: string[];
  acceptLanguage: string | null;
  country: string | null;
  baseLocale: string;
}): string {
  const ranked = String(args.acceptLanguage || '')
    .split(',')
    .map((part, index) => {
      const [rawLocale, ...params] = part.trim().split(';');
      const quality = params.reduce((value, param) => {
        const match = param.trim().match(/^q=(0(?:\.\d+)?|1(?:\.0+)?)$/);
        return match ? Number(match[1]) : value;
      }, 1);
      return { rawLocale: rawLocale.toLowerCase(), quality, index };
    })
    .filter((entry) => entry.rawLocale && entry.rawLocale !== '*' && entry.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);
  for (const preference of ranked) {
    const exact = args.available.find((locale) => locale.toLowerCase() === preference.rawLocale);
    if (exact) return exact;
    const language = localeParts(preference.rawLocale).language;
    const languageMatch = args.available.find((locale) => localeParts(locale).language === language);
    if (languageMatch) return languageMatch;
  }
  const country = String(args.country || '').trim().toLowerCase();
  if (country) {
    const regional = args.available.find((locale) => localeParts(locale).region === country);
    if (regional) return regional;
  }
  return args.baseLocale;
}

function publicHeaders(contentType: string, cacheControl: string): Headers {
  const headers = new Headers({
    'content-type': contentType,
    'cache-control': cacheControl,
    'cdn-cache-control': cacheControl,
    'cloudflare-cdn-cache-control': cacheControl,
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
  });
  return headers;
}

export async function tryHandleClkLivePageRoutes(args: TokyoRouteArgs): Promise<Response | null> {
  const parsed = parsePagePath(args.pathname);
  if (!parsed) return null;
  if (args.req.method !== 'GET' && args.req.method !== 'HEAD') return respondMethodNotAllowed(args.respond);

  let page: Awaited<ReturnType<typeof readAccountPage>>;
  try {
    page = await readAccountPage({ env: args.env, accountId: parsed.accountId, pageId: parsed.pageId });
  } catch {
    return args.respond(noStoreResponse('Page unavailable', 500));
  }
  if (!page || page.source.isTemplate || !page.serveState.published) {
    return args.respond(noStoreResponse('Page not found', 404));
  }

  if (parsed.target === 'styles.css' || parsed.target === 'runtime.js') {
    const body = parsed.target === 'styles.css' ? page.files.stylesCss : page.files.runtimeJs;
    const contentType = parsed.target === 'styles.css'
      ? 'text/css; charset=utf-8'
      : 'text/javascript; charset=utf-8';
    return args.respond(new Response(args.req.method === 'HEAD' ? null : body, {
      status: 200,
      headers: publicHeaders(contentType, 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'),
    }));
  }

  const available = [page.source.baseLocale, ...Object.keys(page.overlaysJson)];
  if (parsed.target === 'stable') {
    const locale = preferredLocale({
      available,
      acceptLanguage: args.req.headers.get('accept-language'),
      country: String((args.req as Request & { cf?: { country?: unknown } }).cf?.country || args.req.headers.get('cf-ipcountry') || ''),
      baseLocale: page.source.baseLocale,
    });
    return args.respond(new Response(null, {
      status: 302,
      headers: {
        location: `${args.url.origin}/${parsed.accountId}/pages/${parsed.pageId}/${encodeURIComponent(locale)}`,
        'cache-control': 'no-store',
        'cdn-cache-control': 'no-store',
        'cloudflare-cdn-cache-control': 'no-store',
      },
    }));
  }

  const locale = parsed.locale ?? '';
  if (!available.includes(locale)) return args.respond(noStoreResponse('Locale not available', 404));
  try {
    const html = completePagePublicHtml({
      html: page.files.indexHtml,
      baseLocale: page.source.baseLocale,
      locale,
      pageUrl: `${args.url.origin}/${parsed.accountId}/pages/${parsed.pageId}`,
      ...(locale === page.source.baseLocale ? {} : { overlay: page.overlaysJson[locale] }),
    });
    return args.respond(new Response(args.req.method === 'HEAD' ? null : html, {
      status: 200,
      headers: publicHeaders('text/html; charset=utf-8', 'public, max-age=0, s-maxage=300, must-revalidate'),
    }));
  } catch {
    return args.respond(noStoreResponse('Page locale data invalid', 500));
  }
}

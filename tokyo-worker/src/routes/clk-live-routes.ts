import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { normalizeLocale } from '../asset-utils';
import { accountInstanceCacheTag } from '../domains/account-instances/keys';
import { publicPackageFileBody } from '../domains/account-instances/package-files';
import {
  isPublicPackageFile,
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
  type PublicPackageFile,
} from '../domains/account-instances/package-file-names';
import { readInstanceServeStateRecord } from '../domains/account-instances/serve-state';
import { readConfigDocumentByLocation } from '../domains/account-instances/source';
import {
  listLocaleOverlayCoordinates,
  readLocaleOverlay,
} from '../domains/account-translations/overlays';
import { respondMethodNotAllowed, type TokyoRouteArgs } from '../route-helpers';

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: {
      'cache-control': 'no-store',
      'cdn-cache-control': 'no-store',
      'cloudflare-cdn-cache-control': 'no-store',
    },
  });
}

function localeNotAvailable(): Response {
  return new Response('Locale not available', {
    status: 404,
    headers: {
      'cache-control': 'no-store',
      'cdn-cache-control': 'no-store',
      'cloudflare-cdn-cache-control': 'no-store',
    },
  });
}

function localeDataInvalid(): Response {
  return new Response('Locale data invalid', {
    status: 500,
    headers: {
      'cache-control': 'no-store',
      'cdn-cache-control': 'no-store',
      'cloudflare-cdn-cache-control': 'no-store',
    },
  });
}

function parseClkLivePath(pathname: string): {
  kind: 'instance';
  accountId: string;
  instanceId: string;
  file: PublicPackageFile;
} | null {
  if (pathname.includes('%2f') || pathname.includes('%2F') || pathname.includes('\\')) return null;
  let decoded = '';
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('..') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter(Boolean);

  if (segments.length !== 2 && segments.length !== 3) return null;
  const [accountId, instanceId, requestedFile] = segments;
  if (!isCompactAccountPublicId(accountId) || !isCompactInstanceId(instanceId)) return null;
  const file = requestedFile ?? PUBLIC_INDEX_FILE;
  if (!isPublicPackageFile(file)) return null;
  return { kind: 'instance', accountId, instanceId, file };
}

function cacheControlForGeneratedFile(file: string): string {
  if (file === PUBLIC_INDEX_FILE || file === PUBLIC_STYLES_FILE || file === PUBLIC_RUNTIME_FILE) {
    return 'public, max-age=60, s-maxage=300, must-revalidate';
  }
  return 'public, max-age=31536000, immutable';
}

function responseForPackageFile(
  file: PublicPackageFile,
  body: string,
  headOnly: boolean,
  accountId: string,
  instanceId: string,
): Response {
  const contentType =
    file === PUBLIC_INDEX_FILE
      ? 'text/html; charset=utf-8'
      : file === PUBLIC_STYLES_FILE
        ? 'text/css; charset=utf-8'
        : 'text/javascript; charset=utf-8';
  const cacheControl = cacheControlForGeneratedFile(file);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  headers.set('cdn-cache-control', cacheControl);
  headers.set('cloudflare-cdn-cache-control', cacheControl);
  headers.set('cache-tag', accountInstanceCacheTag(accountId, instanceId));
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(headOnly ? null : body, { status: 200, headers });
}

function responseForIndex(args: {
  response: Response;
  locale: string;
  languages: string[];
  values?: Record<string, string>;
}): Response {
  const rewriter = new HTMLRewriter()
    .on('html', {
      element(element) {
        element.setAttribute('lang', args.locale);
      },
    })
    .on('.ck-locale-switcher__select', {
      element(element) {
        element.setInnerContent(
          args.languages
            .map((language) => `<option value="${language}">${language}</option>`)
            .join(''),
          { html: true },
        );
      },
    });
  if (args.values) {
    rewriter.on('[data-ck-content-path]', {
      element(element) {
        applyLocaleOverlayToContentSlot({
          element,
          values: args.values!,
        });
      },
    });
  }
  return rewriter.transform(args.response);
}

type ContentSlotElement = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): ContentSlotElement;
  setInnerContent(content: string, options?: { html?: boolean }): ContentSlotElement;
};

export function applyLocaleOverlayToContentSlot(args: {
  element: ContentSlotElement;
  values: Record<string, string>;
}): void {
  const coordinate = args.element.getAttribute('data-ck-content-path')!;
  const value = args.values[coordinate];
  if (value === undefined) return;
  const attribute = args.element.getAttribute('data-ck-content-attribute');
  if (attribute !== null) {
    args.element.setAttribute(attribute, value);
    return;
  }
  args.element.setInnerContent(value, {
    html: args.element.getAttribute('data-ck-content-mode') === 'html',
  });
}

export async function tryHandleClkLiveStaticRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, url, respond } = args;

  if (url.protocol === 'http:' && (url.hostname === 'clk.live' || url.hostname === 'dev.clk.live')) {
    url.protocol = 'https:';
    return respond(new Response(null, { status: 301, headers: { location: url.toString() } }));
  }

  const parsed = parseClkLivePath(pathname);
  if (!parsed) return null;
  if (req.method !== 'GET' && req.method !== 'HEAD') return respondMethodNotAllowed(respond);

  const config = await readConfigDocumentByLocation({
    env,
    accountId: parsed.accountId,
    widgetCode: '',
    instanceId: parsed.instanceId,
  });
  if (!config) return respond(notFound());
  const publication = await readInstanceServeStateRecord({
    env,
    accountId: parsed.accountId,
    instanceId: parsed.instanceId,
    widgetCode: config.widgetCode,
  });
  if (publication.status !== 'published') return respond(notFound());
  const body = publicPackageFileBody(publication.publicPackage, parsed.file);

  if (parsed.file === PUBLIC_INDEX_FILE) {
    const localeParams = url.searchParams.getAll('locale');
    if (localeParams.length > 1) return respond(localeNotAvailable());
    const rawLocale = localeParams[0];
    const locale = typeof rawLocale === 'string' ? normalizeLocale(rawLocale) : config.baseLocale;
    if (!locale || (typeof rawLocale === 'string' && locale !== rawLocale)) return respond(localeNotAvailable());
    const baseResponse = responseForPackageFile(
      parsed.file,
      body,
      req.method === 'HEAD',
      parsed.accountId,
      parsed.instanceId,
    );
    if (locale === config.baseLocale) {
      if (req.method === 'HEAD') return respond(baseResponse);
      const overlayLocales = await listLocaleOverlayCoordinates({
        env,
        accountId: parsed.accountId,
        widgetCode: config.widgetCode,
        instanceId: parsed.instanceId,
      });
      const languages = [config.baseLocale, ...overlayLocales];
      return respond(responseForIndex({ response: baseResponse, locale, languages }));
    }
    let overlay: Awaited<ReturnType<typeof readLocaleOverlay>>;
    try {
      overlay = await readLocaleOverlay({
        env,
        accountId: parsed.accountId,
        widgetCode: config.widgetCode,
        instanceId: parsed.instanceId,
        locale,
      });
    } catch {
      return respond(localeDataInvalid());
    }
    if (!overlay) return respond(localeNotAvailable());
    if (req.method === 'HEAD') return respond(baseResponse);
    const overlayLocales = await listLocaleOverlayCoordinates({
      env,
      accountId: parsed.accountId,
      widgetCode: config.widgetCode,
      instanceId: parsed.instanceId,
    });
    const languages = [config.baseLocale, ...overlayLocales];
    return respond(responseForIndex({
      response: baseResponse,
      locale,
      languages,
      values: overlay.values,
    }));
  }
  return respond(
    responseForPackageFile(
      parsed.file,
      body,
      req.method === 'HEAD',
      parsed.accountId,
      parsed.instanceId,
    ),
  );
}

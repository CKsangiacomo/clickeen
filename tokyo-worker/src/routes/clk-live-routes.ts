import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { normalizeLocale } from '../asset-utils';
import { readAccountInstanceSourcePointer } from '../domains/account-instances/source';
import { publicPackageContentType } from '../domains/public-package-serve-metadata';
import {
  isPublicPackageFile,
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
  type PublicPackageFile,
} from '../domains/account-instances/package-file-names';
import {
  verifyInstancePublicPackageReady,
} from '../domains/account-instances/package-files';
import { completeLocalizedInstanceHtml } from '../domains/account-translations/localized-html';
import { readAccountInstanceTranslatedLocaleValues } from '../domains/account-translations/values';
import { listLocaleOverlayCoordinates } from '../domains/account-translations/overlays';
import { respondMethodNotAllowed, type TokyoRouteArgs } from '../route-helpers';

function notFound(): Response {
  return new Response('Not found', { status: 404 });
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

function publicHtmlInvalid(): Response {
  return new Response('Public HTML invalid', {
    status: 500,
    headers: {
      'cache-control': 'no-store',
      'cdn-cache-control': 'no-store',
      'cloudflare-cdn-cache-control': 'no-store',
    },
  });
}

function completeInstancePublicCoordinates(args: {
  html: string;
  accountId: string;
  instanceId: string;
}): string {
  const completed = args.html
    .replaceAll('__CK_PUBLIC_ACCOUNT_ID__', args.accountId)
    .replaceAll('__CK_PUBLIC_INSTANCE_ID__', args.instanceId);
  if (/__CK_PUBLIC_[A-Z0-9_]+__/.test(completed)) {
    throw new Error('ck.public_html.placeholder_unresolved');
  }
  return completed;
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

function instanceObjectKey(accountId: string, instanceId: string, file: string): string {
  return `accounts/${accountId}/instances/${instanceId}/${file}`;
}

function cacheControlForGeneratedFile(file: string): string {
  if (file === PUBLIC_INDEX_FILE || file === PUBLIC_STYLES_FILE || file === PUBLIC_RUNTIME_FILE) {
    return 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';
  }
  return 'public, max-age=31536000, immutable';
}

function responseForObject(
  key: string,
  file: string,
  obj: { body: ReadableStream | null; httpMetadata?: { contentType?: string | null } | null },
  headOnly: boolean,
): Response {
  const contentType = publicPackageContentType(obj);
  if (!contentType) return new Response('Invalid asset metadata', { status: 500 });
  const cacheControl = cacheControlForGeneratedFile(file);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  headers.set('cdn-cache-control', cacheControl);
  headers.set('cloudflare-cdn-cache-control', cacheControl);
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(headOnly ? null : obj.body, { status: 200, headers });
}

function responseForCompletedIndex(html: string, contentType: string, headOnly: boolean): Response {
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', 'no-store');
  headers.set('cdn-cache-control', 'no-store');
  headers.set('cloudflare-cdn-cache-control', 'no-store');
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(headOnly ? null : html, { status: 200, headers });
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

  const pointer = await readAccountInstanceSourcePointer({
    env,
    accountId: parsed.accountId,
    instanceId: parsed.instanceId,
  });
  if (!pointer.ok || pointer.value.publishStatus !== 'published') return respond(notFound());

  const ready = await verifyInstancePublicPackageReady({
    env,
    accountId: parsed.accountId,
    instanceId: parsed.instanceId,
  });
  if (!ready.ok) return respond(notFound());

  const key = instanceObjectKey(parsed.accountId, parsed.instanceId, parsed.file);
  const obj = await env.TOKYO_R2.get(key);

  if (parsed.file === PUBLIC_INDEX_FILE) {
    const localeParams = url.searchParams.getAll('locale');
    if (localeParams.length > 1) return respond(localeNotAvailable());
    const rawLocale = localeParams[0];
    let overlayLocales: string[];
    try {
      overlayLocales = await listLocaleOverlayCoordinates({
        env,
        accountId: parsed.accountId,
        widgetCode: pointer.value.widgetCode,
        instanceId: parsed.instanceId,
      });
    } catch {
      return respond(localeDataInvalid());
    }
    if (overlayLocales.includes(pointer.value.baseLocale)) return respond(localeDataInvalid());
    const locale = typeof rawLocale === 'string' ? normalizeLocale(rawLocale) : pointer.value.baseLocale;
    if (!locale || (typeof rawLocale === 'string' && locale !== rawLocale)) return respond(localeNotAvailable());
    if (!obj) return respond(notFound());
    if (locale === pointer.value.baseLocale) {
      try {
        const contentType = publicPackageContentType(obj);
        if (!contentType) throw new Error('ck.public_html.metadata_invalid');
        const completed = completeInstancePublicCoordinates({
          html: await obj.text(),
          accountId: parsed.accountId,
          instanceId: parsed.instanceId,
        });
        return respond(responseForCompletedIndex(completed, contentType, req.method === 'HEAD'));
      } catch {
        return respond(publicHtmlInvalid());
      }
    }
    let translated:
      | Awaited<ReturnType<typeof readAccountInstanceTranslatedLocaleValues>>
      | null = null;
    try {
      translated = await readAccountInstanceTranslatedLocaleValues({
        env,
        accountId: parsed.accountId,
        instanceId: parsed.instanceId,
        widgetType: pointer.value.widgetType,
        locale,
      });
    } catch {
      return respond(localeDataInvalid());
    }
    if (!translated.ok) return respond(localeNotAvailable());
    let localized: string;
    try {
      localized = completeLocalizedInstanceHtml({
        html: await obj.text(),
        locale,
        values: translated.value.values,
      });
    } catch {
      return respond(localeDataInvalid());
    }
    try {
      const completed = completeInstancePublicCoordinates({
        html: localized,
        accountId: parsed.accountId,
        instanceId: parsed.instanceId,
      });
      return respond(responseForCompletedIndex(
        completed,
        'text/html; charset=utf-8',
        req.method === 'HEAD',
      ));
    } catch {
      return respond(publicHtmlInvalid());
    }
  }
  return respond(obj ? responseForObject(key, parsed.file, obj, req.method === 'HEAD') : notFound());
}

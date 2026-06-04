import { isCompactAccountPublicId, isCompactInstanceId, isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { guessContentTypeFromExt } from '../asset-utils';
import { readInstanceServeState } from '../domains/account-instances/serve-state';
import { accountPagePublishFileKey, readAccountPageServeState } from '../domains/pages';
import {
  isPublicPackageFile,
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
} from '../domains/account-instances/package-file-names';
import { respondMethodNotAllowed, type TokyoRouteArgs } from '../route-helpers';

const PAGE_EMBED_FILE = 'embed.js';

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

function isPageDeliveryFile(file: string): boolean {
  return isPublicPackageFile(file) || file === PAGE_EMBED_FILE;
}

function parseClkLivePath(pathname: string): {
  kind: 'instance';
  accountId: string;
  instanceId: string;
  file: string;
} | {
  kind: 'page';
  accountId: string;
  pageId: string;
  file: string;
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

  if (segments.length === 3 || segments.length === 4) {
    const [accountId, pagesSegment, pageId, requestedFile] = segments;
    if (pagesSegment === 'pages') {
      if (!isCompactAccountPublicId(accountId) || !isCompactPageId(pageId)) return null;
      const file = requestedFile ?? PUBLIC_INDEX_FILE;
      if (!isPageDeliveryFile(file)) return null;
      return { kind: 'page', accountId, pageId, file };
    }
  }

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
  if (file === PAGE_EMBED_FILE) {
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
  const ext = key.split('.').pop() || '';
  const cacheControl = cacheControlForGeneratedFile(file);
  const headers = new Headers();
  headers.set('content-type', obj.httpMetadata?.contentType || guessContentTypeFromExt(ext));
  headers.set('cache-control', cacheControl);
  headers.set('cdn-cache-control', cacheControl);
  headers.set('cloudflare-cdn-cache-control', cacheControl);
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(headOnly ? null : obj.body, { status: 200, headers });
}

function responseForText(args: {
  body: string;
  file: string;
  contentType: string;
  headOnly: boolean;
}): Response {
  const cacheControl = cacheControlForGeneratedFile(args.file);
  const headers = new Headers();
  headers.set('content-type', args.contentType);
  headers.set('cache-control', cacheControl);
  headers.set('cdn-cache-control', cacheControl);
  headers.set('cloudflare-cdn-cache-control', cacheControl);
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(args.headOnly ? null : args.body, { status: 200, headers });
}

function buildPageEmbedScript(args: {
  baseUrl: string;
  pageId: string;
}): string {
  const baseUrl = JSON.stringify(args.baseUrl);
  const pageId = JSON.stringify(args.pageId);
  return `(function () {
  var baseUrl = ${baseUrl};
  var pageId = ${pageId};
  var doc = document;
  var script = doc.currentScript;
  var mount = doc.createElement('div');
  mount.setAttribute('data-ck-page-embed', pageId);
  if (script && script.parentNode) {
    script.parentNode.insertBefore(mount, script);
  } else {
    doc.body.appendChild(mount);
  }
  if (!doc.querySelector('link[data-ck-page-style="' + pageId + '"]')) {
    var style = doc.createElement('link');
    style.rel = 'stylesheet';
    style.href = baseUrl + '/styles.css';
    style.setAttribute('data-ck-page-style', pageId);
    doc.head.appendChild(style);
  }
  fetch(baseUrl, { credentials: 'omit' })
    .then(function (response) {
      if (!response.ok) throw new Error('ck_page_fetch_failed');
      return response.text();
    })
    .then(function (html) {
      var parsed = new DOMParser().parseFromString(html, 'text/html');
      var main = parsed.querySelector('[data-ck-page]');
      if (!main) throw new Error('ck_page_root_missing');
      mount.innerHTML = '';
      mount.appendChild(doc.importNode(main, true));
      var runtime = doc.createElement('script');
      runtime.src = baseUrl + '/runtime.js';
      runtime.async = false;
      mount.appendChild(runtime);
    })
    .catch(function (error) {
      mount.setAttribute('data-ck-page-error', error && error.message ? error.message : String(error));
    });
})();`;
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

  if (parsed.kind === 'page') {
    const serveState = await readAccountPageServeState({
      env,
      accountId: parsed.accountId,
      pageId: parsed.pageId,
    });
    if (serveState !== 'published') return respond(notFound());

    if (parsed.file === PAGE_EMBED_FILE) {
      const baseUrl = `${url.origin}/${parsed.accountId}/pages/${parsed.pageId}`;
      return respond(responseForText({
        body: buildPageEmbedScript({ baseUrl, pageId: parsed.pageId }),
        file: parsed.file,
        contentType: 'text/javascript; charset=utf-8',
        headOnly: req.method === 'HEAD',
      }));
    }

    const key = accountPagePublishFileKey(
      parsed.accountId,
      parsed.pageId,
      parsed.file as 'index.html' | 'styles.css' | 'runtime.js',
    );
    const obj = await env.TOKYO_R2.get(key);
    return respond(obj ? responseForObject(key, parsed.file, obj, req.method === 'HEAD') : notFound());
  }

  const serveState = await readInstanceServeState({
    env,
    accountId: parsed.accountId,
    instanceId: parsed.instanceId,
  });
  if (serveState !== 'published') return respond(notFound());

  const key = instanceObjectKey(parsed.accountId, parsed.instanceId, parsed.file);
  const obj = await env.TOKYO_R2.get(key);
  return respond(obj ? responseForObject(key, parsed.file, obj, req.method === 'HEAD') : notFound());
}

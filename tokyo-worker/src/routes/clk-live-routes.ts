import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { guessContentTypeFromExt } from '../asset-utils';
import { readInstanceServeState } from '../domains/render';
import { respondMethodNotAllowed, type TokyoRouteArgs } from '../route-helpers';

const GENERATED_FILE_ALLOWLIST: ReadonlyArray<RegExp> = [
  /^index\.html$/,
  /^[a-z0-9][a-z0-9-]{0,19}\.html$/,
  /^styles\.css$/,
  /^script\.js$/,
  /^script\.[a-z0-9][a-z0-9-]{0,19}\.js$/,
  /^styles\.v[1-9][0-9]*\.css$/,
  /^script\.v[1-9][0-9]*(?:\.[a-z0-9][a-z0-9-]{0,19})?\.js$/,
];

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

function isAllowedGeneratedBrowserFile(file: string): boolean {
  if (!file || file.startsWith('.') || file.includes('/') || file.includes('\\')) return false;
  if (file.includes('%') || file.includes('..')) return false;
  return GENERATED_FILE_ALLOWLIST.some((pattern) => pattern.test(file));
}

function parseClkLivePath(pathname: string): {
  accountId: string;
  instanceId: string;
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
  if (segments.length !== 2 && segments.length !== 3) return null;
  const [accountId, instanceId, requestedFile] = segments;
  if (!isCompactAccountPublicId(accountId) || !isCompactInstanceId(instanceId)) return null;
  const file = requestedFile ?? 'index.html';
  if (!isAllowedGeneratedBrowserFile(file)) return null;
  return { accountId, instanceId, file };
}

function instanceObjectKey(accountId: string, instanceId: string, file: string): string {
  return `accounts/${accountId}/instances/${instanceId}/${file}`;
}

function cacheControlForGeneratedFile(file: string): string {
  if (file === 'index.html' || file.endsWith('.html') || file === 'styles.css' || file === 'script.js') {
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

export async function tryHandleClkLiveStaticRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, url, respond } = args;

  if (url.protocol === 'http:' && url.hostname === 'clk.live') {
    url.protocol = 'https:';
    return respond(new Response(null, { status: 301, headers: { location: url.toString() } }));
  }

  const parsed = parseClkLivePath(pathname);
  if (!parsed) return null;
  if (req.method !== 'GET' && req.method !== 'HEAD') return respondMethodNotAllowed(respond);

  const publishStatus = await readInstanceServeState({
    env,
    accountId: parsed.accountId,
    instanceId: parsed.instanceId,
  });
  if (publishStatus !== 'published') return respond(notFound());

  const key = instanceObjectKey(parsed.accountId, parsed.instanceId, parsed.file);
  const obj = await env.TOKYO_R2.get(key);
  return respond(obj ? responseForObject(key, parsed.file, obj, req.method === 'HEAD') : notFound());
}

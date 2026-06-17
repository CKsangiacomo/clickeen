import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from './env/tokyo';

type ProxyMethod = 'GET' | 'HEAD';
type ProxyOptions = { noStore?: boolean };

function copyUpstreamHeaders(res: Response): Headers {
  const headers = new Headers();
  [
    'content-type',
    'cache-control',
    'etag',
    'last-modified',
    'content-length',
    'accept-ranges',
  ].forEach((key) => {
    const value = res.headers.get(key);
    if (value) headers.set(key, value);
  });
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

function assertSafeSegment(raw: string): string {
  const value = String(raw || '').trim();
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error('Invalid path');
  }
  return encodeURIComponent(value);
}

function buildConditionalHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  ['if-none-match', 'if-modified-since'].forEach((key) => {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  });
  return headers;
}

function appendSearch(request: NextRequest, url: string): string {
  const qs = request.nextUrl.search;
  return qs ? `${url}${qs}` : url;
}

function buildTokyoUrl(pathname: string): string {
  return `${resolveTokyoBaseUrl().replace(/\/+$/, '')}${pathname}`;
}

async function proxyTokyoUrl(request: NextRequest, url: string, method: ProxyMethod, options: ProxyOptions = {}) {
  const cacheBust = request.nextUrl.searchParams.has('ts');
  const fetchInit: RequestInit = {
    method,
    headers: buildConditionalHeaders(request),
  };
  if (cacheBust || options.noStore) fetchInit.cache = 'no-store';

  const res = await fetch(url, fetchInit);
  const headers = copyUpstreamHeaders(res);
  if (cacheBust || options.noStore) {
    headers.set('Cache-Control', 'no-store');
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  }
  if (method === 'HEAD') return new NextResponse(null, { status: res.status, headers });
  return new NextResponse(res.body, { status: res.status, headers });
}

export async function proxyTokyoStaticPath(
  request: NextRequest,
  prefix: 'dieter' | 'fonts' | 'l10n' | 'widgets',
  pathSegments: string[],
  method: ProxyMethod,
) {
  try {
    const joined = pathSegments.map(assertSafeSegment).join('/');
    const url = appendSearch(request, buildTokyoUrl(`/${prefix}/${joined}`));
    return proxyTokyoUrl(request, url, method, { noStore: prefix === 'widgets' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500 });
  }
}

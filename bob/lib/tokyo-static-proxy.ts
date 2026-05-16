import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from './env/tokyo';

type ProxyMethod = 'GET' | 'HEAD';

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

async function proxyTokyoUrl(request: NextRequest, url: string, method: ProxyMethod) {
  const cacheBust = request.nextUrl.searchParams.has('ts');
  const fetchInit: RequestInit = {
    method,
    headers: buildConditionalHeaders(request),
  };
  if (cacheBust) fetchInit.cache = 'no-store';

  const res = await fetch(url, fetchInit);
  const headers = copyUpstreamHeaders(res);
  if (cacheBust) headers.set('Cache-Control', 'no-store');
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
    return proxyTokyoUrl(request, url, method);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500 });
  }
}

export async function proxyTokyoAccountAsset(
  request: NextRequest,
  params: { accountId: string; assetRef: string[] },
  method: ProxyMethod,
) {
  try {
    const accountId = assertSafeSegment(params.accountId);
    const assetRef = params.assetRef.map(assertSafeSegment).join('/');
    if (!assetRef) throw new Error('Invalid path');
    const url = appendSearch(request, buildTokyoUrl(`/assets/account/${accountId}/${assetRef}`));
    return proxyTokyoUrl(request, url, method);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Invalid path') return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });
    return NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500 });
  }
}

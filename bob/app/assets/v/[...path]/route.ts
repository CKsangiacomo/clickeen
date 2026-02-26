import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from '../../../../lib/env/tokyo';

export const runtime = 'edge';

function copyUpstreamHeaders(res: Response): Headers {
  const headers = new Headers();
  const passthrough = [
    'content-type',
    'cache-control',
    'etag',
    'last-modified',
    'content-length',
    'accept-ranges',
  ];
  passthrough.forEach((key) => {
    const value = res.headers.get(key);
    if (value) headers.set(key, value);
  });
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

function resolveOpaqueAssetSuffix(request: NextRequest): string {
  const marker = '/assets/v/';
  const pathname = request.nextUrl.pathname || '';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Invalid path');
  }

  const suffix = pathname.slice(markerIndex + marker.length).replace(/^\/+/, '');
  if (!suffix) {
    throw new Error('Invalid path');
  }

  const segments = suffix.split('/');
  for (const segment of segments) {
    if (!segment) continue;
    let decoded = '';
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new Error('Invalid path');
    }
    if (decoded === '.' || decoded === '..') {
      throw new Error('Invalid path');
    }
  }

  return suffix;
}

function buildTokyoUrl(request: NextRequest, prefix: string): string {
  const base = resolveTokyoBaseUrl().replace(/\/+$/, '');
  const suffix = resolveOpaqueAssetSuffix(request);
  const url = `${base}/${prefix}/${suffix}`;
  const qs = request.nextUrl.search;
  return qs ? `${url}${qs}` : url;
}

function buildConditionalHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const conditional = ['if-none-match', 'if-modified-since'];
  conditional.forEach((key) => {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  });
  return headers;
}

async function proxy(request: NextRequest, prefix: string, method: 'GET' | 'HEAD') {
  let url: string;
  try {
    url = buildTokyoUrl(request, prefix);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Invalid path') {
      return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });
    }
    return NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500 });
  }

  const cacheBust = request.nextUrl.searchParams.has('ts');
  const fetchInit: RequestInit = {
    method,
    headers: buildConditionalHeaders(request),
  };
  if (cacheBust) fetchInit.cache = 'no-store';
  const res = await fetch(url, fetchInit);
  const headers = copyUpstreamHeaders(res);

  if (cacheBust) {
    headers.set('Cache-Control', 'no-store');
  }

  if (method === 'HEAD') {
    return new NextResponse(null, { status: res.status, headers });
  }
  return new NextResponse(res.body, { status: res.status, headers });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  await ctx.params;
  return proxy(request, 'assets/v', 'GET');
}

export async function HEAD(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  await ctx.params;
  return proxy(request, 'assets/v', 'HEAD');
}

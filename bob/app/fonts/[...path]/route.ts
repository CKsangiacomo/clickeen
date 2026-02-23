import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from '../../../lib/env/tokyo';

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

function buildTokyoUrl(request: NextRequest, prefix: string, pathSegments: string[]): string {
  if (pathSegments.some((seg) => seg === '..' || seg === '.')) {
    throw new Error('Invalid path');
  }

  const base = resolveTokyoBaseUrl().replace(/\/+$/, '');
  const joined = pathSegments.map((seg) => encodeURIComponent(seg)).join('/');
  const url = `${base}/${prefix}/${joined}`;
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

async function proxy(request: NextRequest, prefix: string, pathSegments: string[], method: 'GET' | 'HEAD') {
  let url: string;
  try {
    url = buildTokyoUrl(request, prefix, pathSegments);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
  const params = await ctx.params;
  const segments = Array.isArray(params.path) ? params.path : [];
  return proxy(request, 'fonts', segments, 'GET');
}

export async function HEAD(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const segments = Array.isArray(params.path) ? params.path : [];
  return proxy(request, 'fonts', segments, 'HEAD');
}

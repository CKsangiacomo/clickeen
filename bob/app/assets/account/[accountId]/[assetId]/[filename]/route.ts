import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from '../../../../../../lib/env/tokyo';

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

function assertSafeSegment(raw: string): string {
  const value = String(raw || '').trim();
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error('Invalid path');
  }
  return encodeURIComponent(value);
}

function buildTokyoUrl(request: NextRequest, params: { accountId: string; assetId: string; filename: string }): string {
  const base = resolveTokyoBaseUrl().replace(/\/+$/, '');
  const accountId = assertSafeSegment(params.accountId);
  const assetId = assertSafeSegment(params.assetId);
  const filename = assertSafeSegment(params.filename);
  const url = `${base}/assets/account/${accountId}/${assetId}/${filename}`;
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

async function proxy(
  request: NextRequest,
  params: { accountId: string; assetId: string; filename: string },
  method: 'GET' | 'HEAD',
) {
  let url: string;
  try {
    url = buildTokyoUrl(request, params);
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

  if (cacheBust) headers.set('Cache-Control', 'no-store');
  if (method === 'HEAD') return new NextResponse(null, { status: res.status, headers });
  return new NextResponse(res.body, { status: res.status, headers });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ accountId: string; assetId: string; filename: string }> },
) {
  return proxy(request, await ctx.params, 'GET');
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ accountId: string; assetId: string; filename: string }> },
) {
  return proxy(request, await ctx.params, 'HEAD');
}

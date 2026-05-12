import { NextRequest, NextResponse } from 'next/server';
import { tokyoFetch } from './tokyo';

type ProxyMethod = 'GET' | 'HEAD';

export function normalizeTokyoPathParts(path: unknown): string[] {
  return Array.isArray(path)
    ? path.map((part) => String(part || '').replace(/^\/+|\/+$/g, '')).filter(Boolean)
    : [];
}

function copyAssetHeaders(res: Response): Headers {
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

function buildConditionalHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  ['if-none-match', 'if-modified-since'].forEach((key) => {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  });
  return headers;
}

function safeSegment(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) return null;
  return encodeURIComponent(value);
}

export async function proxyTokyoPath(args: {
  prefix: 'dieter' | 'l10n' | 'renders' | 'widgets';
  parts: string[];
  allowed: (parts: string[]) => boolean;
  defaultCache: string;
  method: ProxyMethod;
}): Promise<NextResponse> {
  if (args.parts.length === 0 || !args.allowed(args.parts)) return new NextResponse('NOT_FOUND', { status: 404 });
  const res = await tokyoFetch(`/${args.prefix}/${args.parts.join('/')}`, { method: 'GET' });

  const headers = new Headers();
  const contentType = res.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Cache-Control', res.headers.get('cache-control') || args.defaultCache);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-Content-Type-Options', 'nosniff');

  if (args.method === 'HEAD') return new NextResponse(null, { status: res.status, headers });
  return new NextResponse(res.body, { status: res.status, headers });
}

export async function proxyTokyoAccountAsset(
  request: NextRequest,
  params: { accountId: string; assetId: string; filename: string },
  method: ProxyMethod,
): Promise<NextResponse> {
  const accountId = safeSegment(params.accountId);
  const assetId = safeSegment(params.assetId);
  const filename = safeSegment(params.filename);
  if (!accountId || !assetId || !filename) return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });

  const response = await tokyoFetch(`/assets/account/${accountId}/${assetId}/${filename}${request.nextUrl.search}`, {
    method,
    headers: buildConditionalHeaders(request),
  });
  const headers = copyAssetHeaders(response);

  if (method === 'HEAD') return new NextResponse(null, { status: response.status, headers });
  return new NextResponse(response.body, { status: response.status, headers });
}

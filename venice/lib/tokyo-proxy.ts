import { NextRequest, NextResponse } from 'next/server';
import {
  createVeniceRequestContext,
  finalizeVeniceObservedResponse,
  withVeniceRequestId,
} from './request-ops';
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
  request: Request;
  prefix: 'dieter' | 'renders' | 'widgets';
  parts: string[];
  allowed: (parts: string[]) => boolean;
  defaultCache: string;
  method: ProxyMethod;
}): Promise<NextResponse> {
  const context = createVeniceRequestContext(args.request);
  if (args.parts.length === 0 || !args.allowed(args.parts)) {
    return finalizeVeniceObservedResponse({
      context,
      response: new NextResponse('NOT_FOUND', { status: 404 }),
      boundary: `tokyo.${args.prefix}`,
      reasonKey: 'coreui.errors.notFound',
    });
  }
  const res = await tokyoFetch(`/${args.prefix}/${args.parts.join('/')}`, {
    method: 'GET',
    headers: withVeniceRequestId(context),
  });

  const headers = new Headers();
  const contentType = res.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Cache-Control', res.headers.get('cache-control') || args.defaultCache);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-Content-Type-Options', 'nosniff');

  const response =
    args.method === 'HEAD'
      ? new NextResponse(null, { status: res.status, headers })
      : new NextResponse(res.body, { status: res.status, headers });
  return finalizeVeniceObservedResponse({
    context,
    response,
    boundary: `tokyo.${args.prefix}`,
    reasonKey: res.ok ? null : `HTTP_${res.status}`,
  });
}

export async function proxyTokyoAccountAsset(
  request: NextRequest,
  params: { accountId: string; assetId: string; filename: string },
  method: ProxyMethod,
): Promise<NextResponse> {
  const context = createVeniceRequestContext(request);
  const accountId = safeSegment(params.accountId);
  const assetId = safeSegment(params.assetId);
  const filename = safeSegment(params.filename);
  if (!accountId || !assetId || !filename) {
    return finalizeVeniceObservedResponse({
      context,
      response: NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 }),
      boundary: 'tokyo.assets',
      reasonKey: 'coreui.errors.payload.invalid',
    });
  }

  const upstreamHeaders = withVeniceRequestId(context, buildConditionalHeaders(request));

  const response = await tokyoFetch(`/assets/account/${accountId}/${assetId}/${filename}${request.nextUrl.search}`, {
    method,
    headers: upstreamHeaders,
  });
  const responseHeaders = copyAssetHeaders(response);

  const proxied =
    method === 'HEAD'
      ? new NextResponse(null, { status: response.status, headers: responseHeaders })
      : new NextResponse(response.body, { status: response.status, headers: responseHeaders });
  return finalizeVeniceObservedResponse({
    context,
    response: proxied,
    boundary: 'tokyo.assets',
    reasonKey: response.ok ? null : `HTTP_${response.status}`,
  });
}

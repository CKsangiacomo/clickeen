import { NextRequest, NextResponse } from 'next/server';
import { tokyoFetch } from '../../../../lib/tokyo';

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

function buildConditionalHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const conditional = ['if-none-match', 'if-modified-since'];
  conditional.forEach((key) => {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  });
  return headers;
}

function resolvePathSegments(pathSegments: string[]): string[] | null {
  if (pathSegments.some((seg) => seg === '..' || seg === '.')) {
    return null;
  }
  return pathSegments;
}

function resolveOpaqueAssetSuffix(request: NextRequest): string | null {
  const marker = '/assets/v/';
  const pathname = request.nextUrl.pathname || '';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) return null;

  const suffix = pathname.slice(markerIndex + marker.length).replace(/^\/+/, '');
  if (!suffix) return null;

  const segments = suffix.split('/');
  for (const segment of segments) {
    if (!segment) continue;
    let decoded = '';
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (decoded === '.' || decoded === '..') return null;
  }

  return suffix;
}

async function proxy(
  request: NextRequest,
  params: { path?: string[] },
  method: 'GET' | 'HEAD',
): Promise<NextResponse> {
  const segments = Array.isArray(params.path) ? params.path : [];
  const safeSegments = resolvePathSegments(segments);
  if (!safeSegments) return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });
  const suffix = resolveOpaqueAssetSuffix(request);
  if (!suffix) return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });
  const pathname = `/assets/v/${suffix}`;
  const search = request.nextUrl.search;
  const response = await tokyoFetch(`${pathname}${search}`, {
    method,
    headers: buildConditionalHeaders(request),
  });
  const headers = copyUpstreamHeaders(response);

  if (method === 'HEAD') {
    return new NextResponse(null, { status: response.status, headers });
  }
  return new NextResponse(response.body, { status: response.status, headers });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxy(request, params, 'GET');
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return proxy(request, params, 'HEAD');
}

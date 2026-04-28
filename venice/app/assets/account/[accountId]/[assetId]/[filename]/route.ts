import { NextRequest, NextResponse } from 'next/server';
import { tokyoFetch } from '../../../../../../lib/tokyo';

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

function safeSegment(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) return null;
  return encodeURIComponent(value);
}

async function proxy(
  request: NextRequest,
  params: { accountId: string; assetId: string; filename: string },
  method: 'GET' | 'HEAD',
): Promise<NextResponse> {
  const accountId = safeSegment(params.accountId);
  const assetId = safeSegment(params.assetId);
  const filename = safeSegment(params.filename);
  if (!accountId || !assetId || !filename) return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });

  const search = request.nextUrl.search;
  const response = await tokyoFetch(`/assets/account/${accountId}/${assetId}/${filename}${search}`, {
    method,
    headers: buildConditionalHeaders(request),
  });
  const headers = copyUpstreamHeaders(response);

  if (method === 'HEAD') return new NextResponse(null, { status: response.status, headers });
  return new NextResponse(response.body, { status: response.status, headers });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ accountId: string; assetId: string; filename: string }> },
) {
  return proxy(request, await context.params, 'GET');
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ accountId: string; assetId: string; filename: string }> },
) {
  return proxy(request, await context.params, 'HEAD');
}

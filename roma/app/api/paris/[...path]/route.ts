import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../../../lib/env/paris';
import { resolveSessionBearer } from '../../../../lib/auth/session';

export const runtime = 'edge';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function copyRequestHeaders(request: NextRequest, accessToken: string): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set('authorization', `Bearer ${accessToken}`);

  return headers;
}

function copyResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();
  upstreamHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

async function proxyToParis(request: NextRequest, context: RouteContext) {
  const auth = await resolveSessionBearer(request);
  if (!auth.ok) return auth.response;

  const { path } = await context.params;
  const parisBase = resolveParisBaseUrl();
  const incoming = new URL(request.url);
  const target = `${parisBase}/api/${(path || []).map(encodeURIComponent).join('/')}${incoming.search}`;

  const method = request.method.toUpperCase();
  const requestHeaders = copyRequestHeaders(request, auth.accessToken);
  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
    redirect: 'manual',
    cache: 'no-store',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    requestInit.body = await request.arrayBuffer();
  }

  try {
    const upstreamResponse = await fetch(target, requestInit);
    const response = new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: copyResponseHeaders(upstreamResponse.headers),
    });
    if (auth.setCookies?.length) {
      const secure = request.nextUrl.protocol === 'https:';
      for (const cookie of auth.setCookies) {
        response.cookies.set({
          name: cookie.name,
          value: cookie.value,
          httpOnly: true,
          secure,
          sameSite: 'lax',
          path: '/',
          maxAge: cookie.maxAge,
        });
      }
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'roma.errors.proxy.paris_unavailable',
          message,
        },
      },
      { status: 502 },
    );
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxyToParis(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxyToParis(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxyToParis(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToParis(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToParis(request, context);
}

export function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyToParis(request, context);
}

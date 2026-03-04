import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  resolveParisBaseOrResponse,
  resolveParisSession,
  withParisDevAuthorization,
} from '../../../../lib/api/paris/proxy-helpers';

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

type RouteContext = { params: Promise<{ path: string[] }> };

function copyRequestHeaders(request: NextRequest, accessToken: string): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  return withParisDevAuthorization(headers, accessToken);
}

function copyResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();
  upstreamHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

async function proxyToParis(request: NextRequest, context: RouteContext) {
  const session = await resolveParisSession(request);
  if (!session.ok) return session.response;

  const paris = resolveParisBaseOrResponse({});
  if (!paris.ok) return paris.response;

  const incoming = new URL(request.url);
  const { path } = await context.params;
  const target = `${paris.baseUrl.replace(/\/+$/, '')}/api/${(path || []).map(encodeURIComponent).join('/')}${incoming.search}`;

  const method = request.method.toUpperCase();
  const headers = copyRequestHeaders(request, session.accessToken);
  const init: RequestInit = {
    method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: copyResponseHeaders(upstream.headers),
    });
    applySessionCookies(response, request, session.setCookies);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'bob.errors.proxy.paris_unavailable',
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

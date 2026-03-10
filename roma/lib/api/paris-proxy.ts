import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../auth/session';
import { resolveParisBaseUrl } from '../env/paris';

export type ParisProxyOptions = {
  path: string;
  method?: string;
  forwardQuery?: boolean;
};

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

function normalizePath(path: string): string {
  const normalized = String(path || '').trim();
  if (!normalized) return '/api';
  if (normalized.startsWith('/')) return normalized;
  return `/${normalized}`;
}

export async function proxyToParis(request: NextRequest, options: ParisProxyOptions): Promise<NextResponse> {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const method = (options.method || request.method || 'GET').toUpperCase();
  const path = normalizePath(options.path);
  const parisBase = resolveParisBaseUrl().replace(/\/+$/, '');
  const target = new URL(`${parisBase}${path}`);
  if (options.forwardQuery !== false) {
    request.nextUrl.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });
  }

  const headers = new Headers();
  headers.set('authorization', `Bearer ${session.accessToken}`);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);
  const authzCapsule = request.headers.get('x-ck-authz-capsule');
  if (authzCapsule) headers.set('x-ck-authz-capsule', authzCapsule);

  const requestInit: RequestInit = {
    method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    const body = await request.text();
    if (body) requestInit.body = body;
  }

  try {
    const upstream = await fetch(target.toString(), requestInit);
    const body = await upstream.text().catch(() => '');
    const response = new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
    return withSession(request, response, session.setCookies);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'roma.errors.proxy.paris_unavailable',
            detail: message,
          },
        },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}

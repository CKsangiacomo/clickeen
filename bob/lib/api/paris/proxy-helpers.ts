import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../env/paris';
import { resolveSessionCookieDomain, resolveSessionBearer, type SessionCookieSpec } from '../../auth/session';

export const PARIS_PROXY_READ_TIMEOUT_MS = 5_000;
export const PARIS_PROXY_WRITE_TIMEOUT_MS = 20_000;

export type ParisProxyRouteOptions = {
  path: string;
  method?: string;
  forwardQuery?: boolean;
  corsHeaders?: Record<string, string>;
  auth?: 'session' | 'none';
  forwardHeaders?: string[];
};

function resolveRequestSurface(request: NextRequest): string | null {
  const direct = String(request.headers.get('x-ck-surface') || '')
    .trim()
    .toLowerCase();
  if (direct) return direct;

  const querySurface = String(request.nextUrl.searchParams.get('surface') || '')
    .trim()
    .toLowerCase();
  if (querySurface) return querySurface;

  const referer = String(request.headers.get('referer') || '').trim();
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const surface = String(url.searchParams.get('surface') || '')
      .trim()
      .toLowerCase();
    return surface || null;
  } catch {
    return null;
  }
}

function resolveParisBaseOrResponse(corsHeaders: HeadersInit) {
  try {
    return { ok: true as const, baseUrl: resolveParisBaseUrl() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500, headers: corsHeaders }),
    };
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = PARIS_PROXY_READ_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveParisSession(request: NextRequest): Promise<
  | { ok: true; accessToken: string; setCookies?: SessionCookieSpec[] }
  | { ok: false; response: NextResponse }
> {
  const stage = (process.env.ENV_STAGE ?? '').trim().toLowerCase();
  if (stage === 'local') {
    if (resolveRequestSurface(request) === 'devstudio') {
      const token = String(process.env.PARIS_DEV_JWT || '').trim();
      if (!token) {
        return {
          ok: false as const,
          response: NextResponse.json(
            {
              error: {
                kind: 'INTERNAL',
                reasonKey: 'coreui.errors.misconfigured',
                detail: 'Missing PARIS_DEV_JWT for local DevStudio tool calls.',
              },
            },
            { status: 500 },
          ),
        };
      }

      return { ok: true as const, accessToken: token };
    }
  }

  const resolved = await resolveSessionBearer(request);
  if (!resolved.ok) return resolved;
  return { ok: true as const, accessToken: resolved.accessToken, setCookies: resolved.setCookies };
}

export function withParisDevAuthorization(headers: Headers, accessToken: string): Headers {
  // Keep legacy helper name to avoid broad route churn; auth bearer comes from Berlin session resolution.
  headers.set('authorization', `Bearer ${accessToken}`);
  if ((process.env.ENV_STAGE ?? '').trim().toLowerCase() === 'local') {
    const localDevToken = String(process.env.PARIS_DEV_JWT || '').trim();
    if (localDevToken && accessToken === localDevToken) {
      headers.set('x-ck-internal-service', 'bob.local');
    }
  }
  return headers;
}

export function applySessionCookies(
  response: NextResponse,
  request: NextRequest,
  setCookies?: SessionCookieSpec[],
) {
  if (!setCookies?.length) return response;
  const secure = request.nextUrl.protocol === 'https:';
  const domain = resolveSessionCookieDomain(request);
  for (const cookie of setCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: cookie.maxAge,
      ...(domain ? { domain } : {}),
    });
  }
  return response;
}

function proxyErrorResponse(error: unknown, corsHeaders: HeadersInit) {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
  return NextResponse.json({ error: 'PARIS_PROXY_ERROR', message }, { status, headers: corsHeaders });
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withCorsHeaders(response: NextResponse, corsHeaders?: Record<string, string>): NextResponse {
  if (!corsHeaders) return response;
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export function withSessionAndCors(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
  corsHeaders?: Record<string, string>,
): NextResponse {
  return withNoStore(withCorsHeaders(applySessionCookies(response, request, setCookies), corsHeaders));
}

function normalizeParisProxyPath(path: string): string {
  const normalized = String(path || '').trim();
  if (!normalized) return '/api';
  if (normalized.startsWith('/')) return normalized;
  return `/${normalized}`;
}

export async function proxyToParisRoute(
  request: NextRequest,
  options: ParisProxyRouteOptions,
): Promise<NextResponse> {
  const authMode = options.auth ?? 'session';
  let accessToken: string | undefined;
  let setCookies: SessionCookieSpec[] | undefined;

  if (authMode === 'session') {
    const session = await resolveParisSession(request);
    if (!session.ok) {
      return withSessionAndCors(request, session.response, undefined, options.corsHeaders);
    }
    accessToken = session.accessToken;
    setCookies = session.setCookies;
  }

  const paris = resolveParisBaseOrResponse(options.corsHeaders || {});
  if (!paris.ok) {
    return withSessionAndCors(request, paris.response, setCookies, options.corsHeaders);
  }

  const method = (options.method || request.method || 'GET').toUpperCase();
  const target = new URL(`${paris.baseUrl.replace(/\/+$/, '')}${normalizeParisProxyPath(options.path)}`);
  if (options.forwardQuery !== false) {
    request.nextUrl.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });
  }

  const headers = accessToken
    ? withParisDevAuthorization(new Headers(), accessToken)
    : new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);
  for (const headerName of options.forwardHeaders || []) {
    const value = request.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }

  const init: RequestInit = {
    method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  };
  if (method !== 'GET' && method !== 'HEAD') {
    const body = await request.text();
    if (body) init.body = body;
  }

  const timeoutMs = method === 'GET' || method === 'HEAD' ? PARIS_PROXY_READ_TIMEOUT_MS : PARIS_PROXY_WRITE_TIMEOUT_MS;

  try {
    const upstream = await fetchWithTimeout(target.toString(), init, timeoutMs);
    const body = await upstream.text().catch(() => '');
    return withSessionAndCors(
      request,
      new NextResponse(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      }),
      setCookies,
      options.corsHeaders,
    );
  } catch (error) {
    return withSessionAndCors(request, proxyErrorResponse(error, options.corsHeaders || {}), setCookies, options.corsHeaders);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../env/paris';
import { resolveSessionBearer, type SessionCookieSpec } from '../../auth/session';

export function resolveParisBaseOrResponse(corsHeaders: HeadersInit) {
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

export async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function shouldEnforceSuperadmin(request: NextRequest, superadminKey: string | undefined): boolean {
  if (!superadminKey) return false;
  if (process.env.NODE_ENV === 'development') return false;
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return false;
  return true;
}

export async function resolveParisSession(request: NextRequest): Promise<
  | { ok: true; accessToken: string; setCookies?: SessionCookieSpec[] }
  | { ok: false; response: NextResponse }
> {
  const resolved = await resolveSessionBearer(request);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    accessToken: resolved.accessToken,
    setCookies: resolved.setCookies,
  };
}

export function withParisDevAuthorization(headers: Headers, accessToken: string): Headers {
  // Keep legacy helper name to avoid broad route churn; auth is Supabase session bearer only.
  headers.set('authorization', `Bearer ${accessToken}`);
  return headers;
}

export function applySessionCookies(
  response: NextResponse,
  request: NextRequest,
  setCookies?: SessionCookieSpec[],
) {
  if (!setCookies?.length) return response;
  const secure = request.nextUrl.protocol === 'https:';
  for (const cookie of setCookies) {
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
  return response;
}

export function proxyErrorResponse(error: unknown, corsHeaders: HeadersInit) {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
  return NextResponse.json({ error: 'PARIS_PROXY_ERROR', message }, { status, headers: corsHeaders });
}

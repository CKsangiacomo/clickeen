import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../../../lib/env/paris';
import {
  applySessionCookies,
  resolveLegacyCookieDomainsToClear,
  resolveSessionBearer,
  resolveSessionCookieDomain,
  resolveSessionCookieNames,
} from '../../../../lib/auth/session';

export const runtime = 'edge';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

const LEGACY_ACCESS_COOKIE = 'sb-access-token';
const LEGACY_REFRESH_COOKIE = 'sb-refresh-token';

function resolveNextPath(value: string | null): string {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/')) return '/home';
  if (normalized.startsWith('//')) return '/home';
  return normalized;
}

function resolveLoginUrl(request: NextRequest, params: Record<string, string>): URL {
  const url = new URL('/login', request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function clearCookie(response: NextResponse, request: NextRequest, name: string): void {
  const secure = request.nextUrl.protocol === 'https:';
  const domain = resolveSessionCookieDomain(request);
  const legacyDomains = resolveLegacyCookieDomainsToClear(request);

  response.cookies.set({
    name,
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  if (domain) {
    response.cookies.set({
      name,
      value: '',
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      domain,
    });
  }

  for (const legacy of legacyDomains) {
    if (!legacy || legacy === domain) continue;
    response.cookies.set({
      name,
      value: '',
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      domain: legacy,
    });
  }
}

function clearSessionCookies(response: NextResponse, request: NextRequest): void {
  const names = resolveSessionCookieNames();
  clearCookie(response, request, names.access);
  clearCookie(response, request, names.refresh);
  clearCookie(response, request, LEGACY_ACCESS_COOKIE);
  clearCookie(response, request, LEGACY_REFRESH_COOKIE);
}

export async function GET(request: NextRequest) {
  const nextPath = resolveNextPath(request.nextUrl.searchParams.get('next'));
  const auth = await resolveSessionBearer(request);

  if (!auth.ok) {
    const response = NextResponse.redirect(resolveLoginUrl(request, { error: 'coreui.errors.auth.required' }), {
      headers: CACHE_HEADERS,
    });
    clearSessionCookies(response, request);
    return response;
  }

  const parisBase = resolveParisBaseUrl();
  const upstream = await fetch(`${parisBase}/api/roma/bootstrap`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${auth.accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    const payload = (await upstream.json().catch(() => null)) as
      | { error?: { reasonKey?: string } | string }
      | null;
    const reasonKey =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error && typeof payload.error === 'object' && typeof payload.error.reasonKey === 'string'
          ? payload.error.reasonKey
          : 'coreui.errors.auth.required';

    const response = NextResponse.redirect(resolveLoginUrl(request, { error: reasonKey }), {
      headers: CACHE_HEADERS,
    });
    clearSessionCookies(response, request);
    return response;
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), { headers: CACHE_HEADERS });
  applySessionCookies(response, request, auth.setCookies);
  return response;
}

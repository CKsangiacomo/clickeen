import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../../../lib/env/berlin';
import {
  applySessionCookies,
  resolveLegacyCookieDomainsToClear,
  resolveSessionCookieDomain,
  resolveSessionCookieNames,
} from '../../../../../../lib/auth/session';

export const runtime = 'edge';

const LOGIN_NEXT_COOKIE = 'ck-roma-login-next';

const LEGACY_ACCESS_COOKIE = 'sb-access-token';
const LEGACY_REFRESH_COOKIE = 'sb-refresh-token';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

type BerlinLoginPayload = {
  accessToken?: unknown;
  refreshToken?: unknown;
  accessTokenMaxAge?: unknown;
  refreshTokenMaxAge?: unknown;
  error?: unknown;
};

function clearCookie(
  response: NextResponse,
  options: { secure: boolean; domain?: string },
  extraDomains: string[],
  cookieName: string,
) {
  response.cookies.set({
    name: cookieName,
    value: '',
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  if (options.domain) {
    response.cookies.set({
      name: cookieName,
      value: '',
      httpOnly: true,
      secure: options.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      domain: options.domain,
    });
  }

  for (const domain of extraDomains) {
    if (!domain || domain === options.domain) continue;
    response.cookies.set({
      name: cookieName,
      value: '',
      httpOnly: true,
      secure: options.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      domain,
    });
  }
}

function clearCookieOnExtraDomains(
  response: NextResponse,
  options: { secure: boolean },
  extraDomains: string[],
  cookieName: string,
) {
  response.cookies.set({
    name: cookieName,
    value: '',
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  for (const domain of extraDomains) {
    if (!domain) continue;
    response.cookies.set({
      name: cookieName,
      value: '',
      httpOnly: true,
      secure: options.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      domain,
    });
  }
}

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

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function extractReasonKey(payload: BerlinLoginPayload | null): string {
  const reasonKey =
    payload && typeof payload.error === 'object' && payload.error
      ? (payload.error as Record<string, unknown>).reasonKey
      : null;
  return typeof reasonKey === 'string' ? reasonKey : 'coreui.errors.auth.login_failed';
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const state = String(url.searchParams.get('state') || '').trim();
  const oauthError = String(url.searchParams.get('error') || '').trim();
  const oauthErrorDescription = String(url.searchParams.get('error_description') || '').trim();

  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    const response = NextResponse.redirect(resolveLoginUrl(request, { error: 'roma.errors.auth.config_missing' }), {
      headers: CACHE_HEADERS,
    });
    response.cookies.set({ name: LOGIN_NEXT_COOKIE, value: '', path: '/', maxAge: 0 });
    return response;
  }

  if (oauthError) {
    const upstream = await fetch(
      `${berlinBase}/auth/login/provider/callback?error=${encodeURIComponent(oauthError)}&error_description=${encodeURIComponent(oauthErrorDescription)}`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      },
    );

    const payload = (await upstream.json().catch(() => null)) as BerlinLoginPayload | null;
    const response = NextResponse.redirect(resolveLoginUrl(request, { error: extractReasonKey(payload) }), {
      headers: CACHE_HEADERS,
    });
    response.cookies.set({ name: LOGIN_NEXT_COOKIE, value: '', path: '/', maxAge: 0 });
    return response;
  }

  if (!code || !state) {
    const response = NextResponse.redirect(resolveLoginUrl(request, { error: 'coreui.errors.auth.provider.invalidCallback' }), {
      headers: CACHE_HEADERS,
    });
    response.cookies.set({ name: LOGIN_NEXT_COOKIE, value: '', path: '/', maxAge: 0 });
    return response;
  }

  const upstream = await fetch(
    `${berlinBase}/auth/login/provider/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    },
  );

  const payload = (await upstream.json().catch(() => null)) as BerlinLoginPayload | null;
  if (!upstream.ok || !payload) {
    const response = NextResponse.redirect(resolveLoginUrl(request, { error: extractReasonKey(payload) }), { headers: CACHE_HEADERS });
    response.cookies.set({ name: LOGIN_NEXT_COOKIE, value: '', path: '/', maxAge: 0 });
    return response;
  }

  const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!accessToken || !refreshToken) {
    const response = NextResponse.redirect(resolveLoginUrl(request, { error: 'coreui.errors.auth.login_failed' }), {
      headers: CACHE_HEADERS,
    });
    response.cookies.set({ name: LOGIN_NEXT_COOKIE, value: '', path: '/', maxAge: 0 });
    return response;
  }

  const nextPath = resolveNextPath(request.cookies.get(LOGIN_NEXT_COOKIE)?.value ?? null);
  const postLoginUrl = new URL('/api/session/post-login', request.url);
  postLoginUrl.searchParams.set('next', nextPath);
  if (request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https') {
    postLoginUrl.protocol = 'https:';
  }
  const response = NextResponse.redirect(postLoginUrl, { headers: CACHE_HEADERS });

  const accessMaxAge = parsePositiveInt(payload.accessTokenMaxAge, 15 * 60);
  const refreshMaxAge = parsePositiveInt(payload.refreshTokenMaxAge, 60 * 60 * 24 * 30);

  const cookieNames = resolveSessionCookieNames();
  applySessionCookies(response, request, [
    { name: cookieNames.access, value: accessToken, maxAge: accessMaxAge },
    { name: cookieNames.refresh, value: refreshToken, maxAge: refreshMaxAge },
  ]);

  const cookieOptions = {
    secure: request.nextUrl.protocol === 'https:',
    domain: resolveSessionCookieDomain(request),
  };
  const legacyDomains = resolveLegacyCookieDomainsToClear(request);

  response.cookies.set({
    name: LOGIN_NEXT_COOKIE,
    value: '',
    httpOnly: true,
    secure: cookieOptions.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  // Clear legacy Supabase cookies during boundary cutover.
  clearCookie(response, cookieOptions, legacyDomains, LEGACY_ACCESS_COOKIE);
  clearCookie(response, cookieOptions, legacyDomains, LEGACY_REFRESH_COOKIE);

  // Clear historical broad-domain session cookies so they cannot shadow cloud-dev (`.dev.clickeen.com`) sessions.
  const names = resolveSessionCookieNames();
  clearCookieOnExtraDomains(response, { secure: cookieOptions.secure }, legacyDomains, names.access);
  clearCookieOnExtraDomains(response, { secure: cookieOptions.secure }, legacyDomains, names.refresh);

  return response;
}

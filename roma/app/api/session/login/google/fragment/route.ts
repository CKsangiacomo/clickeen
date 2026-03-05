import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../../../lib/env/berlin';
import {
  applySessionCookies,
  resolveLegacyCookieDomainsToClear,
  resolveSessionCookieDomain,
  resolveSessionCookieNames,
} from '../../../../../../lib/auth/session';

export const runtime = 'edge';

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

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: unknown } | null;
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken.trim() : '';
  if (!refreshToken) {
    return NextResponse.json({ error: 'coreui.errors.auth.provider.invalidCallback' }, { status: 400, headers: CACHE_HEADERS });
  }

  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return NextResponse.json({ error: 'roma.errors.auth.config_missing' }, { status: 503, headers: CACHE_HEADERS });
  }

  const upstream = await fetch(`${berlinBase}/auth/login/provider/fragment`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ refreshToken }),
  });

  const payload = (await upstream.json().catch(() => null)) as BerlinLoginPayload | null;
  if (!upstream.ok || !payload) {
    return NextResponse.json({ error: extractReasonKey(payload) }, { status: upstream.status || 502, headers: CACHE_HEADERS });
  }

  const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const refresh = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!accessToken || !refresh) {
    return NextResponse.json({ error: 'coreui.errors.auth.login_failed' }, { status: 502, headers: CACHE_HEADERS });
  }

  const response = NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  const accessMaxAge = parsePositiveInt(payload.accessTokenMaxAge, 15 * 60);
  const refreshMaxAge = parsePositiveInt(payload.refreshTokenMaxAge, 60 * 60 * 24 * 30);

  const cookieNames = resolveSessionCookieNames();
  applySessionCookies(response, request, [
    { name: cookieNames.access, value: accessToken, maxAge: accessMaxAge },
    { name: cookieNames.refresh, value: refresh, maxAge: refreshMaxAge },
  ]);

  const cookieOptions = {
    secure: request.nextUrl.protocol === 'https:',
    domain: resolveSessionCookieDomain(request),
  };
  const legacyDomains = resolveLegacyCookieDomainsToClear(request);

  clearCookie(response, cookieOptions, legacyDomains, LEGACY_ACCESS_COOKIE);
  clearCookie(response, cookieOptions, legacyDomains, LEGACY_REFRESH_COOKIE);
  return response;
}

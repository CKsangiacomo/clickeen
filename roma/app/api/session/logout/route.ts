import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../lib/env/berlin';
import { resolveSessionCookieDomain, resolveSessionCookieNames } from '../../../../lib/auth/session';

export const runtime = 'edge';

const LEGACY_ACCESS_COOKIE = 'sb-access-token';
const LEGACY_REFRESH_COOKIE = 'sb-refresh-token';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

function resolveAllSessionCookieNames(request: NextRequest): string[] {
  const active = resolveSessionCookieNames();
  const names = new Set<string>([
    active.access,
    active.refresh,
    'ck-access-token',
    'ck-refresh-token',
    LEGACY_ACCESS_COOKIE,
    LEGACY_REFRESH_COOKIE,
  ]);
  for (const cookie of request.cookies.getAll()) {
    const name = cookie.name;
    if (name.startsWith('sb-') && name.endsWith('-access-token')) names.add(name);
    if (name.startsWith('sb-') && name.endsWith('-refresh-token')) names.add(name);
    if (name.startsWith('sb-') && name.endsWith('-auth-token')) {
      names.add(name);
      names.add(`${name.replace(/-auth-token$/, '')}-access-token`);
      names.add(`${name.replace(/-auth-token$/, '')}-refresh-token`);
    }
  }
  return [...names];
}

export async function POST(request: NextRequest) {
  const active = resolveSessionCookieNames();
  const refreshToken = request.cookies.get(active.refresh)?.value?.trim() || '';

  try {
    const berlinBase = resolveBerlinBaseUrl();
    if (refreshToken) {
      await fetch(`${berlinBase}/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
    }
  } catch {
    // Best-effort logout should still clear local cookies even when Berlin is unreachable.
  }

  const secure = request.nextUrl.protocol === 'https:';
  const domain = resolveSessionCookieDomain(request);
  const response = NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  const cookieNames = resolveAllSessionCookieNames(request);
  for (const cookieName of cookieNames) {
    response.cookies.set({
      name: cookieName,
      value: '',
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    if (domain) {
      response.cookies.set({
        name: cookieName,
        value: '',
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        domain,
      });
    }
  }
  return response;
}

import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../lib/env/berlin';

export const runtime = 'edge';

const ACCESS_COOKIE = 'ck-access-token';
const REFRESH_COOKIE = 'ck-refresh-token';
const LEGACY_ACCESS_COOKIE = 'sb-access-token';
const LEGACY_REFRESH_COOKIE = 'sb-refresh-token';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

function resolveSessionCookieNames(request: NextRequest): string[] {
  const names = new Set<string>([ACCESS_COOKIE, REFRESH_COOKIE, LEGACY_ACCESS_COOKIE, LEGACY_REFRESH_COOKIE]);
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
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value?.trim() || '';

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
  const response = NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  const cookieNames = resolveSessionCookieNames(request);
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
  }
  return response;
}

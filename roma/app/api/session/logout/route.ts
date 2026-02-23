import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const DEFAULT_ACCESS_COOKIE = 'sb-access-token';
const DEFAULT_REFRESH_COOKIE = 'sb-refresh-token';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

function resolveSessionCookieNames(request: NextRequest): string[] {
  const names = new Set<string>([DEFAULT_ACCESS_COOKIE, DEFAULT_REFRESH_COOKIE]);
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

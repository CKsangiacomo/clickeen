import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../../lib/env/berlin';

export const runtime = 'edge';

const LOGIN_NEXT_COOKIE = 'ck-roma-login-next';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextPath = resolveNextPath(url.searchParams.get('next'));

  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return NextResponse.redirect(resolveLoginUrl(request, { error: 'roma.errors.auth.config_missing' }), {
      headers: CACHE_HEADERS,
    });
  }

  const upstream = await fetch(`${berlinBase}/auth/login/provider/start`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ provider: 'google' }),
  });

  const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  const oauthUrl = payload && typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!upstream.ok || !oauthUrl) {
    const reasonKey =
      payload && typeof payload.error === 'object' && payload.error
        ? (payload.error as Record<string, unknown>).reasonKey
        : null;
    const normalizedReason = typeof reasonKey === 'string' ? reasonKey : 'coreui.errors.auth.login_failed';
    return NextResponse.redirect(resolveLoginUrl(request, { error: normalizedReason }), {
      headers: CACHE_HEADERS,
    });
  }

  const response = NextResponse.redirect(oauthUrl, { headers: CACHE_HEADERS });
  const secure = request.nextUrl.protocol === 'https:';
  response.cookies.set({
    name: LOGIN_NEXT_COOKIE,
    value: nextPath,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}

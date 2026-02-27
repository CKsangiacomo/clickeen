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

type BerlinLoginPayload = {
  accessToken?: unknown;
  refreshToken?: unknown;
  accessTokenMaxAge?: unknown;
  refreshTokenMaxAge?: unknown;
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizePassword(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function buildErrorResponse(reasonKey: string, status: number) {
  return NextResponse.json(
    {
      error: {
        kind: 'AUTH',
        reasonKey,
      },
    },
    { status, headers: CACHE_HEADERS },
  );
}

export async function POST(request: NextRequest) {
  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return buildErrorResponse('roma.errors.auth.config_missing', 503);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeEmail(body?.email);
  const password = normalizePassword(body?.password);
  if (!email || !password) {
    return buildErrorResponse('coreui.errors.auth.invalid_credentials', 422);
  }

  const upstream = await fetch(`${berlinBase}/auth/login/password`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ email, password }),
  });

  const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  if (!upstream.ok || !payload) {
    const reasonKey =
      payload && typeof payload.error === 'object' && payload.error
        ? (payload.error as Record<string, unknown>).reasonKey
        : null;
    const normalizedReason = typeof reasonKey === 'string' ? reasonKey : 'coreui.errors.auth.login_failed';
    return buildErrorResponse(normalizedReason, upstream.status === 401 ? 401 : 502);
  }

  const login = payload as BerlinLoginPayload;
  const accessToken = typeof login.accessToken === 'string' ? login.accessToken.trim() : '';
  const refreshToken = typeof login.refreshToken === 'string' ? login.refreshToken.trim() : '';
  if (!accessToken || !refreshToken) {
    return buildErrorResponse('coreui.errors.auth.login_failed', 502);
  }

  const accessMaxAge = parsePositiveInt(login.accessTokenMaxAge, 15 * 60);
  const refreshMaxAge = parsePositiveInt(login.refreshTokenMaxAge, 60 * 60 * 24 * 30);

  const secure = request.nextUrl.protocol === 'https:';
  const response = NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: accessToken,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAge,
  });
  response.cookies.set({
    name: REFRESH_COOKIE,
    value: refreshToken,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshMaxAge,
  });

  // Clear legacy Supabase cookies during boundary cutover.
  response.cookies.set({
    name: LEGACY_ACCESS_COOKIE,
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set({
    name: LEGACY_REFRESH_COOKIE,
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

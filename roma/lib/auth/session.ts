import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../env/berlin';

export type SessionCookieSpec = {
  name: string;
  value: string;
  maxAge: number;
};

type SessionResolution =
  | {
      ok: true;
      accessToken: string;
      setCookies?: SessionCookieSpec[];
    }
  | {
      ok: false;
      response: NextResponse;
    };

type TokenBundle = {
  accessToken: string | null;
  refreshToken: string | null;
  accessCookieName: string;
  refreshCookieName: string;
};

type BerlinRefreshResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      accessTokenMaxAge: number;
      refreshTokenMaxAge: number;
    }
  | {
      ok: false;
      reason: string;
      status: number;
    };

const SHARED_ACCESS_COOKIE = 'ck-access-token';
const SHARED_REFRESH_COOKIE = 'ck-refresh-token';

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1';
}

export function resolveSessionCookieNames(): { access: string; refresh: string } {
  return { access: SHARED_ACCESS_COOKIE, refresh: SHARED_REFRESH_COOKIE };
}

export function resolveSessionCookieDomain(request: NextRequest): string | undefined {
  const hostname = request.nextUrl.hostname.trim().toLowerCase();
  if (!hostname || isLocalHostname(hostname)) return undefined;

  // Cloud-dev runs on `*.dev.clickeen.com` and must share cookies with Bob (`bob.dev.clickeen.com`).
  if (hostname.endsWith('.dev.clickeen.com')) return '.dev.clickeen.com';

  // Production is served from a single app host (`app.clickeen.com`). Keep cookies host-scoped so
  // production sessions never bleed into cloud-dev (`*.dev.clickeen.com`).
  return undefined;
}

export function resolveLegacyCookieDomainsToClear(request: NextRequest): string[] {
  const hostname = request.nextUrl.hostname.trim().toLowerCase();
  if (!hostname || isLocalHostname(hostname)) return [];
  if (hostname === 'clickeen.com' || hostname.endsWith('.clickeen.com')) {
    return ['.clickeen.com'];
  }
  return [];
}

export function applySessionCookies(
  response: NextResponse,
  request: NextRequest,
  cookies?: SessionCookieSpec[],
): NextResponse {
  if (!cookies?.length) return response;
  const secure = request.nextUrl.protocol === 'https:';
  const domain = resolveSessionCookieDomain(request);

  for (const cookie of cookies) {
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

function unauthorized(reasonKey: string, status = 401) {
  return NextResponse.json(
    {
      error: {
        kind: 'AUTH',
        reasonKey,
      },
    },
    { status },
  );
}

function asBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;
  const trimmed = token.trim();
  return trimmed || null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadPart = parts[1] || '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenIsExpired(token: string, leewaySeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  const expClaim = payload?.exp;
  const exp =
    typeof expClaim === 'number'
      ? expClaim
      : typeof expClaim === 'string'
        ? Number.parseInt(expClaim, 10)
        : Number.NaN;
  if (!Number.isFinite(exp)) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + leewaySeconds;
}

function extractSessionTokens(request: NextRequest): TokenBundle {
  const names = resolveSessionCookieNames();
  const accessToken = request.cookies.get(names.access)?.value?.trim() || null;
  const refreshToken = request.cookies.get(names.refresh)?.value?.trim() || null;

  return {
    accessToken,
    refreshToken,
    accessCookieName: names.access,
    refreshCookieName: names.refresh,
  };
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

async function refreshSession(refreshToken: string): Promise<BerlinRefreshResult> {
  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return { ok: false, status: 503, reason: 'roma.errors.auth.refresh_unavailable' };
  }

  const response = await fetch(`${berlinBase}/auth/refresh`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status,
      reason: 'coreui.errors.auth.required',
    };
  }

  const nextAccessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const nextRefreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!nextAccessToken || !nextRefreshToken) {
    return {
      ok: false,
      status: 502,
      reason: 'coreui.errors.auth.required',
    };
  }

  return {
    ok: true,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    accessTokenMaxAge: parsePositiveInt(payload.accessTokenMaxAge, 15 * 60),
    refreshTokenMaxAge: parsePositiveInt(payload.refreshTokenMaxAge, 60 * 60 * 24 * 30),
  };
}

export async function resolveSessionBearer(request: NextRequest): Promise<SessionResolution> {
  const headerToken = asBearerToken(request.headers.get('Authorization'));
  if (headerToken) {
    return { ok: true, accessToken: headerToken };
  }

  const tokens = extractSessionTokens(request);
  if (!tokens.accessToken) {
    return { ok: false, response: unauthorized('coreui.errors.auth.required', 401) };
  }

  if (!tokenIsExpired(tokens.accessToken)) {
    return { ok: true, accessToken: tokens.accessToken };
  }

  if (!tokens.refreshToken) {
    return { ok: false, response: unauthorized('coreui.errors.auth.required', 401) };
  }

  const refreshed = await refreshSession(tokens.refreshToken);
  if (!refreshed.ok) {
    return { ok: false, response: unauthorized('coreui.errors.auth.required', 401) };
  }

  return {
    ok: true,
    accessToken: refreshed.accessToken,
    setCookies: [
      { name: tokens.accessCookieName, value: refreshed.accessToken, maxAge: refreshed.accessTokenMaxAge },
      { name: tokens.refreshCookieName, value: refreshed.refreshToken, maxAge: refreshed.refreshTokenMaxAge },
    ],
  };
}

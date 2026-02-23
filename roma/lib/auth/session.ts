import { NextRequest, NextResponse } from 'next/server';

type SessionCookieSpec = {
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

type SupabaseAuthConfig = {
  baseUrl: string;
  anonKey: string;
};

const DEFAULT_ACCESS_COOKIE = 'sb-access-token';
const DEFAULT_REFRESH_COOKIE = 'sb-refresh-token';

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

function parseAuthTokenCookie(value: string): { accessToken?: string; refreshToken?: string } {
  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded) as unknown;
    if (Array.isArray(parsed)) {
      const accessToken = typeof parsed[0] === 'string' ? parsed[0] : undefined;
      const refreshToken = typeof parsed[1] === 'string' ? parsed[1] : undefined;
      return { accessToken, refreshToken };
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const accessToken =
        typeof record.access_token === 'string'
          ? record.access_token
          : typeof record.accessToken === 'string'
            ? record.accessToken
            : undefined;
      const refreshToken =
        typeof record.refresh_token === 'string'
          ? record.refresh_token
          : typeof record.refreshToken === 'string'
            ? record.refreshToken
            : undefined;
      return { accessToken, refreshToken };
    }
  } catch {
    return {};
  }
  return {};
}

function resolveSupabaseBaseUrl(): string {
  const rawBase =
    process.env.SUPABASE_AUTH_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_BASE_URL ??
    '';
  return rawBase.trim().replace(/\/+$/, '');
}

function extractSessionTokens(request: NextRequest): TokenBundle {
  const cookies = request.cookies.getAll();
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let accessCookieName = DEFAULT_ACCESS_COOKIE;
  let refreshCookieName = DEFAULT_REFRESH_COOKIE;

  for (const cookie of cookies) {
    const name = cookie.name;
    const value = cookie.value;
    if (!accessToken && (name === DEFAULT_ACCESS_COOKIE || (name.startsWith('sb-') && name.endsWith('-access-token')))) {
      accessToken = value;
      accessCookieName = name;
      continue;
    }
    if (
      !refreshToken &&
      (name === DEFAULT_REFRESH_COOKIE || (name.startsWith('sb-') && name.endsWith('-refresh-token')))
    ) {
      refreshToken = value;
      refreshCookieName = name;
      continue;
    }
    if (name.startsWith('sb-') && name.endsWith('-auth-token')) {
      const parsed = parseAuthTokenCookie(value);
      if (!accessToken && parsed.accessToken) {
        accessToken = parsed.accessToken;
        accessCookieName = `${name.replace(/-auth-token$/, '')}-access-token`;
      }
      if (!refreshToken && parsed.refreshToken) {
        refreshToken = parsed.refreshToken;
        refreshCookieName = `${name.replace(/-auth-token$/, '')}-refresh-token`;
      }
    }
  }

  return {
    accessToken,
    refreshToken,
    accessCookieName,
    refreshCookieName,
  };
}

function resolveSupabaseAuthConfig(): SupabaseAuthConfig | null {
  const baseUrl = resolveSupabaseBaseUrl();
  if (!baseUrl) return null;

  const anonKey = (process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!anonKey) return null;

  return { baseUrl, anonKey };
}

async function refreshSession(refreshToken: string): Promise<
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      maxAge: number;
    }
  | {
      ok: false;
      reason: string;
    }
> {
  const config = resolveSupabaseAuthConfig();
  if (!config) return { ok: false, reason: 'roma.errors.auth.refresh_unavailable' };

  const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });

  if (!response.ok) return { ok: false, reason: 'roma.errors.auth.refresh_failed' };

  const payload = (await response.json()) as Record<string, unknown>;
  const nextAccessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
  const nextRefreshToken =
    typeof payload.refresh_token === 'string' && payload.refresh_token.trim() ? payload.refresh_token : refreshToken;
  if (!nextAccessToken) return { ok: false, reason: 'roma.errors.auth.refresh_failed' };

  const expiresIn =
    typeof payload.expires_in === 'number'
      ? payload.expires_in
      : typeof payload.expires_in === 'string'
        ? Number.parseInt(payload.expires_in, 10)
        : 3600;
  const maxAge = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;

  return {
    ok: true,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    maxAge,
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
      { name: tokens.accessCookieName, value: refreshed.accessToken, maxAge: refreshed.maxAge },
      { name: tokens.refreshCookieName, value: refreshed.refreshToken, maxAge: 60 * 60 * 24 * 30 },
    ],
  };
}

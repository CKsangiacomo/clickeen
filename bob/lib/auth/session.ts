import { NextRequest, NextResponse } from 'next/server';

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

type SupabaseAuthConfig = {
  baseUrl: string;
  anonKey: string;
};

type LocalDevBootstrapConfig = {
  baseUrl: string;
  serviceRoleKey: string;
  userEmailHint: string;
  userPassword: string;
  workspaceSlug: string;
};

type LocalDevIssuedSession = {
  accessToken: string;
  refreshToken: string;
  maxAge: number;
  userId: string;
  userEmail: string;
};

const DEFAULT_ACCESS_COOKIE = 'sb-access-token';
const DEFAULT_REFRESH_COOKIE = 'sb-refresh-token';
const LOCAL_DEV_DEFAULT_EMAIL = 'dev@clickeen.local';
const LOCAL_DEV_DEFAULT_PASSWORD = 'DevOnly!12345';
const LOCAL_DEV_DEFAULT_WORKSPACE_SLUG = 'ck-dev';

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

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1';
}

function parseUserEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function parseUserId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function withEmailAlias(email: string, alias: string): string {
  const [localPart, domainPart] = email.split('@');
  if (!localPart || !domainPart) return email;
  const normalizedAlias = alias.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!normalizedAlias) return email;
  return `${localPart}+${normalizedAlias}@${domainPart}`;
}

function resolveLocalDevBootstrapConfig(): LocalDevBootstrapConfig | null {
  const disableFlag = (process.env.ROMA_LOCAL_DEV_AUTH_BOOTSTRAP ?? '').trim().toLowerCase();
  if (disableFlag === '0' || disableFlag === 'false' || disableFlag === 'off') return null;

  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (nodeEnv && nodeEnv !== 'development') return null;

  const parisBase = (process.env.PARIS_BASE_URL ?? '').trim();
  if (parisBase) {
    try {
      const hostname = new URL(parisBase).hostname;
      if (!isLocalHostname(hostname)) return null;
    } catch {
      return null;
    }
  }

  const baseUrl = resolveSupabaseBaseUrl();
  if (!baseUrl) return null;
  try {
    if (!isLocalHostname(new URL(baseUrl).hostname)) return null;
  } catch {
    return null;
  }

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!serviceRoleKey) return null;

  const userEmailHint = parseUserEmail(process.env.ROMA_DEV_USER_EMAIL) ?? LOCAL_DEV_DEFAULT_EMAIL;
  const userPassword = (process.env.ROMA_DEV_USER_PASSWORD ?? LOCAL_DEV_DEFAULT_PASSWORD).trim();
  if (!userPassword) return null;

  const workspaceSlug = (process.env.ROMA_DEV_WORKSPACE_SLUG ?? LOCAL_DEV_DEFAULT_WORKSPACE_SLUG).trim();
  if (!workspaceSlug) return null;

  return {
    baseUrl,
    serviceRoleKey,
    userEmailHint,
    userPassword,
    workspaceSlug,
  };
}

function localDevServiceHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Accept: 'application/json',
  };
}

function parseLocalDevSessionPayload(payload: unknown): LocalDevIssuedSession | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;

  const accessToken = typeof record.access_token === 'string' ? record.access_token.trim() : '';
  const refreshToken = typeof record.refresh_token === 'string' ? record.refresh_token.trim() : '';
  const expiresIn =
    typeof record.expires_in === 'number'
      ? record.expires_in
      : typeof record.expires_in === 'string'
        ? Number.parseInt(record.expires_in, 10)
        : 3600;
  const maxAge = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;

  const userRecord =
    record.user && typeof record.user === 'object' && !Array.isArray(record.user)
      ? (record.user as Record<string, unknown>)
      : null;
  const userId = parseUserId(userRecord?.id) ?? parseUserId(decodeJwtPayload(accessToken)?.sub);
  const userEmail = parseUserEmail(userRecord?.email) ?? parseUserEmail(decodeJwtPayload(accessToken)?.email);

  if (!accessToken || !refreshToken || !userId || !userEmail) return null;
  return {
    accessToken,
    refreshToken,
    maxAge,
    userId,
    userEmail,
  };
}

async function requestPasswordSession(
  config: LocalDevBootstrapConfig,
  email: string,
): Promise<LocalDevIssuedSession | null> {
  const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      email,
      password: config.userPassword,
    }),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return parseLocalDevSessionPayload(payload);
}

async function signUpLocalDevUser(config: LocalDevBootstrapConfig, email: string): Promise<void> {
  await fetch(`${config.baseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      email,
      password: config.userPassword,
    }),
  }).catch(() => null);
}

async function ensureLocalDevSession(
  config: LocalDevBootstrapConfig,
  email: string,
): Promise<LocalDevIssuedSession | null> {
  const normalizedEmail = parseUserEmail(email);
  if (!normalizedEmail) return null;

  const signedIn = await requestPasswordSession(config, normalizedEmail);
  if (signedIn) return signedIn;

  await signUpLocalDevUser(config, normalizedEmail);
  return requestPasswordSession(config, normalizedEmail);
}

async function resolveWorkspaceIdBySlug(config: LocalDevBootstrapConfig): Promise<string | null> {
  const params = new URLSearchParams({
    select: 'id',
    slug: `eq.${config.workspaceSlug}`,
    limit: '1',
  });

  const response = await fetch(`${config.baseUrl}/rest/v1/workspaces?${params.toString()}`, {
    method: 'GET',
    headers: localDevServiceHeaders(config.serviceRoleKey),
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return null;
  const workspaceId = (first as Record<string, unknown>).id;
  return typeof workspaceId === 'string' && workspaceId.trim() ? workspaceId.trim() : null;
}

async function ensureWorkspaceOwnerMembership(
  config: LocalDevBootstrapConfig,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const lookupParams = new URLSearchParams({
    select: 'role',
    workspace_id: `eq.${workspaceId}`,
    user_id: `eq.${userId}`,
    limit: '1',
  });

  const lookupResponse = await fetch(`${config.baseUrl}/rest/v1/workspace_members?${lookupParams.toString()}`, {
    method: 'GET',
    headers: localDevServiceHeaders(config.serviceRoleKey),
    cache: 'no-store',
  });
  if (!lookupResponse.ok) return false;

  const lookupPayload = await lookupResponse.json().catch(() => null);
  const existingRole =
    Array.isArray(lookupPayload) && lookupPayload[0] && typeof lookupPayload[0] === 'object'
      ? (lookupPayload[0] as Record<string, unknown>).role
      : null;
  if (existingRole === 'owner') return true;

  if (typeof existingRole === 'string') {
    const updateParams = new URLSearchParams({
      workspace_id: `eq.${workspaceId}`,
      user_id: `eq.${userId}`,
    });
    const updateResponse = await fetch(`${config.baseUrl}/rest/v1/workspace_members?${updateParams.toString()}`, {
      method: 'PATCH',
      headers: {
        ...localDevServiceHeaders(config.serviceRoleKey),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      cache: 'no-store',
      body: JSON.stringify({ role: 'owner' }),
    });
    return updateResponse.ok;
  }

  const createResponse = await fetch(`${config.baseUrl}/rest/v1/workspace_members`, {
    method: 'POST',
    headers: {
      ...localDevServiceHeaders(config.serviceRoleKey),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    cache: 'no-store',
    body: JSON.stringify([
      {
        workspace_id: workspaceId,
        user_id: userId,
        role: 'owner',
      },
    ]),
  });
  return createResponse.ok;
}

async function bootstrapLocalDevSession(tokens: TokenBundle): Promise<SessionResolution | null> {
  const config = resolveLocalDevBootstrapConfig();
  if (!config) return null;

  try {
    const primarySession = await ensureLocalDevSession(config, config.userEmailHint);
    const fallbackEmail = withEmailAlias(config.userEmailHint, `${Date.now().toString(36)}_auto`);
    const session = primarySession ?? (fallbackEmail === config.userEmailHint ? null : await ensureLocalDevSession(config, fallbackEmail));
    if (!session) return null;

    const workspaceId = await resolveWorkspaceIdBySlug(config);
    if (!workspaceId) return null;
    const membershipReady = await ensureWorkspaceOwnerMembership(config, workspaceId, session.userId);
    if (!membershipReady) return null;

    return {
      ok: true,
      accessToken: session.accessToken,
      setCookies: [
        {
          name: tokens.accessCookieName || DEFAULT_ACCESS_COOKIE,
          value: session.accessToken,
          maxAge: session.maxAge,
        },
        {
          name: tokens.refreshCookieName || DEFAULT_REFRESH_COOKIE,
          value: session.refreshToken,
          maxAge: 60 * 60 * 24 * 30,
        },
      ],
    };
  } catch {
    return null;
  }
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

function resolveSupabaseAuthConfig():
  | SupabaseAuthConfig
  | null {
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
    typeof payload.refresh_token === 'string' && payload.refresh_token.trim()
      ? payload.refresh_token
      : refreshToken;
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
    const bootstrap = await bootstrapLocalDevSession(tokens);
    if (bootstrap) return bootstrap;
    return { ok: false, response: unauthorized('roma.errors.auth.session_missing', 401) };
  }

  if (!tokenIsExpired(tokens.accessToken)) {
    return { ok: true, accessToken: tokens.accessToken };
  }

  if (!tokens.refreshToken) {
    const bootstrap = await bootstrapLocalDevSession(tokens);
    if (bootstrap) return bootstrap;
    return { ok: false, response: unauthorized('roma.errors.auth.session_expired', 401) };
  }

  const refreshed = await refreshSession(tokens.refreshToken);
  if (!refreshed.ok) {
    const bootstrap = await bootstrapLocalDevSession(tokens);
    if (bootstrap) return bootstrap;
    return { ok: false, response: unauthorized(refreshed.reason, 401) };
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

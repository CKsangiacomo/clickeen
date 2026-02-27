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

export type ResolveSessionBearerOptions = {
  allowLocalDevBootstrap?: boolean;
};

type TokenBundle = {
  accessToken: string | null;
  refreshToken: string | null;
  accessCookieName: string;
  refreshCookieName: string;
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

type BerlinSessionBundle = {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
};

const ACCESS_COOKIE = 'ck-access-token';
const REFRESH_COOKIE = 'ck-refresh-token';
const LOCAL_DEV_DEFAULT_EMAIL = 'dev@clickeen.local';
const LOCAL_DEV_DEFAULT_WORKSPACE_SLUG = 'ck-dev';
const DEVSTUDIO_SURFACE = 'devstudio';

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

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
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

function isLocalEnvStage(): boolean {
  const stage = (process.env.ENV_STAGE ?? process.env.NEXT_PUBLIC_ENV_STAGE ?? '').trim().toLowerCase();
  return stage === 'local';
}

function normalizeSurfaceMarker(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function hasDevstudioSurface(value: string | null | undefined): boolean {
  return normalizeSurfaceMarker(value) === DEVSTUDIO_SURFACE;
}

function isKnownDevstudioPort(port: string): boolean {
  return port === '5173' || port === '4173';
}

function originSignalsDevstudio(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (!isLocalHostname(parsed.hostname)) return false;
    return isKnownDevstudioPort(parsed.port);
  } catch {
    return false;
  }
}

function refererSignalsDevstudio(referrer: string | null): boolean {
  if (!referrer) return false;
  try {
    const parsed = new URL(referrer);
    if (hasDevstudioSurface(parsed.searchParams.get('surface'))) return true;
    const path = parsed.pathname.trim().toLowerCase();
    if (path.includes('/dev-widget-workspace')) return true;
    if (!isLocalHostname(parsed.hostname)) return false;
    return isKnownDevstudioPort(parsed.port);
  } catch {
    return false;
  }
}

export function isDevstudioLocalBootstrapRequest(request: NextRequest): boolean {
  if (!isLocalEnvStage()) return false;
  if (!isLocalHostname(request.nextUrl.hostname)) return false;
  if (hasDevstudioSurface(request.nextUrl.searchParams.get('surface'))) return true;
  if (hasDevstudioSurface(request.headers.get('x-ck-surface'))) return true;
  if (originSignalsDevstudio(request.headers.get('origin'))) return true;
  return refererSignalsDevstudio(request.headers.get('referer'));
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
  const envStage = (process.env.ENV_STAGE ?? '').trim().toLowerCase();
  if (envStage !== 'local') return null;

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

  const userEmailHint = parseUserEmail(process.env.CK_ADMIN_EMAIL) ?? LOCAL_DEV_DEFAULT_EMAIL;
  const userPassword = (process.env.CK_ADMIN_PASSWORD ?? '').trim();
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

async function requestBerlinPasswordSession(
  email: string,
  password: string,
): Promise<BerlinSessionBundle | null> {
  const berlinBase = resolveBerlinBaseUrl();
  const response = await fetch(`${berlinBase}/auth/login/password`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload) return null;

  const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    accessTokenMaxAge: parsePositiveInt(payload.accessTokenMaxAge, 15 * 60),
    refreshTokenMaxAge: parsePositiveInt(payload.refreshTokenMaxAge, 60 * 60 * 24 * 30),
  };
}

async function bootstrapLocalDevSession(tokens: TokenBundle): Promise<SessionResolution | null> {
  const config = resolveLocalDevBootstrapConfig();
  if (!config) return null;

  try {
    const primarySession = await ensureLocalDevSession(config, config.userEmailHint);
    const fallbackEmail = withEmailAlias(config.userEmailHint, `${Date.now().toString(36)}_auto`);
    const session =
      primarySession ??
      (fallbackEmail === config.userEmailHint ? null : await ensureLocalDevSession(config, fallbackEmail));
    if (!session) return null;

    const workspaceId = await resolveWorkspaceIdBySlug(config);
    if (!workspaceId) return null;
    const membershipReady = await ensureWorkspaceOwnerMembership(config, workspaceId, session.userId);
    if (!membershipReady) return null;

    const berlinSession = await requestBerlinPasswordSession(session.userEmail, config.userPassword);
    if (!berlinSession) return null;

    return {
      ok: true,
      accessToken: berlinSession.accessToken,
      setCookies: [
        {
          name: tokens.accessCookieName || ACCESS_COOKIE,
          value: berlinSession.accessToken,
          maxAge: berlinSession.accessTokenMaxAge,
        },
        {
          name: tokens.refreshCookieName || REFRESH_COOKIE,
          value: berlinSession.refreshToken,
          maxAge: berlinSession.refreshTokenMaxAge,
        },
      ],
    };
  } catch {
    return null;
  }
}

function extractSessionTokens(request: NextRequest): TokenBundle {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value?.trim() || null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value?.trim() || null;

  return {
    accessToken,
    refreshToken,
    accessCookieName: ACCESS_COOKIE,
    refreshCookieName: REFRESH_COOKIE,
  };
}

async function refreshSession(refreshToken: string): Promise<
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
    }
> {
  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return { ok: false, reason: 'roma.errors.auth.refresh_unavailable' };
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

  if (!response.ok) return { ok: false, reason: 'roma.errors.auth.refresh_failed' };

  const payload = (await response.json()) as Record<string, unknown>;
  const nextAccessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const nextRefreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!nextAccessToken || !nextRefreshToken) return { ok: false, reason: 'roma.errors.auth.refresh_failed' };

  return {
    ok: true,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    accessTokenMaxAge: parsePositiveInt(payload.accessTokenMaxAge, 15 * 60),
    refreshTokenMaxAge: parsePositiveInt(payload.refreshTokenMaxAge, 60 * 60 * 24 * 30),
  };
}

export async function resolveSessionBearer(
  request: NextRequest,
  options: ResolveSessionBearerOptions = {},
): Promise<SessionResolution> {
  const headerToken = asBearerToken(request.headers.get('Authorization'));
  if (headerToken) {
    return { ok: true, accessToken: headerToken };
  }

  const canBootstrapLocalDev =
    options.allowLocalDevBootstrap === true && isDevstudioLocalBootstrapRequest(request);
  const tokens = extractSessionTokens(request);
  if (!tokens.accessToken) {
    if (canBootstrapLocalDev) {
      const bootstrap = await bootstrapLocalDevSession(tokens);
      if (bootstrap) return bootstrap;
    }
    return { ok: false, response: unauthorized('coreui.errors.auth.required', 401) };
  }

  if (!tokenIsExpired(tokens.accessToken)) {
    return { ok: true, accessToken: tokens.accessToken };
  }

  if (!tokens.refreshToken) {
    if (canBootstrapLocalDev) {
      const bootstrap = await bootstrapLocalDevSession(tokens);
      if (bootstrap) return bootstrap;
    }
    return { ok: false, response: unauthorized('coreui.errors.auth.required', 401) };
  }

  const refreshed = await refreshSession(tokens.refreshToken);
  if (!refreshed.ok) {
    if (canBootstrapLocalDev) {
      const bootstrap = await bootstrapLocalDevSession(tokens);
      if (bootstrap) return bootstrap;
    }
    return { ok: false, response: unauthorized('coreui.errors.auth.required', 401) };
  }

  return {
    ok: true,
    accessToken: refreshed.accessToken,
    setCookies: [
      {
        name: tokens.accessCookieName,
        value: refreshed.accessToken,
        maxAge: refreshed.accessTokenMaxAge,
      },
      {
        name: tokens.refreshCookieName,
        value: refreshed.refreshToken,
        maxAge: refreshed.refreshTokenMaxAge,
      },
    ],
  };
}

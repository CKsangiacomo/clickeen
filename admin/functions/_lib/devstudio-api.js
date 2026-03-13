const DEVSTUDIO_ACCESS_COOKIE = 'ck-access-token';
const DEVSTUDIO_REFRESH_COOKIE = 'ck-refresh-token';
const DEFAULT_PLATFORM_ACCOUNT_ID = '00000000-0000-0000-0000-000000000100';

function parseCookieHeader(header) {
  const values = new Map();
  const raw = String(header || '');
  if (!raw.trim()) return values;
  raw.split(';').forEach((entry) => {
    const [rawName, ...rest] = entry.trim().split('=');
    if (!rawName) return;
    const joined = rest.join('=').trim();
    if (!joined) return;
    try {
      values.set(rawName, decodeURIComponent(joined));
    } catch {
      values.set(rawName, joined);
    }
  });
  return values;
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadPart = parts[1] || '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function tokenIsExpired(token, leewaySeconds = 30) {
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

function parsePositiveInt(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function resolveBerlinBaseUrl(request, env) {
  const configured = String(env?.BERLIN_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname === 'devstudio.dev.clickeen.com') {
    return 'https://berlin-dev.clickeen.workers.dev';
  }
  throw new Error('Missing BERLIN_BASE_URL for DevStudio runtime.');
}

function resolvePlatformAccountId(env) {
  return String(env?.CK_PLATFORM_ACCOUNT_ID || DEFAULT_PLATFORM_ACCOUNT_ID)
    .trim()
    .toLowerCase();
}

function buildJsonResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function appendSessionCookies(headers, cookies) {
  if (!cookies?.length) return;
  for (const cookie of cookies) {
    headers.append(
      'set-cookie',
      `${cookie.name}=${encodeURIComponent(cookie.value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookie.maxAge}`,
    );
  }
}

async function refreshBerlinSession(request, env, refreshToken) {
  const response = await fetch(`${resolveBerlinBaseUrl(request, env)}/auth/refresh`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== 'object') return { ok: false };

  const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const nextRefreshToken =
    typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!accessToken || !nextRefreshToken) return { ok: false };

  return {
    ok: true,
    accessToken,
    setCookies: [
      {
        name: DEVSTUDIO_ACCESS_COOKIE,
        value: accessToken,
        maxAge: parsePositiveInt(payload.accessTokenMaxAge, 15 * 60),
      },
      {
        name: DEVSTUDIO_REFRESH_COOKIE,
        value: nextRefreshToken,
        maxAge: parsePositiveInt(payload.refreshTokenMaxAge, 30 * 24 * 60 * 60),
      },
    ],
  };
}

async function resolveBerlinAccess(request, env) {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  let accessToken = String(cookies.get(DEVSTUDIO_ACCESS_COOKIE) || '').trim();
  const refreshToken = String(cookies.get(DEVSTUDIO_REFRESH_COOKIE) || '').trim();
  let setCookies;

  if (!accessToken && !refreshToken) {
    return { kind: 'no-session' };
  }

  if ((!accessToken || tokenIsExpired(accessToken)) && refreshToken) {
    const refreshed = await refreshBerlinSession(request, env, refreshToken);
    if (!refreshed.ok) {
      return {
        kind: 'error',
        status: 401,
        body: {
          error: {
            kind: 'AUTH',
            reasonKey: 'coreui.errors.auth.required',
            detail: 'devstudio_berlin_refresh_failed',
          },
        },
      };
    }
    accessToken = refreshed.accessToken;
    setCookies = refreshed.setCookies;
  }

  if (!accessToken) {
    return { kind: 'no-session' };
  }

  return {
    kind: 'ok',
    accessToken,
    ...(setCookies?.length ? { setCookies } : {}),
  };
}

async function fetchBerlinBootstrap(request, env, accessToken) {
  const response = await fetch(`${resolveBerlinBaseUrl(request, env)}/v1/session/bootstrap`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status || 502,
      body:
        payload && typeof payload === 'object'
          ? payload
          : {
              error: {
                kind: response.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
                reasonKey:
                  response.status === 401
                    ? 'coreui.errors.auth.required'
                    : 'coreui.errors.auth.contextUnavailable',
                detail: 'devstudio_berlin_bootstrap_failed',
              },
            },
    };
  }
  return { ok: true, payload };
}

function findPlatformAccount(payload, platformAccountId) {
  const accounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
  return (
    accounts.find((entry) => String(entry?.accountId || '').trim().toLowerCase() === platformAccountId) ||
    null
  );
}

export async function resolvePlatformContext(request, env) {
  const access = await resolveBerlinAccess(request, env);
  if (access.kind === 'no-session') {
    return {
      ok: false,
      status: 401,
      body: {
        error: {
          kind: 'AUTH',
          reasonKey: 'coreui.errors.auth.required',
          detail: 'devstudio_berlin_session_required',
        },
      },
    };
  }
  if (access.kind === 'error') {
    return access;
  }

  const bootstrap = await fetchBerlinBootstrap(request, env, access.accessToken);
  if (!bootstrap.ok) {
    return {
      ok: false,
      status: bootstrap.status,
      body: bootstrap.body,
      ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
    };
  }

  const platformAccountId = resolvePlatformAccountId(env);
  const platformAccount = findPlatformAccount(bootstrap.payload, platformAccountId);
  if (!platformAccount) {
    return {
      ok: false,
      status: 403,
      body: {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'platform_account_membership_required',
        },
      },
      ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
    };
  }

  return {
    ok: true,
    accountId: platformAccountId,
    scope: 'platform',
    mode: 'berlin-session',
    user: bootstrap.payload.user ?? null,
    profile: bootstrap.payload.profile ?? null,
    defaults: bootstrap.payload.defaults ?? null,
    accessToken: access.accessToken,
    bootstrap: bootstrap.payload,
    ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
  };
}

export function buildContextResponse(context) {
  const headers = new Headers();
  appendSessionCookies(headers, context.setCookies);
  if (!context.ok) {
    return buildJsonResponse(context.body, {
      status: context.status,
      headers,
    });
  }

  return buildJsonResponse(
    {
      accountId: context.accountId,
      scope: context.scope,
      mode: context.mode,
      user: context.user ?? null,
      profile: context.profile ?? null,
      defaults: context.defaults ?? null,
    },
    {
      status: 200,
      headers,
    },
  );
}

export function buildAccountsListResponse(context) {
  const headers = new Headers();
  appendSessionCookies(headers, context.setCookies);
  if (!context.ok) {
    return buildJsonResponse(context.body, {
      status: context.status,
      headers,
    });
  }

  return buildJsonResponse(
    {
      user: context.bootstrap.user ?? null,
      profile: context.bootstrap.profile ?? null,
      accounts: Array.isArray(context.bootstrap.accounts) ? context.bootstrap.accounts : [],
      defaults: context.bootstrap.defaults ?? { accountId: null },
    },
    {
      status: 200,
      headers,
    },
  );
}

export async function proxyBerlinJson(request, env, context, pathname, init = {}) {
  const upstream = await fetch(`${resolveBerlinBaseUrl(request, env)}${pathname}`, {
    method: init.method || request.method || 'GET',
    headers: {
      authorization: `Bearer ${context.accessToken}`,
      accept: 'application/json',
      ...(init.body != null ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    body: init.body,
    cache: 'no-store',
  });

  const text = await upstream.text();
  const headers = new Headers();
  headers.set(
    'content-type',
    upstream.headers.get('content-type') || 'application/json; charset=utf-8',
  );
  headers.set('cache-control', 'no-store');
  appendSessionCookies(headers, context.setCookies);
  return new Response(text, {
    status: upstream.status,
    headers,
  });
}


import { resolveBerlinBaseUrl } from './env.js';

export const ADMIN_ACCOUNT_ID = 'CLICKEEN';
export const ADMIN_ROLES = new Set(['owner', 'admin']);
export const E2E_AUTH_HEADER = 'x-ck-e2e-auth';

export function extractReasonKey(payload, fallback) {
  const error = payload && typeof payload === 'object' ? payload.error : null;
  const reason = error && typeof error === 'object' ? error.reasonKey : error;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : fallback;
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateDevstudioBootstrap(payload) {
  const activeAccount = payload && typeof payload === 'object' ? payload.activeAccount : null;
  const authz = payload && typeof payload === 'object' ? payload.authz : null;
  const accountId =
    stringValue(activeAccount?.accountPublicId) || stringValue(activeAccount?.accountId);
  const role = stringValue(activeAccount?.role || authz?.role).toLowerCase();
  const accountCapsule = stringValue(authz?.accountCapsule);

  if (!accountId || !accountCapsule) {
    return {
      ok: false,
      status: 401,
      reasonKey: 'coreui.errors.auth.contextUnavailable',
      detail: 'devstudio_bootstrap_context_missing',
    };
  }

  if (accountId !== ADMIN_ACCOUNT_ID || !ADMIN_ROLES.has(role)) {
    return {
      ok: false,
      status: 403,
      reasonKey: 'coreui.errors.auth.forbidden',
      detail: 'devstudio_account_or_role_forbidden',
    };
  }

  return {
    ok: true,
    accountId,
    accountCapsule,
  };
}

export async function fetchBootstrap(env, accessToken) {
  const berlinBase = resolveBerlinBaseUrl(env);
  const response = await fetch(`${berlinBase}/v1/session/bootstrap`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      reasonKey: extractReasonKey(payload, 'coreui.errors.auth.required'),
      payload,
    };
  }

  const validated = validateDevstudioBootstrap(payload);
  if (!validated.ok) {
    return {
      ok: false,
      status: validated.status,
      reasonKey: validated.reasonKey,
      detail: validated.detail,
      payload,
    };
  }

  return {
    ok: true,
    payload,
    accountId: validated.accountId,
    accountCapsule: validated.accountCapsule,
  };
}

export async function finishBerlinSession(env, finishId) {
  const berlinBase = resolveBerlinBaseUrl(env);
  const response = await fetch(`${berlinBase}/auth/finish`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ finishId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status || 502,
      reasonKey: extractReasonKey(payload, 'coreui.errors.auth.finish.invalidOrExpired'),
      payload,
    };
  }
  return { ok: true, payload };
}

export async function refreshBerlinSession(env, refreshToken) {
  const berlinBase = resolveBerlinBaseUrl(env);
  const response = await fetch(`${berlinBase}/auth/refresh`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ refreshToken }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status || 502,
      reasonKey: extractReasonKey(payload, 'coreui.errors.auth.required'),
      payload,
    };
  }

  const accessToken = stringValue(payload.accessToken);
  const nextRefreshToken = stringValue(payload.refreshToken);
  if (!accessToken || !nextRefreshToken) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'coreui.errors.auth.required',
      payload,
    };
  }

  return {
    ok: true,
    accessToken,
    refreshToken: nextRefreshToken,
    accessTokenMaxAge: payload.accessTokenMaxAge,
    refreshTokenMaxAge: payload.refreshTokenMaxAge,
  };
}

export async function requestBerlinE2ESession(env, email, secret) {
  const berlinBase = resolveBerlinBaseUrl(env);
  const response = await fetch(`${berlinBase}/internal/e2e/session`, {
    method: 'POST',
    headers: {
      [E2E_AUTH_HEADER]: secret,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status || 502,
      reasonKey: extractReasonKey(payload, 'coreui.errors.auth.login_failed'),
      payload,
    };
  }
  return { ok: true, payload };
}

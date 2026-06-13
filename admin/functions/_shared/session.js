import { ACCESS_COOKIE, REFRESH_COOKIE, parseCookies, sessionCookieHeaders } from './cookies.js';
import { fetchBootstrap, refreshBerlinSession } from './berlin.js';

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function resolveDevstudioSession(request, env) {
  const cookies = parseCookies(request);
  const accessToken = stringValue(cookies.get(ACCESS_COOKIE));
  const refreshToken = stringValue(cookies.get(REFRESH_COOKIE));

  if (accessToken) {
    const bootstrap = await fetchBootstrap(env, accessToken);
    if (bootstrap.ok) {
      return {
        ok: true,
        accountId: bootstrap.accountId,
        setCookies: sessionCookieHeaders(request, {
          accountCapsule: bootstrap.accountCapsule,
        }),
      };
    }
    if (bootstrap.status !== 401) {
      return {
        ok: false,
        status: bootstrap.status,
        reasonKey: bootstrap.reasonKey,
      };
    }
  }

  if (!refreshToken) {
    return {
      ok: false,
      status: 401,
      reasonKey: 'coreui.errors.auth.required',
    };
  }

  const refreshed = await refreshBerlinSession(env, refreshToken);
  if (!refreshed.ok) {
    return {
      ok: false,
      status: 401,
      reasonKey: 'coreui.errors.auth.required',
    };
  }

  const bootstrap = await fetchBootstrap(env, refreshed.accessToken);
  if (!bootstrap.ok) {
    return {
      ok: false,
      status: bootstrap.status,
      reasonKey: bootstrap.reasonKey,
    };
  }

  const setCookies = sessionCookieHeaders(request, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessTokenMaxAge: refreshed.accessTokenMaxAge,
    refreshTokenMaxAge: refreshed.refreshTokenMaxAge,
    accountCapsule: bootstrap.accountCapsule,
  });
  if (!setCookies) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'coreui.errors.auth.required',
    };
  }

  return {
    ok: true,
    accountId: bootstrap.accountId,
    setCookies,
  };
}

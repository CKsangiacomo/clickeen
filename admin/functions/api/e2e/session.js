import { E2E_AUTH_HEADER, fetchBootstrap, requestBerlinE2ESession } from '../../_shared/berlin.js';
import { sessionCookieHeaders } from '../../_shared/cookies.js';
import { isProductionStage } from '../../_shared/env.js';
import { cloneResponseWithCookies, json, methodNotAllowed } from '../../_shared/http.js';

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  const email = stringValue(value).toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function readJsonBody(request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
}

function requestSecret(request) {
  return stringValue(request.headers.get(E2E_AUTH_HEADER)) || null;
}

export async function onRequest(context) {
  if (context.request.method.toUpperCase() !== 'POST') return methodNotAllowed();

  const { request, env } = context;
  const configuredSecret = stringValue(env.E2E_AUTH_SECRET);
  if (isProductionStage(env) || !configuredSecret) {
    return json({ error: 'NOT_FOUND' }, 404);
  }

  const body = await readJsonBody(request);
  const email = normalizeEmail(body?.email);
  const secret = requestSecret(request);
  if (!email) {
    return json(
      {
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.auth.login_failed',
          detail: 'e2e_email_invalid',
        },
      },
      422,
    );
  }
  if (!secret || secret !== configuredSecret) {
    return json(
      {
        error: {
          kind: 'AUTH',
          reasonKey: 'coreui.errors.auth.required',
          detail: 'e2e_secret_invalid',
        },
      },
      401,
    );
  }

  const upstream = await requestBerlinE2ESession(env, email, secret).catch((error) => ({
    ok: false,
    status: 503,
    reasonKey: 'devstudio.errors.auth.config_missing',
    error,
  }));
  if (!upstream.ok) {
    return json(
      {
        error: {
          kind:
            upstream.status === 401
              ? 'AUTH'
              : upstream.status === 403
                ? 'DENY'
                : 'UPSTREAM_UNAVAILABLE',
          reasonKey: upstream.reasonKey,
        },
      },
      upstream.status || 502,
    );
  }

  const accessToken = stringValue(upstream.payload.accessToken);
  const refreshToken = stringValue(upstream.payload.refreshToken);
  if (!accessToken || !refreshToken) {
    return json(
      { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.login_failed' } },
      502,
    );
  }

  const bootstrap = await fetchBootstrap(env, accessToken).catch((error) => ({
    ok: false,
    status: 503,
    reasonKey: 'devstudio.errors.auth.config_missing',
    error,
  }));
  if (!bootstrap.ok) {
    return json(
      {
        error: {
          kind: bootstrap.status === 403 ? 'DENY' : 'AUTH',
          reasonKey: bootstrap.reasonKey,
        },
      },
      bootstrap.status || 401,
    );
  }

  const cookies = sessionCookieHeaders(request, {
    accessToken,
    refreshToken,
    accessTokenMaxAge: upstream.payload.accessTokenMaxAge,
    refreshTokenMaxAge: upstream.payload.refreshTokenMaxAge,
    accountCapsule: bootstrap.accountCapsule,
  });
  if (!cookies) {
    return json(
      { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.login_failed' } },
      502,
    );
  }

  const response = json({ ok: true, accountId: bootstrap.accountId });
  return cloneResponseWithCookies(response, cookies);
}

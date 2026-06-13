import { fetchBootstrap, finishBerlinSession } from '../../_shared/berlin.js';
import { sessionCookieHeaders } from '../../_shared/cookies.js';
import { resolveDevstudioOrigin } from '../../_shared/env.js';
import {
  cloneResponseWithCookies,
  json,
  methodNotAllowed,
  redirect,
  resolveSafeNextPath,
} from '../../_shared/http.js';

function isValidFinishId(value) {
  return /^[A-Za-z0-9_-]{16,120}$/.test(String(value || '').trim());
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function onRequest(context) {
  if (context.request.method.toUpperCase() !== 'GET') return methodNotAllowed();

  const { request, env } = context;
  const url = new URL(request.url);
  const finishId = stringValue(url.searchParams.get('finishId'));
  if (!isValidFinishId(finishId)) {
    return json(
      { error: { kind: 'AUTH', reasonKey: 'coreui.errors.auth.finish.invalidOrExpired' } },
      401,
    );
  }

  const finished = await finishBerlinSession(env, finishId);
  if (!finished.ok) {
    return json({ error: { kind: 'AUTH', reasonKey: finished.reasonKey } }, finished.status || 401);
  }
  const continuation = finished.payload && typeof finished.payload === 'object' ? finished.payload.continuation : null;
  const nextPath = resolveSafeNextPath(continuation?.next);
  if (!nextPath) return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.auth.continuationInvalid' } }, 422);

  const accessToken = stringValue(finished.payload.accessToken);
  const refreshToken = stringValue(finished.payload.refreshToken);
  if (!accessToken || !refreshToken) {
    return json({ error: { kind: 'AUTH', reasonKey: 'coreui.errors.auth.login_failed' } }, 502);
  }

  const bootstrap = await fetchBootstrap(env, accessToken);
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

  const destination = new URL(nextPath, resolveDevstudioOrigin(env));
  const response = redirect(destination.toString(), 302);
  const cookies = sessionCookieHeaders(request, {
    accessToken,
    refreshToken,
    accessTokenMaxAge: finished.payload.accessTokenMaxAge,
    refreshTokenMaxAge: finished.payload.refreshTokenMaxAge,
    accountCapsule: bootstrap.accountCapsule,
  });
  if (!cookies) {
    return json({ error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.login_failed' } }, 502);
  }
  return cloneResponseWithCookies(response, cookies);
}

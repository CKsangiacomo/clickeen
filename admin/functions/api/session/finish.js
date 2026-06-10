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

function parseContinuationNext(payload) {
  const continuation = payload && typeof payload === 'object' ? payload.continuation : null;
  return resolveSafeNextPath(continuation?.next, '/');
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

  const finished = await finishBerlinSession(env, finishId).catch((error) => ({
    ok: false,
    status: 503,
    reasonKey: 'devstudio.errors.auth.config_missing',
    error,
  }));
  if (!finished.ok) {
    return json({ error: { kind: 'AUTH', reasonKey: finished.reasonKey } }, finished.status || 401);
  }

  const accessToken = stringValue(finished.payload.accessToken);
  const refreshToken = stringValue(finished.payload.refreshToken);
  if (!accessToken || !refreshToken) {
    return json({ error: { kind: 'AUTH', reasonKey: 'coreui.errors.auth.login_failed' } }, 502);
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

  const destination = new URL(parseContinuationNext(finished.payload), resolveDevstudioOrigin(env));
  const response = redirect(destination.toString(), 302);
  return cloneResponseWithCookies(
    response,
    sessionCookieHeaders(request, {
      accessToken,
      refreshToken,
      accessTokenMaxAge: finished.payload.accessTokenMaxAge,
      refreshTokenMaxAge: finished.payload.refreshTokenMaxAge,
      accountCapsule: bootstrap.accountCapsule,
    }),
  );
}

import { resolveDevstudioOrigin } from './_shared/env.js';
import { cloneResponseWithCookies, json, redirect } from './_shared/http.js';
import { resolveDevstudioSession } from './_shared/session.js';

const PUBLIC_API_PATHS = new Set([
  '/api/session/login/google',
  '/api/session/finish',
  '/api/e2e/session',
]);

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function buildLoginLocation(request) {
  const url = new URL(request.url);
  const login = new URL('/api/session/login/google', url.origin);
  login.searchParams.set('next', `${url.pathname}${url.search}`);
  return login.toString();
}

function shouldRedirectToCanonical(request, env) {
  const url = new URL(request.url);
  const canonical = new URL(resolveDevstudioOrigin(env));
  return url.origin !== canonical.origin;
}

function canonicalLocation(request, env) {
  const url = new URL(request.url);
  const canonical = new URL(resolveDevstudioOrigin(env));
  canonical.pathname = url.pathname;
  canonical.search = url.search;
  return canonical.toString();
}

function authJsonFailure(status, reasonKey) {
  return json(
    {
      error: {
        kind: status === 403 ? 'DENY' : 'AUTH',
        reasonKey,
      },
    },
    status,
  );
}

function authHtmlFailure(status, reasonKey) {
  return new Response(status === 403 ? 'Forbidden' : 'Authentication unavailable', {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-ck-reason': reasonKey,
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (shouldRedirectToCanonical(request, env)) {
    return redirect(canonicalLocation(request, env), 308);
  }

  if (PUBLIC_API_PATHS.has(pathname)) {
    return context.next();
  }

  if (isApiPath(pathname)) {
    const session = await resolveDevstudioSession(request, env).catch(() => ({
      ok: false,
      status: 503,
      reasonKey: 'devstudio.errors.auth.config_missing',
    }));
    if (!session.ok) {
      return authJsonFailure(
        session.status || 401,
        session.reasonKey || 'coreui.errors.auth.required',
      );
    }
    const response = await context.next();
    return cloneResponseWithCookies(response, session.setCookies);
  }

  const session = await resolveDevstudioSession(request, env).catch(() => ({
    ok: false,
    status: 503,
    reasonKey: 'devstudio.errors.auth.config_missing',
  }));
  if (!session.ok) {
    const status = session.status || 401;
    const reasonKey = session.reasonKey || 'coreui.errors.auth.required';
    if (status === 401) return redirect(buildLoginLocation(request), 302);
    return authHtmlFailure(status, reasonKey);
  }

  const response = await context.next();
  return cloneResponseWithCookies(response, session.setCookies);
}

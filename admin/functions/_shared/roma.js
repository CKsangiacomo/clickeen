import { resolveDevstudioOrigin, resolveRomaBaseUrl } from './env.js';
import { cloneResponseWithCookies, json } from './http.js';
import { resolveDevstudioSession } from './session.js';

function failure(status, reasonKey) {
  return json({
    error: {
      kind: status === 401 ? 'AUTH' : status === 403 ? 'DENY' : 'UPSTREAM_UNAVAILABLE',
      reasonKey,
    },
  }, status);
}

export async function withRomaSession(context, handler) {
  if (context.request.method !== 'GET') {
    const origin = context.request.headers.get('origin');
    if (origin !== resolveDevstudioOrigin(context.env)) {
      return failure(403, 'devstudio.errors.request.origin_invalid');
    }
  }

  const inherited = context.data?.devstudioSession;
  const session = inherited ?? await resolveDevstudioSession(context.request, context.env).catch(() => ({
    ok: false,
    status: 503,
    reasonKey: 'devstudio.errors.auth.config_missing',
  }));
  if (!session.ok) {
    return failure(session.status || 401, session.reasonKey || 'coreui.errors.auth.required');
  }
  if (session.accountId !== 'CLICKEEN' || typeof session.accessToken !== 'string' || !session.accessToken) {
    return failure(403, 'devstudio.errors.auth.account_forbidden');
  }

  const response = await handler(session);
  return inherited ? response : cloneResponseWithCookies(response, session.setCookies);
}

export async function fetchRoma(context, session, path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${session.accessToken}`);
  headers.set('accept', 'application/json');
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  return fetch(new URL(path, `${resolveRomaBaseUrl(context.env)}/`), {
    ...init,
    headers,
  });
}

export async function romaResponse(context, session, path, init = {}) {
  const response = await fetchRoma(context, session, path, init);
  return new Response(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function requireRomaCatalogTemplate(context, session, path) {
  const response = await fetchRoma(context, session, path);
  if (!response.ok) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
  try {
    const payload = await response.json();
    return payload && typeof payload === 'object' && payload.template &&
      typeof payload.template === 'object'
      ? null
      : failure(502, 'devstudio.errors.roma.invalid_payload');
  } catch {
    return failure(502, 'devstudio.errors.roma.invalid_payload');
  }
}

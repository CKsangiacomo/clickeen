import { CACHE_HEADERS, REDIRECT_CACHE_HEADERS } from './types';

export function json(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      ...CACHE_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

export function authError(reasonKey: string, status = 401, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'AUTH',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status },
  );
}

export function validationError(reasonKey: string, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'VALIDATION',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status: 422 },
  );
}

export function conflictError(reasonKey: string, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'AUTH',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status: 409 },
  );
}

export function internalError(reasonKey: string, detail?: string): Response {
  return json(
    {
      error: {
        kind: 'INTERNAL',
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status: 500 },
  );
}

export function methodNotAllowed(): Response {
  return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
}

export function redirect(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      location,
      ...REDIRECT_CACHE_HEADERS,
    },
  });
}

import type { Env } from './types';
import { readJson } from './http';
import { ckError, errorDetail } from './errors';
import { asTrimmedString } from './validation';

type SanfranciscoAuthMode = 'paris-dev-bearer' | 'none';

function internalResponse(reasonKey: string, detail: string, status = 502): { ok: false; response: Response } {
  return {
    ok: false,
    response: ckError({ kind: 'INTERNAL', reasonKey, detail }, status),
  };
}

function resolveSanfranciscoBaseUrl(env: Env): { ok: true; baseUrl: string } | { ok: false; response: Response } {
  const baseUrl = asTrimmedString(env.SANFRANCISCO_BASE_URL);
  if (!baseUrl) {
    return internalResponse('coreui.errors.auth.contextUnavailable', 'missing_sanfrancisco_base_url', 503);
  }
  return { ok: true, baseUrl };
}

function resolveSanfranciscoDevBearer(env: Env): { ok: true; token: string } | { ok: false; response: Response } {
  const token = asTrimmedString(env.PARIS_DEV_JWT);
  if (!token) {
    return internalResponse('coreui.errors.auth.contextUnavailable', 'missing_paris_dev_jwt', 503);
  }
  return { ok: true, token };
}

export async function callSanfranciscoJson(args: {
  env: Env;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  auth?: SanfranciscoAuthMode;
}): Promise<
  | { ok: true; payload: unknown }
  | { ok: false; response: Response }
> {
  const base = resolveSanfranciscoBaseUrl(args.env);
  if (!base.ok) return base;

  const authMode = args.auth ?? 'paris-dev-bearer';
  const headers = new Headers(args.headers || {});
  if (authMode === 'paris-dev-bearer') {
    const bearer = resolveSanfranciscoDevBearer(args.env);
    if (!bearer.ok) return bearer;
    headers.set('authorization', `Bearer ${bearer.token}`);
  }

  let body: BodyInit | undefined;
  if (args.body !== undefined) {
    if (typeof args.body === 'string') {
      body = args.body;
    } else {
      body = JSON.stringify(args.body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
  }

  try {
    const res = await fetch(new URL(args.path, base.baseUrl).toString(), {
      method: args.method ?? 'GET',
      headers,
      body,
    });
    const payload = await readJson(res);
    if (!res.ok) {
      return internalResponse(
        'coreui.errors.auth.contextUnavailable',
        `sanfrancisco_http_${res.status}${payload != null ? `:${JSON.stringify(payload)}` : ''}`,
      );
    }
    return { ok: true, payload };
  } catch (error) {
    return internalResponse('coreui.errors.auth.contextUnavailable', errorDetail(error));
  }
}

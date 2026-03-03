import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../env/paris';
import { resolveSessionCookieDomain, resolveSessionBearer, type SessionCookieSpec } from '../../auth/session';

export const PARIS_PROXY_READ_TIMEOUT_MS = 5_000;
export const PARIS_PROXY_WRITE_TIMEOUT_MS = 20_000;

export function resolveParisBaseOrResponse(corsHeaders: HeadersInit) {
  try {
    return { ok: true as const, baseUrl: resolveParisBaseUrl() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500, headers: corsHeaders }),
    };
  }
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = PARIS_PROXY_READ_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveParisSession(request: NextRequest): Promise<
  | { ok: true; accessToken: string; setCookies?: SessionCookieSpec[] }
  | { ok: false; response: NextResponse }
> {
  const stage = (process.env.ENV_STAGE ?? '').trim().toLowerCase();
  if (stage === 'local') {
    const token = String(process.env.PARIS_DEV_JWT || '').trim();
    if (!token) {
      return {
        ok: false as const,
        response: NextResponse.json(
          {
            error: {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.misconfigured',
              detail: 'Missing PARIS_DEV_JWT for local tool-trusted Bob -> Paris calls.',
            },
          },
          { status: 500 },
        ),
      };
    }

    return { ok: true as const, accessToken: token };
  }

  const resolved = await resolveSessionBearer(request);
  if (!resolved.ok) return resolved;
  return { ok: true as const, accessToken: resolved.accessToken, setCookies: resolved.setCookies };
}

export function withParisDevAuthorization(headers: Headers, accessToken: string): Headers {
  // Keep legacy helper name to avoid broad route churn; auth bearer comes from Berlin session resolution.
  headers.set('authorization', `Bearer ${accessToken}`);
  if ((process.env.ENV_STAGE ?? '').trim().toLowerCase() === 'local') {
    headers.set('x-ck-internal-service', 'bob.local');
  }
  return headers;
}

export function applySessionCookies(
  response: NextResponse,
  request: NextRequest,
  setCookies?: SessionCookieSpec[],
) {
  if (!setCookies?.length) return response;
  const secure = request.nextUrl.protocol === 'https:';
  const domain = resolveSessionCookieDomain(request);
  for (const cookie of setCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: cookie.maxAge,
      ...(domain ? { domain } : {}),
    });
  }
  return response;
}

export function proxyErrorResponse(error: unknown, corsHeaders: HeadersInit) {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
  return NextResponse.json({ error: 'PARIS_PROXY_ERROR', message }, { status, headers: corsHeaders });
}

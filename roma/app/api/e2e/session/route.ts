import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../lib/env/berlin';
import {
  applySessionCookies,
  readSessionMaxAge,
  resolveAccountAuthzCookieName,
  resolveSessionCookieNames,
} from '../../../../lib/auth/session';

export const runtime = 'edge';

const E2E_AUTH_HEADER = 'x-ck-e2e-auth';
const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

type BerlinE2ESessionPayload = {
  ok?: unknown;
  accessToken?: unknown;
  refreshToken?: unknown;
  accessTokenMaxAge?: unknown;
  refreshTokenMaxAge?: unknown;
  error?: unknown;
};

type BootstrapPayload = {
  activeAccount?: {
    accountId?: unknown;
  };
  authz?: {
    accountCapsule?: unknown;
  };
  error?: unknown;
};

function isEnabled(): boolean {
  return process.env.E2E_AUTH_ENABLED === 'true' && Boolean(process.env.E2E_AUTH_SECRET?.trim());
}

function isProductionStage(): boolean {
  const stage = String(process.env.ENV_STAGE || '').trim().toLowerCase();
  return stage === 'prod' || stage === 'production';
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function extractReasonKey(payload: Record<string, unknown> | null, fallback: string): string {
  const reason =
    payload && typeof payload.error === 'object' && payload.error
      ? (payload.error as Record<string, unknown>).reasonKey
      : payload?.error;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : fallback;
}

function resolveAccountId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function readSecret(request: NextRequest, body: Record<string, unknown> | null): string | null {
  const headerSecret = request.headers.get(E2E_AUTH_HEADER)?.trim();
  if (headerSecret) return headerSecret;
  const bodySecret = typeof body?.secret === 'string' ? body.secret.trim() : '';
  return bodySecret || null;
}

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  const payload = (await request.json().catch(() => null)) as unknown;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

async function fetchBootstrap(
  berlinBase: string,
  accessToken: string,
): Promise<
  | {
      ok: true;
      accountId: string | null;
      accountCapsule: string | null;
    }
  | { ok: false; reasonKey: string; status: number }
> {
  const response = await fetch(`${berlinBase}/v1/session/bootstrap`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as BootstrapPayload | null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      reasonKey: extractReasonKey(payload as Record<string, unknown> | null, 'coreui.errors.auth.required'),
    };
  }

  return {
    ok: true,
    accountId: resolveAccountId(payload?.activeAccount?.accountId),
    accountCapsule:
      typeof payload?.authz?.accountCapsule === 'string' && payload.authz.accountCapsule.trim()
        ? payload.authz.accountCapsule.trim()
        : null,
  };
}

function json(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, { status, headers: CACHE_HEADERS });
}

export async function POST(request: NextRequest) {
  if (!isEnabled() || isProductionStage()) {
    return json({ error: 'NOT_FOUND' }, 404);
  }

  const body = await readBody(request);
  const email = normalizeEmail(body?.email);
  const secret = readSecret(request, body);
  if (!email) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.auth.login_failed', detail: 'e2e_email_invalid' } }, 422);
  }
  if (!secret) {
    return json({ error: { kind: 'AUTH', reasonKey: 'coreui.errors.auth.required', detail: 'e2e_secret_missing' } }, 401);
  }
  if (secret !== process.env.E2E_AUTH_SECRET) {
    return json({ error: { kind: 'AUTH', reasonKey: 'coreui.errors.auth.required', detail: 'e2e_secret_invalid' } }, 401);
  }

  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return json({ error: { kind: 'INTERNAL', reasonKey: 'roma.errors.auth.config_missing' } }, 503);
  }

  const upstream = await fetch(`${berlinBase}/internal/e2e/session`, {
    method: 'POST',
    headers: {
      [E2E_AUTH_HEADER]: secret,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  });

  const payload = (await upstream.json().catch(() => null)) as BerlinE2ESessionPayload | Record<string, unknown> | null;
  if (!upstream.ok || !payload) {
    return json(
      {
        error: {
          kind: upstream.status === 401 ? 'AUTH' : upstream.status === 403 ? 'DENY' : 'UPSTREAM_UNAVAILABLE',
          reasonKey: extractReasonKey(payload as Record<string, unknown> | null, 'coreui.errors.auth.login_failed'),
        },
      },
      upstream.status || 502,
    );
  }

  const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!accessToken || !refreshToken) {
    return json({ error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.login_failed' } }, 502);
  }

  const bootstrap = await fetchBootstrap(berlinBase, accessToken);
  if (!bootstrap.ok) {
    return json({ error: { kind: 'AUTH', reasonKey: bootstrap.reasonKey } }, bootstrap.status);
  }
  if (!bootstrap.accountId || !bootstrap.accountCapsule) {
    return json({ error: { kind: 'AUTH', reasonKey: 'coreui.errors.auth.contextUnavailable' } }, 401);
  }

  const cookieNames = resolveSessionCookieNames();
  const accessTokenMaxAge = readSessionMaxAge(payload.accessTokenMaxAge);
  const refreshTokenMaxAge = readSessionMaxAge(payload.refreshTokenMaxAge);
  if (!accessTokenMaxAge || !refreshTokenMaxAge) {
    return json({ error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.login_failed' } }, 502);
  }

  const response = json({
    ok: true,
    accountId: bootstrap.accountId,
  });

  applySessionCookies(response, request, [
    { name: cookieNames.access, value: accessToken, maxAge: accessTokenMaxAge },
    { name: cookieNames.refresh, value: refreshToken, maxAge: refreshTokenMaxAge },
    {
      name: resolveAccountAuthzCookieName(),
      value: bootstrap.accountCapsule,
    },
  ]);

  return response;
}

import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../lib/env/berlin';
import {
  applySessionCookies,
  resolveRequestOrigin,
  resolveSessionCookieNames,
} from '../../../../lib/auth/session';

export const runtime = 'edge';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

type LoginIntent = 'signin' | 'signup_prague';

type BerlinFinishPayload = {
  accessToken?: unknown;
  refreshToken?: unknown;
  accessTokenMaxAge?: unknown;
  refreshTokenMaxAge?: unknown;
  continuation?: unknown;
  error?: unknown;
};

type BootstrapPayload = {
  defaults?: {
    accountId?: unknown;
  };
  authz?: {
    accountCapsule?: unknown;
  };
  error?: unknown;
};

function resolveNextPath(value: string | null): string {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/')) return '/home';
  if (normalized.startsWith('//')) return '/home';
  return normalized;
}

function resolveLoginUrl(request: NextRequest, params: Record<string, string>): URL {
  const url = new URL('/login', resolveRequestOrigin(request));
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function extractReasonKey(payload: Record<string, unknown> | null, fallback: string): string {
  const reason =
    payload && typeof payload.error === 'object' && payload.error
      ? (payload.error as Record<string, unknown>).reasonKey
      : payload?.error;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : fallback;
}

function normalizeIntent(value: unknown): LoginIntent {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'signup_prague') return 'signup_prague';
  return 'signin';
}

function extractContinuation(payload: BerlinFinishPayload | null): { intent: LoginIntent; next: string } {
  if (!payload || !payload.continuation || typeof payload.continuation !== 'object') {
    return { intent: 'signin', next: '/home' };
  }
  const continuation = payload.continuation as Record<string, unknown>;
  const nextRaw = typeof continuation.next === 'string' ? continuation.next : null;
  return {
    intent: normalizeIntent(continuation.intent),
    next: resolveNextPath(nextRaw),
  };
}

function resolveAccountId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
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
  | { ok: false; reasonKey: string }
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
      reasonKey: extractReasonKey(payload as Record<string, unknown> | null, 'coreui.errors.auth.required'),
    };
  }

  return {
    ok: true,
    accountId: resolveAccountId(payload?.defaults?.accountId),
    accountCapsule:
      typeof payload?.authz?.accountCapsule === 'string' && payload.authz.accountCapsule.trim()
        ? payload.authz.accountCapsule.trim()
        : null,
  };
}

function buildRecoveryUrl(request: NextRequest, reasonKey: string): URL {
  const recovery = new URL('/home', resolveRequestOrigin(request));
  recovery.searchParams.set('authRecovery', '1');
  recovery.searchParams.set('error', reasonKey);
  return recovery;
}

function applyFinishSessionCookies(args: {
  response: NextResponse;
  request: NextRequest;
  accessToken: string;
  refreshToken: string;
  accessMaxAge: number;
  refreshMaxAge: number;
}): void {
  const cookieNames = resolveSessionCookieNames();
  applySessionCookies(args.response, args.request, [
    { name: cookieNames.access, value: args.accessToken, maxAge: args.accessMaxAge },
    { name: cookieNames.refresh, value: args.refreshToken, maxAge: args.refreshMaxAge },
  ]);
}

export async function GET(request: NextRequest) {
  const finishId = String(request.nextUrl.searchParams.get('finishId') || '').trim();
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(finishId)) {
    return NextResponse.redirect(resolveLoginUrl(request, { error: 'coreui.errors.auth.finish.invalidOrExpired' }), {
      headers: CACHE_HEADERS,
    });
  }

  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return NextResponse.redirect(resolveLoginUrl(request, { error: 'roma.errors.auth.config_missing' }), {
      headers: CACHE_HEADERS,
    });
  }

  const upstream = await fetch(`${berlinBase}/auth/finish`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ finishId }),
  });

  const payload = (await upstream.json().catch(() => null)) as BerlinFinishPayload | Record<string, unknown> | null;
  if (!upstream.ok || !payload) {
    const reasonKey = extractReasonKey(payload as Record<string, unknown> | null, 'coreui.errors.auth.finish.invalidOrExpired');
    return NextResponse.redirect(resolveLoginUrl(request, { error: reasonKey }), {
      headers: CACHE_HEADERS,
    });
  }

  const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(resolveLoginUrl(request, { error: 'coreui.errors.auth.login_failed' }), {
      headers: CACHE_HEADERS,
    });
  }

  const accessMaxAge = parsePositiveInt(payload.accessTokenMaxAge, 15 * 60);
  const refreshMaxAge = parsePositiveInt(payload.refreshTokenMaxAge, 60 * 60 * 24 * 30);

  const continuation = extractContinuation(payload as BerlinFinishPayload);
  const applySession = (response: NextResponse): NextResponse => {
    applyFinishSessionCookies({
      response,
      request,
      accessToken,
      refreshToken,
      accessMaxAge,
      refreshMaxAge,
    });
    return response;
  };

  const bootstrap = await fetchBootstrap(berlinBase, accessToken);
  if (!bootstrap.ok) {
    return applySession(
      NextResponse.redirect(buildRecoveryUrl(request, bootstrap.reasonKey), {
        headers: CACHE_HEADERS,
      }),
    );
  }

  if (!bootstrap.accountId) {
    return applySession(
      NextResponse.redirect(buildRecoveryUrl(request, 'coreui.errors.account.createFailed'), {
        headers: CACHE_HEADERS,
      }),
    );
  }

  if (!bootstrap.accountCapsule) {
    return applySession(
      NextResponse.redirect(buildRecoveryUrl(request, 'coreui.errors.auth.contextUnavailable'), {
        headers: CACHE_HEADERS,
      }),
    );
  }

  const destination = new URL(continuation.next, resolveRequestOrigin(request));
  const response = NextResponse.redirect(destination, { headers: CACHE_HEADERS });
  return applySession(response);
}

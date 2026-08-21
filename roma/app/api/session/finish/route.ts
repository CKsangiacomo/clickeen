import { NextRequest, NextResponse } from 'next/server';
import { createInitialAccountWidgetDefaultsInTokyo } from '../../../../lib/account-widget-defaults-direct';
import { materializeInitialAccountWidgetDefaults } from '../../../../lib/account-widget-defaults-materialization';
import { listTokyoWidgetDefinitions } from '../../../../lib/account-instance-direct';
import { resolveBerlinBaseUrl } from '../../../../lib/env/berlin';
import {
  applySessionCookies,
  resolveAccountAuthzCookieName,
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
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
  createdAccount: boolean;
  continuation: {
    intent: LoginIntent;
    next: string;
  };
};

type BootstrapPayload = {
  activeAccount: {
    accountId: string;
  };
  authz: {
    accountCapsule: string;
  };
};

function resolveLoginUrl(request: NextRequest, params: Record<string, string>): URL {
  const url = new URL('/login', resolveRequestOrigin(request));
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function extractReasonKey(payload: Record<string, unknown> | null, fallback: string): string {
  const reason =
    payload && typeof payload.error === 'object' && payload.error
      ? (payload.error as Record<string, unknown>).reasonKey
      : payload?.error;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : fallback;
}

async function fetchBootstrap(
  berlinBase: string,
  accessToken: string,
): Promise<
  | {
      ok: true;
      accountId: string;
      accountCapsule: string;
    }
  | { ok: false; reasonKey: string }
> {
  const response = await fetch(`${berlinBase}/session/bootstrap`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as BootstrapPayload | Record<string, unknown> | null;
  if (!response.ok) {
    return {
      ok: false,
      reasonKey: extractReasonKey(payload as Record<string, unknown> | null, 'coreui.errors.auth.required'),
    };
  }

  return {
    ok: true,
    accountId: (payload as BootstrapPayload).activeAccount.accountId,
    accountCapsule: (payload as BootstrapPayload).authz.accountCapsule,
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

  const finish = payload as BerlinFinishPayload;
  const {
    accessToken,
    refreshToken,
    accessTokenMaxAge: accessMaxAge,
    refreshTokenMaxAge: refreshMaxAge,
    createdAccount,
    continuation,
  } = finish;
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

  const accountCapsule = bootstrap.accountCapsule;
  const applySessionWithAccount = (response: NextResponse): NextResponse => {
    applySession(response);
    applySessionCookies(response, request, [
      {
        name: resolveAccountAuthzCookieName(),
        value: accountCapsule,
      },
    ]);
    return response;
  };

  if (createdAccount) {
    const widgetDefinitions = await listTokyoWidgetDefinitions({
      accountId: bootstrap.accountId,
      accountCapsule,
    });
    if (!widgetDefinitions.ok) {
      return applySessionWithAccount(
        NextResponse.redirect(buildRecoveryUrl(request, widgetDefinitions.error.reasonKey), {
          headers: CACHE_HEADERS,
        }),
      );
    }
    const widgetDefaults = await materializeInitialAccountWidgetDefaults({
      accountId: bootstrap.accountId,
      widgetTypes: widgetDefinitions.value.widgetDefinitions.map((entry) => entry.widgetType),
    });
    const initialized = await createInitialAccountWidgetDefaultsInTokyo({
      accountId: bootstrap.accountId,
      accountCapsule,
      widgetDefaults: widgetDefaults.widgetDefaults,
    });
    if (!initialized.ok) {
      return applySessionWithAccount(
        NextResponse.redirect(buildRecoveryUrl(request, initialized.error.reasonKey), {
          headers: CACHE_HEADERS,
        }),
      );
    }
  }

  const destination = new URL(continuation.next, resolveRequestOrigin(request));
  const response = NextResponse.redirect(destination, { headers: CACHE_HEADERS });
  return applySessionWithAccount(response);
}

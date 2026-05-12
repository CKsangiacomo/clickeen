import {
  resolveCachedJwksVerifyKey,
  verifyRomaAccountAuthzCapsule,
  type MemberRole,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import type { NextRequest } from 'next/server';
import {
  resolveAccountAuthzCookieName,
  resolveJwtCookieMaxAge,
  type SessionCookieSpec,
} from './auth/session';
import { resolveBerlinBaseUrl } from './env/berlin';

export type AccountCapsuleAuthzError = {
  kind: 'AUTH' | 'DENY' | 'INTERNAL';
  reasonKey: string;
  detail?: string;
};

export type AccountCapsuleAuthzResult =
  | {
      ok: true;
      token: string;
      payload: RomaAccountAuthzCapsulePayload;
    }
  | {
      ok: false;
      status: number;
      error: AccountCapsuleAuthzError;
    };

const BERLIN_ACCOUNT_CAPSULE_JWKS_CACHE_KEY = '__CK_ROMA_ACCOUNT_CAPSULE_JWKS_V1__';
const ACCOUNT_AUTHZ_CAPSULE_FALLBACK_MAX_AGE_SECONDS = 30 * 60;

function roleRank(value: MemberRole): number {
  switch (value) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'editor':
      return 2;
    case 'viewer':
      return 1;
  }
}

function resolveBerlinJwksUrl(): string {
  return `${resolveBerlinBaseUrl()}/.well-known/jwks.json`;
}

async function resolveBerlinAccountCapsuleVerifyKey(kid: string): Promise<CryptoKey | null> {
  return resolveCachedJwksVerifyKey({
    cacheKey: BERLIN_ACCOUNT_CAPSULE_JWKS_CACHE_KEY,
    jwksUrl: resolveBerlinJwksUrl(),
    kid,
  });
}

async function verifyAccountCapsuleToken(token: string): Promise<
  | { ok: true; token: string; payload: RomaAccountAuthzCapsulePayload }
  | { ok: false; status: number; error: AccountCapsuleAuthzError }
> {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'authz_capsule_required',
      },
    };
  }

  try {
    resolveBerlinJwksUrl();
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.misconfigured',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const verified = await verifyRomaAccountAuthzCapsule({
    token: normalizedToken,
    resolveVerifyKey: resolveBerlinAccountCapsuleVerifyKey,
  });
  if (!verified.ok) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: verified.reason,
      },
    };
  }

  return { ok: true, token: normalizedToken, payload: verified.payload };
}

function buildAuthzCookie(token: string): SessionCookieSpec {
  return {
    name: resolveAccountAuthzCookieName(),
    value: token,
    maxAge: resolveJwtCookieMaxAge(token, ACCOUNT_AUTHZ_CAPSULE_FALLBACK_MAX_AGE_SECONDS),
  };
}

function hardAuthRequired(): AccountCapsuleAuthzResult {
  return {
    ok: false,
    status: 401,
    error: {
      kind: 'AUTH',
      reasonKey: 'coreui.errors.auth.required',
      detail: 'account_authz_unavailable',
    },
  };
}

async function fetchBootstrapAccountCapsule(accessToken: string): Promise<string | null> {
  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  } catch {
    return null;
  }

  const response = await fetch(`${berlinBase}/v1/session/bootstrap`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as
    | { authz?: { accountCapsule?: unknown } }
    | null;
  if (!response.ok || !payload) return null;
  const accountCapsule =
    typeof payload.authz?.accountCapsule === 'string' ? payload.authz.accountCapsule.trim() : '';
  return accountCapsule || null;
}

export async function resolveServerAccountAuthz(args: {
  request: NextRequest;
  accessToken: string;
  minRole: MemberRole;
}): Promise<
  | {
      ok: true;
      token: string;
      payload: RomaAccountAuthzCapsulePayload;
      setCookies?: SessionCookieSpec[];
    }
  | {
      ok: false;
      status: number;
      error: AccountCapsuleAuthzError;
    }
> {
  const cookieToken = args.request.cookies.get(resolveAccountAuthzCookieName())?.value?.trim() || '';
  const verifiedCookie = cookieToken ? await verifyAccountCapsuleToken(cookieToken) : null;

  if (verifiedCookie?.ok) {
    if (roleRank(verifiedCookie.payload.role) < roleRank(args.minRole)) {
      return {
        ok: false,
        status: 403,
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'role_insufficient',
        },
      };
    }
    return {
      ok: true,
      token: verifiedCookie.token,
      payload: verifiedCookie.payload,
    };
  }

  const refreshedToken = await fetchBootstrapAccountCapsule(args.accessToken);
  if (!refreshedToken) return hardAuthRequired();

  const refreshed = await verifyAccountCapsuleToken(refreshedToken);
  if (!refreshed.ok) return hardAuthRequired();
  if (roleRank(refreshed.payload.role) < roleRank(args.minRole)) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'role_insufficient',
      },
    };
  }

  return {
    ok: true,
    token: refreshed.token,
    payload: refreshed.payload,
    setCookies: [buildAuthzCookie(refreshed.token)],
  };
}

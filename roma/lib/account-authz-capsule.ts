import {
  readRomaAuthzCapsuleHeader,
  resolveCachedJwksVerifyKey,
  verifyRomaAccountAuthzCapsule,
  type MemberRole,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
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

export async function authorizeAccountRoleFromCapsuleToken(args: {
  token: string;
  accountId: string;
  minRole: MemberRole;
}): Promise<AccountCapsuleAuthzResult> {
  const verified = await verifyAccountCapsuleToken(args.token);
  if (!verified.ok) return verified;

  if (verified.payload.accountId !== args.accountId) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'account_mismatch',
      },
    };
  }

  if (roleRank(verified.payload.role) < roleRank(args.minRole)) {
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

  return verified;
}

export async function authorizeRequestRoleFromCapsule(args: {
  request: Request;
  minRole: MemberRole;
}): Promise<AccountCapsuleAuthzResult> {
  const verified = await verifyAccountCapsuleToken(readRomaAuthzCapsuleHeader(args.request) || '');
  if (!verified.ok) return verified;

  if (roleRank(verified.payload.role) < roleRank(args.minRole)) {
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

  return verified;
}

export async function authorizeRequestAccountRoleFromCapsule(args: {
  request: Request;
  accountId: string;
  minRole: MemberRole;
}): Promise<AccountCapsuleAuthzResult> {
  return authorizeAccountRoleFromCapsuleToken({
    token: readRomaAuthzCapsuleHeader(args.request) || '',
    accountId: args.accountId,
    minRole: args.minRole,
  });
}

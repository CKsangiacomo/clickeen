import {
  readRomaAuthzCapsuleHeader,
  verifyRomaAccountAuthzCapsule,
  type MemberRole,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';

export type AccountCapsuleAuthzError = {
  kind: 'AUTH' | 'DENY' | 'INTERNAL';
  reasonKey: string;
  detail?: string;
};

export type AccountCapsuleAuthzResult =
  | {
      ok: true;
      payload: RomaAccountAuthzCapsulePayload;
    }
  | {
      ok: false;
      status: number;
      error: AccountCapsuleAuthzError;
    };

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

function resolveRomaAuthzCapsuleSecret(): string {
  const explicit = String(process.env.ROMA_AUTHZ_CAPSULE_SECRET || '').trim();
  if (explicit) return explicit;
  const aiFallback = String(process.env.AI_GRANT_HMAC_SECRET || '').trim();
  if (aiFallback) return aiFallback;
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export async function authorizeRequestAccountRoleFromCapsule(args: {
  request: Request;
  accountId: string;
  minRole: MemberRole;
  allowBypass?: () => boolean;
}): Promise<AccountCapsuleAuthzResult> {
  if (args.allowBypass?.()) {
    return {
      ok: true,
      payload: {
        v: 1,
        typ: 'roma.account',
        iss: 'paris',
        aud: 'roma',
        sub: 'local-dev-bypass',
        userId: 'local-dev-bypass',
        accountId: args.accountId,
        accountStatus: 'active',
        accountName: 'Local Dev',
        accountSlug: 'local-dev',
        accountWebsiteUrl: null,
        profile: 'tier3',
        role: 'owner',
        authzVersion: 'local-dev-bypass',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
      },
    };
  }

  const token = readRomaAuthzCapsuleHeader(args.request);
  if (!token) {
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

  const secret = resolveRomaAuthzCapsuleSecret();
  if (!secret) {
    return {
      ok: false,
      status: 500,
      error: {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.misconfigured',
        detail: 'roma_authz_capsule_secret_missing',
      },
    };
  }

  const verified = await verifyRomaAccountAuthzCapsule(secret, token);
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

  return { ok: true, payload: verified.payload };
}

import { mintRomaAccountAuthzCapsule, resolvePolicy } from '@clickeen/ck-policy';
import type { BerlinBootstrapPayload } from './types';
import { enc, toBase64Url } from '../crypto/encoding';
import { internalError } from '../http';
import { resolveSigningContext } from '../crypto/jwt';
import { type Env, type SessionState } from '../types';
import { type PrincipalAccountState } from './state';

const ROMA_AUTHZ_CAPSULE_TTL_SEC = 15 * 60;

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

async function resolveAuthzVersion(args: {
  state: PrincipalAccountState;
  activeAccount: PrincipalAccountState['defaultAccount'];
  signingKid: string;
  signedEntitlements: {
    flags: Record<string, boolean>;
    limits: Record<string, number | null>;
  };
}): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(
      stableJson({
        userId: args.state.user.id,
        accountId: args.activeAccount?.accountId,
        accountPublicId: args.activeAccount?.accountPublicId,
        accountStatus: args.activeAccount?.status,
        accountWebsiteUrl: args.activeAccount?.websiteUrl,
        role: args.activeAccount?.role,
        profile: args.activeAccount?.tier,
        entitlements: args.signedEntitlements,
        signingKid: args.signingKid,
      }),
    ),
  );
  return `authz:v2:${toBase64Url(new Uint8Array(digest))}`;
}

export async function buildBootstrapPayload(args: {
  env: Env;
  state: PrincipalAccountState;
  session: SessionState;
}): Promise<Result<BerlinBootstrapPayload>> {
  const activeAccount = args.state.defaultAccount;
  if (!activeAccount) {
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', 'default_account_missing_for_bootstrap'),
    };
  }

  try {
    const signingContextPromise = resolveSigningContext(args.env);

    const policy = resolvePolicy({ profile: activeAccount.tier, role: activeAccount.role });
    const signedEntitlements = {
      flags: policy.flags,
      limits: policy.limits,
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresSec = nowSec + ROMA_AUTHZ_CAPSULE_TTL_SEC;
    const signingContext = await signingContextPromise;
    const authzVersion = await resolveAuthzVersion({
      state: args.state,
      activeAccount,
      signingKid: signingContext.kid,
      signedEntitlements,
    });

    const capsule = await mintRomaAccountAuthzCapsule(
      {
        kid: signingContext.kid,
        privateKey: signingContext.privateKey,
      },
      {
        sub: args.state.user.id,
        userId: args.state.user.id,
        accountId: activeAccount.accountId,
        accountPublicId: activeAccount.accountPublicId,
        accountStatus: activeAccount.status,
        accountWebsiteUrl: activeAccount.websiteUrl,
        entitlements: signedEntitlements,
        role: activeAccount.role,
        profile: activeAccount.tier,
        authzVersion,
        iat: nowSec,
        exp: expiresSec,
      },
    );

    return {
      ok: true,
      value: {
        user: args.state.user,
        profile: args.state.profile,
        activeAccount,
        accounts: args.state.accounts,
        authz: {
          accountCapsule: capsule.token,
          accountId: activeAccount.accountId,
          accountPublicId: activeAccount.accountPublicId,
          role: activeAccount.role,
          profile: activeAccount.tier,
          authzVersion,
          issuedAt: new Date(nowSec * 1000).toISOString(),
          expiresAt: new Date(expiresSec * 1000).toISOString(),
          entitlements: signedEntitlements,
        },
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: internalError('coreui.errors.auth.contextUnavailable', detail),
    };
  }
}

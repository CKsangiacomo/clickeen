import type { MemberRole } from '@clickeen/ck-policy';
import type { AccountRow, Env } from './types';
import { assertDevAuth } from './auth';
import { readRomaAuthzCapsuleHeader, verifyRomaAccountAuthzCapsule, type RomaAccountAuthzCapsulePayload } from './authz-capsule';
import { ckError } from './errors';
import { roleRank } from './roles';

type AccountAuthResult =
  | {
      ok: true;
      account: AccountRow;
      role: MemberRole;
    }
  | {
      ok: false;
      response: Response;
    };

function hydrateAccountFromCapsule(payload: RomaAccountAuthzCapsulePayload): AccountRow {
  return {
    id: payload.accountId,
    status: payload.accountStatus,
    is_platform: payload.accountIsPlatform,
    tier: payload.profile === 'minibob' ? 'free' : payload.profile,
    name: payload.accountName,
    slug: payload.accountSlug,
    website_url: payload.accountWebsiteUrl ?? null,
    l10n_locales: payload.accountL10nLocales,
    l10n_policy: payload.accountL10nPolicy,
  };
}

export async function authorizeAccount(
  req: Request,
  env: Env,
  accountId: string,
  minRole: MemberRole,
): Promise<AccountAuthResult> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return { ok: false, response: auth.response };

  const capsule = readRomaAuthzCapsuleHeader(req);
  if (capsule) {
    let verified;
    try {
      verified = await verifyRomaAccountAuthzCapsule(env, capsule);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail }, 500),
      };
    }
    if (!verified.ok) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    const payload = verified.payload;
    if ((auth.principal && payload.userId !== auth.principal.userId) || payload.accountId !== accountId) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    if (roleRank(payload.role) < roleRank(minRole)) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    return {
      ok: true,
      account: hydrateAccountFromCapsule(payload),
      role: payload.role,
    };
  }
  return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
}

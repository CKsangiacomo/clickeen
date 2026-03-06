import type { MemberRole } from '@clickeen/ck-policy';
import type { AccountRow, Env } from './types';
import { assertDevAuth } from './auth';
import { readRomaAuthzCapsuleHeader, verifyRomaAccountAuthzCapsule, type RomaAccountAuthzCapsulePayload } from './authz-capsule';
import { ckError, errorDetail } from './errors';
import { readJson } from './http';
import { normalizeMemberRole, roleRank } from './roles';
import { supabaseFetch } from './supabase';
import { requireAccount } from './accounts';
import { resolveAdminAccountId } from './admin';

type AccountMembershipRow = {
  role: string;
};

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

// Membership lookups are direct and uncached to keep authz behavior deterministic.

async function resolveAccountMembershipRole(env: Env, accountId: string, userId: string): Promise<MemberRole | null> {
  const params = new URLSearchParams({
    select: 'role',
    user_id: `eq.${userId}`,
    account_id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_members?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to resolve account membership (${res.status}): ${JSON.stringify(details)}`);
  }

  const rows = (await res.json().catch(() => null)) as AccountMembershipRow[] | null;
  return normalizeMemberRole(rows?.[0]?.role);
}

function hydrateAccountFromCapsule(payload: RomaAccountAuthzCapsulePayload): AccountRow {
  return {
    id: payload.accountId,
    status: payload.accountStatus,
    is_platform: null,
    tier: payload.profile,
    name: payload.accountName,
    slug: payload.accountSlug,
    website_url: payload.accountWebsiteUrl ?? null,
    l10n_locales: payload.accountL10nLocales,
    l10n_policy: payload.accountL10nPolicy,
  };
}

export async function authorizeAccount(req: Request, env: Env, accountId: string, minRole: MemberRole): Promise<AccountAuthResult> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return { ok: false, response: auth.response };

  if (!auth.principal) {
    if (auth.source === 'dev') {
      const adminAccountId = resolveAdminAccountId(env);
      if (accountId === adminAccountId && roleRank('owner') >= roleRank(minRole)) {
        const accountResult = await requireAccount(env, accountId);
        if (!accountResult.ok) return { ok: false, response: accountResult.response };
        return { ok: true, account: accountResult.account, role: 'owner' };
      }
    }
    return { ok: false, response: ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.auth.required' }, 401) };
  }

  const capsule = readRomaAuthzCapsuleHeader(req);
  if (capsule) {
    const verified = await verifyRomaAccountAuthzCapsule(env, capsule);
    if (!verified.ok) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    const payload = verified.payload;
    if (payload.userId !== auth.principal.userId || payload.accountId !== accountId) {
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

  const accountResult = await requireAccount(env, accountId);
  if (!accountResult.ok) return { ok: false, response: accountResult.response };

  let role: MemberRole | null = null;
  try {
    role = await resolveAccountMembershipRole(env, accountId, auth.principal.userId);
  } catch (error) {
    const detail = errorDetail(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500) };
  }

  if (!role || roleRank(role) < roleRank(minRole)) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
  }

  return { ok: true, account: accountResult.account, role };
}

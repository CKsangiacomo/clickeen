import type { SupabaseAuthPrincipal } from '../../shared/auth';
import { assertDevAuth } from '../../shared/auth';
import { normalizeAccountTier } from '../../shared/authz-capsule';
import { errorDetail } from '../../shared/errors';
import type { AccountTier, Env } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { roleRank } from '../../shared/roles';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString } from '../../shared/validation';
import { resolveAdminAccountId } from '../../shared/admin';

type AccountMembershipRow = {
  account_id: string;
  role: string;
  created_at?: string | null;
  accounts: {
    id: string;
    status: string;
    is_platform?: boolean | null;
    tier: AccountTier;
    name: string;
    slug: string;
    website_url?: string | null;
    l10n_locales?: unknown;
    l10n_policy?: unknown;
    tier_changed_at?: string | null;
    tier_changed_from?: string | null;
    tier_changed_to?: string | null;
    tier_drop_dismissed_at?: string | null;
    tier_drop_email_sent_at?: string | null;
  } | null;
};

type IdentityLifecycleNoticeState = {
  tierChangedAt: string | null;
  tierChangedFrom: AccountTier | null;
  tierChangedTo: AccountTier | null;
  tierDropDismissedAt: string | null;
  tierDropEmailSentAt: string | null;
};

export type IdentityAccountContext = {
  accountId: string;
  role: string;
  name: string;
  slug: string;
  tier: AccountTier;
  websiteUrl: string | null;
  membershipVersion: string | null;
  lifecycleNotice: IdentityLifecycleNoticeState;
};

export type IdentityMePayload = {
  user: {
    id: string;
    email: string | null;
    role: string | null;
  };
  accounts: IdentityAccountContext[];
  defaults: {
    accountId: string | null;
  };
};

type IdentityMeResolution =
  | { ok: true; principal: SupabaseAuthPrincipal; payload: IdentityMePayload }
  | { ok: false; response: Response };

function resolveMembershipVersion(row: AccountMembershipRow): string | null {
  const created = asTrimmedString(row.created_at);
  return created || null;
}

function selectDefaultAccount(
  accounts: IdentityAccountContext[],
  env: Env,
): IdentityAccountContext | null {
  if (accounts.length === 0) return null;

  const adminAccountId = resolveAdminAccountId(env);
  const admin = accounts.find((entry) => entry.accountId === adminAccountId) ?? null;
  if (admin) return admin;

  let best: IdentityAccountContext | null = null;
  for (const candidate of accounts) {
    if (!best) {
      best = candidate;
      continue;
    }
    const candidateRank = roleRank(candidate.role);
    const bestRank = roleRank(best.role);
    if (candidateRank > bestRank) best = candidate;
  }
  return best ?? accounts[0] ?? null;
}

async function loadAccountsForUser(env: Env, userId: string): Promise<AccountMembershipRow[]> {
  const params = new URLSearchParams({
    select:
      'account_id,role,created_at,accounts(id,status,is_platform,tier,name,slug,website_url,l10n_locales,l10n_policy,tier_changed_at,tier_changed_from,tier_changed_to,tier_drop_dismissed_at,tier_drop_email_sent_at)',
    user_id: `eq.${userId}`,
    order: 'created_at.asc',
    limit: '1000',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_members?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`ACCOUNT_MEMBERSHIP_LOOKUP_FAILED: ${JSON.stringify(details)}`);
  }
  return ((await res.json().catch(() => [])) as AccountMembershipRow[]) ?? [];
}

function normalizeAccountContexts(rows: AccountMembershipRow[]): IdentityAccountContext[] {
  const out: IdentityAccountContext[] = [];
  for (const row of rows) {
    const account = row.accounts;
    if (!account) continue;
    const accountId = asTrimmedString(row.account_id);
    if (!accountId) continue;
    out.push({
      accountId,
      role: asTrimmedString(row.role) ?? 'viewer',
      name: asTrimmedString(account.name) ?? 'Account',
      slug: asTrimmedString(account.slug) ?? 'account',
      tier: account.tier,
      websiteUrl: asTrimmedString(account.website_url) || null,
      membershipVersion: resolveMembershipVersion(row),
      lifecycleNotice: {
        tierChangedAt: asTrimmedString(account.tier_changed_at) || null,
        tierChangedFrom: normalizeAccountTier(account.tier_changed_from),
        tierChangedTo: normalizeAccountTier(account.tier_changed_to),
        tierDropDismissedAt: asTrimmedString(account.tier_drop_dismissed_at) || null,
        tierDropEmailSentAt: asTrimmedString(account.tier_drop_email_sent_at) || null,
      },
    });
  }
  return out;
}

export async function resolveIdentityMePayload(req: Request, env: Env): Promise<IdentityMeResolution> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return { ok: false, response: auth.response };

  const principal = auth.principal;
  if (!principal) {
    return { ok: false, response: json({ error: 'AUTH_REQUIRED' }, { status: 401 }) };
  }

  let membershipRows: AccountMembershipRow[] = [];
  try {
    membershipRows = await loadAccountsForUser(env, principal.userId);
  } catch (error) {
    const detail = errorDetail(error);
    return { ok: false, response: json({ error: 'ACCOUNT_MEMBERSHIP_LOOKUP_FAILED', detail }, { status: 502 }) };
  }

  const accounts = normalizeAccountContexts(membershipRows);
  const resolvedAccount = selectDefaultAccount(accounts, env);

  return {
    ok: true,
    principal,
    payload: {
      user: { id: principal.userId, email: principal.email, role: principal.role },
      accounts,
      defaults: { accountId: resolvedAccount?.accountId ?? null },
    },
  };
}

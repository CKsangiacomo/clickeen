import type { SupabaseAuthPrincipal } from '../../shared/auth';
import { assertDevAuth, isTrustedInternalServiceRequest } from '../../shared/auth';
import type { AccountTier, Env } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString } from '../../shared/validation';
import { DEFAULT_ACCOUNT_L10N_POLICY } from '../../shared/l10n';
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
  } | null;
};

export type IdentityAccountContext = {
  accountId: string;
  role: string;
  name: string;
  slug: string;
  tier: AccountTier;
  websiteUrl: string | null;
  membershipVersion: string | null;
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

const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

function roleRank(role: string): number {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return ROLE_RANK[normalized] ?? -1;
}

function resolveMembershipVersion(row: AccountMembershipRow): string | null {
  const created = asTrimmedString(row.created_at);
  return created || null;
}

function resolveRequestedAccountId(req: Request): string {
  const value = new URL(req.url).searchParams.get('accountId');
  if (!value) return '';
  return value.trim();
}

function selectDefaultAccount(
  accounts: IdentityAccountContext[],
  env: Env,
  requestedAccountId: string,
): IdentityAccountContext | null {
  if (accounts.length === 0) return null;

  if (requestedAccountId) {
    const requested = accounts.find((entry) => entry.accountId === requestedAccountId) ?? null;
    if (requested) return requested;
  }

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

async function ensureAccountExists(env: Env, accountId: string, slug: string, name: string): Promise<void> {
  const insert = await supabaseFetch(env, `/rest/v1/accounts?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: accountId,
      status: 'active',
      is_platform: false,
      tier: 'free',
      slug,
      name,
      l10n_locales: [],
      l10n_policy: DEFAULT_ACCOUNT_L10N_POLICY,
    }),
  });
  if (insert.ok) return;
  if (insert.status === 409) return;
  const details = await readJson(insert);
  throw new Error(`ACCOUNT_INSERT_FAILED: ${JSON.stringify(details)}`);
}

async function ensureAccountMembership(env: Env, accountId: string, userId: string, role: string): Promise<void> {
  const insert = await supabaseFetch(env, `/rest/v1/account_members?on_conflict=account_id,user_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      account_id: accountId,
      user_id: userId,
      role,
    }),
  });
  if (insert.ok) return;
  if (insert.status === 409) return;
  const details = await readJson(insert);
  throw new Error(`ACCOUNT_MEMBERSHIP_INSERT_FAILED: ${JSON.stringify(details)}`);
}

async function loadAccountsForUser(env: Env, userId: string): Promise<AccountMembershipRow[]> {
  const params = new URLSearchParams({
    select: 'account_id,role,created_at,accounts(id,status,is_platform,tier,name,slug,website_url,l10n_locales,l10n_policy)',
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
    });
  }
  return out;
}

export async function resolveIdentityMePayload(req: Request, env: Env): Promise<IdentityMeResolution> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return { ok: false, response: auth.response };

  const principal = auth.principal;
  if (!principal) {
    const localStage = String(env.ENV_STAGE || '').trim().toLowerCase() === 'local';
    if (localStage && isTrustedInternalServiceRequest(req, env)) {
      type AccountListRow = {
        id?: unknown;
        status?: unknown;
        is_platform?: unknown;
        tier?: unknown;
        name?: unknown;
        slug?: unknown;
        website_url?: unknown;
      };

      const accountsRes = await supabaseFetch(
        env,
        `/rest/v1/accounts?${new URLSearchParams({
          select: 'id,status,is_platform,tier,name,slug,website_url',
          order: 'created_at.asc',
          limit: '1000',
        }).toString()}`,
        { method: 'GET' },
      );
      if (!accountsRes.ok) {
        const details = await readJson(accountsRes);
        return { ok: false, response: json({ error: 'ACCOUNT_LOOKUP_FAILED', detail: details }, { status: 502 }) };
      }

      const accountRows = (await accountsRes.json().catch(() => [])) as AccountListRow[];
      const accounts: IdentityAccountContext[] = accountRows
        .map((row) => ({
          accountId: asTrimmedString(row?.id) ?? '',
          role: 'owner',
          name: asTrimmedString(row?.name) ?? 'Account',
          slug: asTrimmedString(row?.slug) ?? 'account',
          tier: (asTrimmedString(row?.tier) as AccountTier) ?? 'free',
          websiteUrl: asTrimmedString(row?.website_url) || null,
          membershipVersion: null,
        }))
        .filter((row) => Boolean(row.accountId));

      const requestedAccountId = resolveRequestedAccountId(req);
      const defaultAccount = selectDefaultAccount(accounts, env, requestedAccountId);

      const syntheticPrincipal: SupabaseAuthPrincipal = {
        token: '',
        userId: 'dev-local',
        email: 'dev@clickeen.local',
        role: 'superadmin',
        claims: { sub: 'dev-local' },
      };

      return {
        ok: true,
        principal: syntheticPrincipal,
        payload: {
          user: { id: syntheticPrincipal.userId, email: syntheticPrincipal.email, role: syntheticPrincipal.role },
          accounts,
          defaults: { accountId: defaultAccount?.accountId ?? null },
        },
      };
    }

    return { ok: false, response: json({ error: 'AUTH_REQUIRED' }, { status: 401 }) };
  }

  let membershipRows: AccountMembershipRow[] = [];
  try {
    membershipRows = await loadAccountsForUser(env, principal.userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: json({ error: 'ACCOUNT_MEMBERSHIP_LOOKUP_FAILED', detail }, { status: 502 }) };
  }

  const shouldAutoProvisionAccount = membershipRows.length === 0;
  if (shouldAutoProvisionAccount) {
    try {
      const personalAccountId = principal.userId;
      await ensureAccountExists(env, personalAccountId, `u-${personalAccountId}`, 'Personal');
      await ensureAccountMembership(env, personalAccountId, principal.userId, 'owner');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, response: json({ error: 'BOOTSTRAP_PROVISION_FAILED', detail }, { status: 502 }) };
    }

    try {
      membershipRows = await loadAccountsForUser(env, principal.userId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, response: json({ error: 'ACCOUNT_MEMBERSHIP_LOOKUP_FAILED', detail }, { status: 502 }) };
    }
  }

  const accounts = normalizeAccountContexts(membershipRows);

  const requestedAccountId = resolveRequestedAccountId(req);
  const resolvedAccount = selectDefaultAccount(accounts, env, requestedAccountId);

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

export async function handleMe(req: Request, env: Env): Promise<Response> {
  const resolved = await resolveIdentityMePayload(req, env);
  if (!resolved.ok) return resolved.response;
  return json(resolved.payload);
}


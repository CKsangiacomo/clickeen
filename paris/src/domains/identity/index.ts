import type { SupabaseAuthPrincipal } from '../../shared/auth';
import { assertDevAuth } from '../../shared/auth';
import type { Env } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: string;
  created_at?: string | null;
  workspaces: {
    id: string;
    account_id: string;
    name: string;
    slug: string;
    tier: string;
    website_url?: string | null;
  } | null;
};

type AccountRow = {
  id: string;
  status: string;
  is_platform: boolean;
};

export type IdentityWorkspaceContext = {
  workspaceId: string;
  accountId: string;
  role: string;
  name: string;
  slug: string;
  tier: string;
  websiteUrl: string | null;
  membershipVersion: string | null;
};

export type IdentityMePayload = {
  user: {
    id: string;
    email: string | null;
    role: string | null;
  };
  accounts: Array<{
    accountId: string;
    status: string;
    isPlatform: boolean;
    derivedRole: 'account_owner' | 'account_admin' | 'account_member';
    workspaceRoles: string[];
  }>;
  workspaces: IdentityWorkspaceContext[];
  defaults: {
    accountId: string | null;
    workspaceId: string | null;
  };
};

type IdentityMeResolution =
  | {
      ok: true;
      principal: SupabaseAuthPrincipal;
      payload: IdentityMePayload;
    }
  | {
      ok: false;
      response: Response;
    };

function deriveAccountRole(workspaceRoles: string[]): 'account_owner' | 'account_admin' | 'account_member' {
  if (workspaceRoles.includes('owner')) return 'account_owner';
  if (workspaceRoles.includes('admin')) return 'account_admin';
  return 'account_member';
}

function toAccountPayload(
  accountRows: AccountRow[],
  accountRoleMap: Map<string, Set<string>>,
) {
  return accountRows.map((row) => {
    const roleSet = accountRoleMap.get(row.id);
    const workspaceRoles = roleSet ? [...roleSet] : [];
    return {
      accountId: row.id,
      status: row.status,
      isPlatform: row.is_platform,
      derivedRole: deriveAccountRole(workspaceRoles),
      workspaceRoles,
    };
  });
}

function asNonEmptyString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveMembershipVersion(row: WorkspaceMembershipRow): string | null {
  const created = asNonEmptyString(row.created_at);
  if (created) return created;
  return null;
}

function resolveRequestedWorkspaceId(req: Request): string {
  const value = new URL(req.url).searchParams.get('workspaceId');
  if (!value) return '';
  return value.trim();
}

async function loadAccountsByIds(env: Env, accountIds: string[]): Promise<AccountRow[]> {
  if (accountIds.length === 0) return [];

  const accountsParams = new URLSearchParams({
    select: 'id,status,is_platform',
    id: `in.(${accountIds.join(',')})`,
  });
  const accountsRes = await supabaseFetch(env, `/rest/v1/accounts?${accountsParams.toString()}`, { method: 'GET' });
  if (!accountsRes.ok) {
    const details = await readJson(accountsRes);
    throw new Error(`ACCOUNT_LOOKUP_FAILED: ${JSON.stringify(details)}`);
  }

  const rows = (await accountsRes.json()) as AccountRow[];
  const mapById = new Map(rows.map((row) => [row.id, row]));
  return accountIds
    .map((accountId) => mapById.get(accountId) ?? null)
    .filter((row): row is AccountRow => Boolean(row));
}

export async function resolveIdentityMePayload(req: Request, env: Env): Promise<IdentityMeResolution> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return { ok: false, response: auth.response };

  const principal = auth.principal;
  if (!principal) {
    return { ok: false, response: json({ error: 'AUTH_REQUIRED' }, { status: 401 }) };
  }

  const workspaceMembershipParams = new URLSearchParams({
    select: 'workspace_id,role,created_at,workspaces(id,account_id,name,slug,tier,website_url)',
    user_id: `eq.${principal.userId}`,
    limit: '1000',
    order: 'created_at.asc',
  });

  const workspaceMembershipRes = await supabaseFetch(
    env,
    `/rest/v1/workspace_members?${workspaceMembershipParams.toString()}`,
    { method: 'GET' },
  );
  if (!workspaceMembershipRes.ok) {
    const details = await readJson(workspaceMembershipRes);
    return {
      ok: false,
      response: json(
        {
          error: 'MEMBERSHIP_LOOKUP_FAILED',
          detail: details,
        },
        { status: 502 },
      ),
    };
  }

  const workspaceMembershipRows = (await workspaceMembershipRes.json()) as WorkspaceMembershipRow[];

  const workspaces: IdentityWorkspaceContext[] = [];
  for (const row of workspaceMembershipRows) {
    if (!row.workspaces) continue;
    workspaces.push({
      workspaceId: row.workspaces.id,
      accountId: row.workspaces.account_id,
      role: row.role,
      name: row.workspaces.name,
      slug: row.workspaces.slug,
      tier: row.workspaces.tier,
      websiteUrl: asNonEmptyString(row.workspaces.website_url) || null,
      membershipVersion: resolveMembershipVersion(row),
    });
  }

  const accountRoleMap = new Map<string, Set<string>>();
  for (const workspace of workspaces) {
    if (!accountRoleMap.has(workspace.accountId)) {
      accountRoleMap.set(workspace.accountId, new Set<string>());
    }
    accountRoleMap.get(workspace.accountId)?.add(workspace.role);
  }

  let accountRows: AccountRow[] = [];
  const accountIds = [...accountRoleMap.keys()];
  if (accountIds.length > 0) {
    try {
      accountRows = await loadAccountsByIds(env, accountIds);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        response: json(
          {
            error: 'ACCOUNT_LOOKUP_FAILED',
            detail,
          },
          { status: 502 },
        ),
      };
    }
  }

  const accounts = toAccountPayload(accountRows, accountRoleMap);

  const requestedWorkspaceId = resolveRequestedWorkspaceId(req);
  const requestedWorkspace = requestedWorkspaceId
    ? workspaces.find((workspace) => workspace.workspaceId === requestedWorkspaceId) ?? null
    : null;
  const resolvedWorkspace = requestedWorkspace ?? (workspaces.length === 1 ? workspaces[0] : null);

  const defaults = {
    accountId: resolvedWorkspace?.accountId ?? null,
    workspaceId: resolvedWorkspace?.workspaceId ?? null,
  };

  return {
    ok: true,
    principal,
    payload: {
      user: {
        id: principal.userId,
        email: principal.email,
        role: principal.role,
      },
      accounts,
      workspaces,
      defaults,
    },
  };
}

export async function handleMe(req: Request, env: Env): Promise<Response> {
  const resolved = await resolveIdentityMePayload(req, env);
  if (!resolved.ok) return resolved.response;
  return json(resolved.payload);
}

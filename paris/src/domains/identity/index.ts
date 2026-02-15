import type { Env } from '../../shared/types';
import { assertSupabaseAuth } from '../../shared/auth';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: string;
  workspaces: {
    id: string;
    account_id: string;
    name: string;
    slug: string;
    tier: string;
  } | null;
};

type AccountRow = {
  id: string;
  status: string;
  is_platform: boolean;
};

function deriveAccountRole(workspaceRoles: string[]): 'account_owner' | 'account_admin' | 'account_member' {
  if (workspaceRoles.includes('owner')) return 'account_owner';
  if (workspaceRoles.includes('admin')) return 'account_admin';
  return 'account_member';
}

export async function handleMe(req: Request, env: Env): Promise<Response> {
  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceMembershipParams = new URLSearchParams({
    select: 'workspace_id,role,workspaces(id,account_id,name,slug,tier)',
    user_id: `eq.${auth.principal.userId}`,
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
    return json(
      {
        error: 'MEMBERSHIP_LOOKUP_FAILED',
        detail: details,
      },
      { status: 502 },
    );
  }

  const workspaceMembershipRows = (await workspaceMembershipRes.json()) as WorkspaceMembershipRow[];

  const workspaces: Array<{
    workspaceId: string;
    accountId: string;
    role: string;
    name: string;
    slug: string;
    tier: string;
  }> = [];
  for (const row of workspaceMembershipRows) {
    if (!row.workspaces) continue;
    workspaces.push({
      workspaceId: row.workspaces.id,
      accountId: row.workspaces.account_id,
      role: row.role,
      name: row.workspaces.name,
      slug: row.workspaces.slug,
      tier: row.workspaces.tier,
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
    const accountsParams = new URLSearchParams({
      select: 'id,status,is_platform',
      id: `in.(${accountIds.join(',')})`,
    });
    const accountsRes = await supabaseFetch(env, `/rest/v1/accounts?${accountsParams.toString()}`, { method: 'GET' });
    if (!accountsRes.ok) {
      const details = await readJson(accountsRes);
      return json(
        {
          error: 'ACCOUNT_LOOKUP_FAILED',
          detail: details,
        },
        { status: 502 },
      );
    }
    accountRows = (await accountsRes.json()) as AccountRow[];
  }

  const accounts = accountRows.map((row) => {
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

  const defaults = {
    accountId: accounts[0]?.accountId ?? null,
    workspaceId: workspaces[0]?.workspaceId ?? null,
  };

  return json({
    user: {
      id: auth.principal.userId,
      email: auth.principal.email,
      role: auth.principal.role,
    },
    accounts,
    workspaces,
    defaults,
  });
}

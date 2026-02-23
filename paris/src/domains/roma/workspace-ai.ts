import { resolveAiAgent, resolveAiPolicyCapsule, resolvePolicy, resolveWidgetCopilotRequestedAgentId } from '@clickeen/ck-policy';
import type { Env } from '../../shared/types';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { authorizeWorkspace as authorizeWorkspaceAccess } from '../../shared/workspace-auth';
import type { WorkspaceMemberListRow } from './common';
import { assertWorkspaceId, normalizeRole } from './common';

export async function handleWorkspaceMembers(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const params = new URLSearchParams({
    select: 'user_id,role,created_at',
    workspace_id: `eq.${workspaceId}`,
    order: 'created_at.asc',
    limit: '500',
  });
  const membersRes = await supabaseFetch(env, `/rest/v1/workspace_members?${params.toString()}`, { method: 'GET' });
  if (!membersRes.ok) {
    const details = await readJson(membersRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const rows = ((await membersRes.json()) as WorkspaceMemberListRow[]) ?? [];

  return json({
    workspaceId,
    role: authorized.role,
    members: rows.map((row) => ({
      userId: row.user_id,
      role: normalizeRole(row.role) ?? row.role,
      createdAt: row.created_at ?? null,
      updatedAt: null,
    })),
  });
}

export async function handleWorkspacePolicy(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const policy = resolvePolicy({ profile: authorized.workspace.tier, role: authorized.role });
  return json({
    workspaceId: authorized.workspace.id,
    accountId: authorized.workspace.account_id,
    profile: authorized.workspace.tier,
    role: authorized.role,
    policy,
  });
}

export async function handleWorkspaceEntitlements(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const policy = resolvePolicy({ profile: authorized.workspace.tier, role: authorized.role });
  return json({
    workspaceId: authorized.workspace.id,
    profile: policy.profile,
    role: policy.role,
    entitlements: {
      flags: policy.flags,
      caps: policy.caps,
      budgets: policy.budgets,
    },
  });
}

export async function handleWorkspaceAiProfile(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const requestedId = 'widget.copilot.v1';
  const canonicalId = resolveWidgetCopilotRequestedAgentId({
    requestedAgentId: requestedId,
    policyProfile: authorized.workspace.tier,
  });
  const resolved = canonicalId ? resolveAiAgent(canonicalId) : null;
  if (!resolved) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.ai.profileUnavailable' }, 500);
  }

  const capsule = resolveAiPolicyCapsule({
    entry: resolved.entry,
    policyProfile: authorized.workspace.tier,
    isCurated: false,
  });

  return json({
    workspaceId: authorized.workspace.id,
    profile: authorized.workspace.tier,
    role: authorized.role,
    widgetCopilot: {
      requestedAgentId: requestedId,
      canonicalAgentId: resolved.canonicalId,
      profile: capsule.profile,
      provider: capsule.provider,
      model: capsule.model,
      strict: capsule.strict,
      reasonKey: capsule.reasonKey ?? null,
      upsell: capsule.upsell ?? null,
    },
  });
}

export async function handleWorkspaceAiLimits(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const policy = resolvePolicy({ profile: authorized.workspace.tier, role: authorized.role });
  const caps = Object.fromEntries(
    Object.entries(policy.caps).filter(([key]) => key.startsWith('ai.') || key.includes('copilot')),
  );
  const budgets = Object.fromEntries(
    Object.entries(policy.budgets).filter(([key]) => key.startsWith('budget.ai') || key.startsWith('budget.copilot')),
  );

  return json({
    workspaceId: authorized.workspace.id,
    profile: policy.profile,
    role: policy.role,
    caps,
    budgets,
  });
}

export async function handleWorkspaceAiOutcomes(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'editor');
  if (!authorized.ok) return authorized.response;

  return ckError(
    {
      kind: 'INTERNAL',
      reasonKey: 'coreui.errors.ai.outcomes.unavailable',
      detail: 'San Francisco outcomes read contract is not wired in this repo snapshot.',
    },
    501,
  );
}

import type { Env } from '../../shared/types';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import type { AccountAssetRow, AccountWorkspaceRow, InstanceListRow } from './common';
import { assertAccountId } from './common';
import { accountRoleLabel, authorizeAccount, inferHighestTier, loadAccountWorkspaces } from './data';

export async function handleAccountGet(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let workspaceCount = 0;
  try {
    const workspaces = await loadAccountWorkspaces(env, accountId);
    workspaceCount = workspaces.length;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  return json({
    accountId,
    status: authorized.account.status,
    role: accountRoleLabel(authorized.role),
    workspaceCount,
  });
}

export async function handleAccountWorkspaces(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let workspaces: AccountWorkspaceRow[] = [];
  try {
    workspaces = await loadAccountWorkspaces(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  return json({
    accountId,
    role: accountRoleLabel(authorized.role),
    workspaces: workspaces.map((workspace) => ({
      workspaceId: workspace.id,
      accountId: workspace.account_id,
      tier: workspace.tier,
      name: workspace.name,
      slug: workspace.slug,
      createdAt: workspace.created_at ?? null,
      updatedAt: workspace.updated_at ?? null,
    })),
  });
}

export async function handleAccountUsage(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let workspaces: AccountWorkspaceRow[] = [];
  try {
    workspaces = await loadAccountWorkspaces(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const workspaceIds = workspaces.map((workspace) => workspace.id).filter(Boolean);

  let instances: InstanceListRow[] = [];
  if (workspaceIds.length > 0) {
    const instanceParams = new URLSearchParams({
      select: 'public_id,status,workspace_id',
      workspace_id: `in.(${workspaceIds.join(',')})`,
      limit: '5000',
    });
    const instanceRes = await supabaseFetch(env, `/rest/v1/widget_instances?${instanceParams.toString()}`, { method: 'GET' });
    if (!instanceRes.ok) {
      const details = await readJson(instanceRes);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
    }
    instances = ((await instanceRes.json()) as InstanceListRow[]) ?? [];
  }

  const assetParams = new URLSearchParams({
    select: 'asset_id,size_bytes',
    account_id: `eq.${accountId}`,
    limit: '5000',
  });
  const assetRes = await supabaseFetch(env, `/rest/v1/account_assets?${assetParams.toString()}`, { method: 'GET' });
  if (!assetRes.ok) {
    const details = await readJson(assetRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const assets = ((await assetRes.json()) as AccountAssetRow[]) ?? [];

  const assetBytes = assets.reduce((sum, asset) => {
    const size = Number.isFinite(asset.size_bytes) ? asset.size_bytes : 0;
    return sum + Math.max(0, size);
  }, 0);

  const publishedInstances = instances.filter((instance) => instance.status === 'published').length;

  return json({
    accountId,
    role: accountRoleLabel(authorized.role),
    usage: {
      workspaces: workspaces.length,
      instances: {
        total: instances.length,
        published: publishedInstances,
        unpublished: Math.max(0, instances.length - publishedInstances),
      },
      assets: {
        total: assets.length,
        active: assets.length,
        bytesActive: assetBytes,
      },
    },
  });
}

export async function handleAccountBillingSummary(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  let workspaces: AccountWorkspaceRow[] = [];
  try {
    workspaces = await loadAccountWorkspaces(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const inferredTier = inferHighestTier(workspaces);

  return json({
    accountId,
    role: accountRoleLabel(authorized.role),
    provider: 'stripe',
    status: 'not_configured',
    reasonKey: 'coreui.errors.billing.notConfigured',
    plan: {
      inferredTier,
      workspaceCount: workspaces.length,
    },
    checkoutAvailable: false,
    portalAvailable: false,
  });
}

export async function handleAccountBillingCheckoutSession(
  req: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  return ckError(
    {
      kind: 'INTERNAL',
      reasonKey: 'coreui.errors.billing.notConfigured',
      detail: 'Checkout session contract is not wired yet in this repo snapshot.',
    },
    503,
  );
}

export async function handleAccountBillingPortalSession(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  return ckError(
    {
      kind: 'INTERNAL',
      reasonKey: 'coreui.errors.billing.notConfigured',
      detail: 'Portal session contract is not wired yet in this repo snapshot.',
    },
    503,
  );
}

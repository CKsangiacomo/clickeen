import type { Env } from '../../shared/types';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import type { AccountAssetRow, AccountWorkspaceRow, InstanceListRow } from './common';
import { assertAccountId } from './common';
import { accountRoleLabel, authorizeAccount, inferHighestTier, loadAccountWorkspaces } from './data';

const ACCOUNT_USAGE_PAGE_SIZE = 1000;

async function loadPagedRows<T>(args: {
  env: Env;
  table: string;
  baseParams: Record<string, string>;
  pageSize?: number;
}): Promise<T[]> {
  const pageSize = args.pageSize ?? ACCOUNT_USAGE_PAGE_SIZE;
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      ...args.baseParams,
      limit: String(pageSize),
      offset: String(offset),
    });
    const res = await supabaseFetch(args.env, `/rest/v1/${args.table}?${params.toString()}`, { method: 'GET' });
    if (!res.ok) {
      const details = await readJson(res);
      throw new Error(`[ParisWorker] Failed to load ${args.table} rows (${res.status}): ${JSON.stringify(details)}`);
    }
    const rows = ((await res.json()) as T[]) ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

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
    try {
      instances = await loadPagedRows<InstanceListRow>({
        env,
        table: 'widget_instances',
        baseParams: {
          select: 'public_id,status,workspace_id',
          workspace_id: `in.(${workspaceIds.join(',')})`,
          order: 'public_id.asc',
        },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
    }
  }

  let assets: AccountAssetRow[] = [];
  try {
    assets = await loadPagedRows<AccountAssetRow>({
      env,
      table: 'account_assets',
      baseParams: {
        select: 'asset_id,size_bytes',
        account_id: `eq.${accountId}`,
        order: 'created_at.asc',
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

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

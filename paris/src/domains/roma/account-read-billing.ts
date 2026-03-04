import type { Env } from '../../shared/types';
import { authorizeAccount } from '../../shared/account-auth';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { assertAccountId } from '../../shared/validation';

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

type InstanceListRow = {
  public_id?: string | null;
  status?: 'published' | 'unpublished' | null;
};

type AccountAssetRow = {
  asset_id?: string | null;
  size_bytes?: number | null;
};

export async function handleAccountGet(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  return json({
    accountId,
    status: authorized.account.status ?? 'active',
    tier: authorized.account.tier,
    name: authorized.account.name,
    slug: authorized.account.slug,
    websiteUrl: authorized.account.website_url,
    role: authorized.role,
  });
}

export async function handleAccountUsage(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let instances: InstanceListRow[] = [];
  try {
    instances = await loadPagedRows<InstanceListRow>({
      env,
      table: 'widget_instances',
      baseParams: {
        select: 'public_id,status',
        account_id: `eq.${accountId}`,
        order: 'public_id.asc',
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
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
    role: authorized.role,
    usage: {
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

  return json({
    accountId,
    role: authorized.role,
    provider: 'stripe',
    status: 'not_configured',
    reasonKey: 'coreui.errors.billing.notConfigured',
    plan: {
      inferredTier: authorized.account.tier,
      accountCount: 1,
    },
    checkoutAvailable: false,
    portalAvailable: false,
  });
}

export async function handleAccountBillingCheckoutSession(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
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


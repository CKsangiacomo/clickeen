import type { Env } from '../../shared/types';
import { ckError } from '../../shared/errors';
import { assertDevAuth } from '../../shared/auth';
import { readRomaAccountAuthzCapsuleHeader, verifyRomaAccountAuthzCapsule } from '../../shared/authz-capsule';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { isUuid } from '../../shared/validation';
import { toCanonicalAssetVersionPath } from '@clickeen/ck-contracts';

type AccountRow = {
  id: string;
  status: 'active' | 'disabled';
  is_platform: boolean;
};
type AccountAssetRow = {
  asset_id: string;
  account_id: string;
  workspace_id?: string | null;
  public_id?: string | null;
  widget_type?: string | null;
  source: string;
  original_filename: string;
  normalized_filename: string;
  content_type: string;
  size_bytes: number;
  sha256?: string | null;
  created_at: string;
  updated_at: string;
};
type AccountAssetVariantRow = {
  asset_id: string;
  variant: string;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};
type AccountAssetUsageRow = {
  account_id: string;
  asset_id: string;
  public_id: string;
  config_path: string;
  created_at: string;
  updated_at: string;
};
type WorkspaceMembershipRole = 'viewer' | 'editor' | 'admin' | 'owner';
type AccountAssetView = 'all' | 'used_in_workspace' | 'created_in_workspace';
type AccountAssetProjection = {
  view: AccountAssetView;
  workspaceId: string | null;
};
type WorkspaceAccountRow = {
  id: string;
  account_id: string;
};
function assertAccountId(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

function assertAssetId(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.assetId.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

function assertWorkspaceId(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

function resolveAccountAssetView(req: Request): { ok: true; projection: AccountAssetProjection } | { ok: false; response: Response } {
  const url = new URL(req.url);
  const rawView = (url.searchParams.get('view') || '').trim().toLowerCase();
  const rawWorkspaceId = (url.searchParams.get('workspaceId') || '').trim();

  let view: AccountAssetView = 'all';
  if (!rawView || rawView === 'all') {
    view = 'all';
  } else if (rawView === 'used_in_workspace') {
    view = 'used_in_workspace';
  } else if (rawView === 'created_in_workspace') {
    view = 'created_in_workspace';
  } else {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  if (!rawWorkspaceId) {
    if (view !== 'all') {
      return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' }, 422) };
    }
    return { ok: true, projection: { view, workspaceId: null } };
  }

  const workspaceIdResult = assertWorkspaceId(rawWorkspaceId);
  if (!workspaceIdResult.ok) return workspaceIdResult;
  return {
    ok: true,
    projection: {
      view,
      workspaceId: workspaceIdResult.value,
    },
  };
}

function resolveListLimit(req: Request): number {
  const url = new URL(req.url);
  const raw = Number.parseInt((url.searchParams.get('limit') || '').trim(), 10);
  if (!Number.isFinite(raw) || raw <= 0) return 50;
  return Math.min(raw, 200);
}

function resolveTokyoPublicAssetBase(env: Env): string | null {
  const raw = (
    (typeof env.TOKYO_BASE_URL === 'string' ? env.TOKYO_BASE_URL : '') ||
    (typeof env.TOKYO_WORKER_BASE_URL === 'string' ? env.TOKYO_WORKER_BASE_URL : '')
  )
    .trim()
    .replace(/\/+$/, '');
  return raw || null;
}

function resolveTokyoMutableAssetBase(env: Env): string | null {
  const raw = (
    (typeof env.TOKYO_WORKER_BASE_URL === 'string' ? env.TOKYO_WORKER_BASE_URL : '') ||
    (typeof env.TOKYO_BASE_URL === 'string' ? env.TOKYO_BASE_URL : '')
  )
    .trim()
    .replace(/\/+$/, '');
  return raw || null;
}

function normalizeAssetVariant(
  row: AccountAssetVariantRow,
  tokyoBase: string | null,
): {
  variant: string;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
} {
  const key = row.r2_key;
  const versionPath = toCanonicalAssetVersionPath(key);
  const url = tokyoBase && versionPath ? `${tokyoBase}${versionPath}` : null;
  return {
    variant: row.variant,
    key,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    url,
  };
}

function normalizeAccountAsset(
  row: AccountAssetRow,
  variants: AccountAssetVariantRow[],
  usageRows: AccountAssetUsageRow[],
  tokyoBase: string | null,
) {
  const usage = usageRows.map((item) => ({
    publicId: item.public_id,
    configPath: item.config_path,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));

  return {
    assetId: row.asset_id,
    accountId: row.account_id,
    workspaceId: row.workspace_id ?? null,
    publicId: row.public_id ?? null,
    widgetType: row.widget_type ?? null,
    source: row.source,
    originalFilename: row.original_filename,
    normalizedFilename: row.normalized_filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256 ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usageCount: usage.length,
    usedBy: usage,
    variants: variants.map((variant) => normalizeAssetVariant(variant, tokyoBase)),
  };
}

function roleRank(role: string): number {
  switch (role) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'editor':
      return 2;
    case 'viewer':
      return 1;
    default:
      return 0;
  }
}

async function resolveAccountMembershipRole(
  env: Env,
  accountId: string,
  userId: string,
): Promise<WorkspaceMembershipRole | null> {
  const workspaceParams = new URLSearchParams({
    select: 'id',
    account_id: `eq.${accountId}`,
    limit: '500',
  });
  const workspaceRes = await supabaseFetch(env, `/rest/v1/workspaces?${workspaceParams.toString()}`, { method: 'GET' });
  if (!workspaceRes.ok) {
    const details = await readJson(workspaceRes);
    throw new Error(`[ParisWorker] Failed to resolve account workspaces (${workspaceRes.status}): ${JSON.stringify(details)}`);
  }
  const workspaces = (await workspaceRes.json()) as Array<{ id?: string }>;
  const workspaceIds = workspaces
    .map((row) => (typeof row.id === 'string' ? row.id : ''))
    .filter((id) => Boolean(id));
  if (workspaceIds.length === 0) return null;

  const membershipParams = new URLSearchParams({
    select: 'role',
    user_id: `eq.${userId}`,
    workspace_id: `in.(${workspaceIds.join(',')})`,
    limit: '500',
  });
  const membershipRes = await supabaseFetch(env, `/rest/v1/workspace_members?${membershipParams.toString()}`, {
    method: 'GET',
  });
  if (!membershipRes.ok) {
    const details = await readJson(membershipRes);
    throw new Error(
      `[ParisWorker] Failed to resolve account membership (${membershipRes.status}): ${JSON.stringify(details)}`,
    );
  }
  const memberships = (await membershipRes.json()) as Array<{ role?: string }>;
  let highest: WorkspaceMembershipRole | null = null;
  for (const membership of memberships) {
    const role = typeof membership.role === 'string' ? membership.role : '';
    if (!role) continue;
    if (!highest || roleRank(role) > roleRank(highest)) {
      highest = role as WorkspaceMembershipRole;
    }
  }
  return highest;
}

async function authorizeAccountAccess(
  req: Request,
  env: Env,
  accountId: string,
  auth: { principal?: { userId: string } },
  minRole: WorkspaceMembershipRole = 'viewer',
): Promise<Response | null> {
  const userId = auth.principal?.userId;
  if (!userId) {
    return ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.auth.required' }, 401);
  }

  const accountCapsule = readRomaAccountAuthzCapsuleHeader(req);
  if (accountCapsule) {
    const verified = await verifyRomaAccountAuthzCapsule(env, accountCapsule);
    if (!verified.ok) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    const payload = verified.payload;
    if (payload.userId !== userId || payload.accountId !== accountId) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    if (roleRank(payload.role) < roleRank(minRole)) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    return null;
  }

  let role: WorkspaceMembershipRole | null = null;
  try {
    role = await resolveAccountMembershipRole(env, accountId, userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  if (!role) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.account.mismatch' }, 403);
  }
  if (roleRank(role) < roleRank(minRole)) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }
  return null;
}

async function loadAccount(env: Env, accountId: string): Promise<AccountRow | null> {
  const params = new URLSearchParams({
    select: 'id,status,is_platform',
    id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/accounts?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as AccountRow[];
  return rows?.[0] ?? null;
}

async function assertWorkspaceInAccount(
  env: Env,
  accountId: string,
  workspaceId: string,
): Promise<Response | null> {
  const params = new URLSearchParams({
    select: 'id,account_id',
    id: `eq.${workspaceId}`,
    account_id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const rows = (await res.json()) as WorkspaceAccountRow[];
  if (!rows?.[0]?.id) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.workspace.notFound' }, 404);
  }
  return null;
}

async function loadVariantsByAssetIds(
  env: Env,
  accountId: string,
  assetIds: string[],
): Promise<Map<string, AccountAssetVariantRow[]>> {
  const out = new Map<string, AccountAssetVariantRow[]>();
  if (assetIds.length === 0) return out;

  const params = new URLSearchParams({
    select: 'asset_id,variant,r2_key,filename,content_type,size_bytes,created_at',
    account_id: `eq.${accountId}`,
    asset_id: `in.(${assetIds.join(',')})`,
    order: 'created_at.desc',
    limit: '2000',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_variants?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account asset variants (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as AccountAssetVariantRow[];
  rows.forEach((row) => {
    const current = out.get(row.asset_id);
    if (current) current.push(row);
    else out.set(row.asset_id, [row]);
  });
  return out;
}

async function loadUsageByAssetIds(
  env: Env,
  accountId: string,
  assetIds: string[],
): Promise<Map<string, AccountAssetUsageRow[]>> {
  const out = new Map<string, AccountAssetUsageRow[]>();
  if (assetIds.length === 0) return out;

  const params = new URLSearchParams({
    select: 'account_id,asset_id,public_id,config_path,created_at,updated_at',
    account_id: `eq.${accountId}`,
    asset_id: `in.(${assetIds.join(',')})`,
    order: 'updated_at.desc',
    limit: '5000',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_usage?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load account asset usage (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as AccountAssetUsageRow[];
  rows.forEach((row) => {
    const current = out.get(row.asset_id);
    if (current) current.push(row);
    else out.set(row.asset_id, [row]);
  });
  return out;
}

async function loadAccountAsset(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<AccountAssetRow | null> {
  const params = new URLSearchParams({
    select:
      'asset_id,account_id,workspace_id,public_id,widget_type,source,original_filename,normalized_filename,content_type,size_bytes,sha256,created_at,updated_at',
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_assets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account asset (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as AccountAssetRow[];
  return rows?.[0] ?? null;
}

async function loadWorkspaceInstancePublicIdSet(env: Env, workspaceId: string): Promise<Set<string>> {
  const params = new URLSearchParams({
    select: 'public_id',
    workspace_id: `eq.${workspaceId}`,
    limit: '5000',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load workspace instances for asset usage (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as Array<{ public_id?: string }>;
  const out = new Set<string>();
  rows.forEach((row) => {
    const publicId = typeof row.public_id === 'string' ? row.public_id : '';
    if (publicId) out.add(publicId);
  });
  return out;
}

async function loadUsageByAssetIdsForWorkspace(
  env: Env,
  accountId: string,
  workspaceId: string,
  assetIds: string[],
): Promise<Map<string, AccountAssetUsageRow[]>> {
  const usageByAssetId = await loadUsageByAssetIds(env, accountId, assetIds);
  if (usageByAssetId.size === 0) return usageByAssetId;
  const workspacePublicIds = await loadWorkspaceInstancePublicIdSet(env, workspaceId);
  if (workspacePublicIds.size === 0) return new Map<string, AccountAssetUsageRow[]>();

  const filtered = new Map<string, AccountAssetUsageRow[]>();
  usageByAssetId.forEach((rows, assetId) => {
    const scopedRows = rows.filter((row) => workspacePublicIds.has(row.public_id));
    if (scopedRows.length) filtered.set(assetId, scopedRows);
  });
  return filtered;
}

export async function handleAccountAssetsList(req: Request, env: Env, accountIdRaw: string) {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;

  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const ownerError = await authorizeAccountAccess(req, env, accountId, auth, 'viewer');
  if (ownerError) return ownerError;

  const projectionResult = resolveAccountAssetView(req);
  if (!projectionResult.ok) return projectionResult.response;
  const projection = projectionResult.projection;

  let account: AccountRow | null = null;
  try {
    account = await loadAccount(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!account) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404);
  }

  if (projection.workspaceId) {
    const workspaceScopeError = await assertWorkspaceInAccount(env, accountId, projection.workspaceId);
    if (workspaceScopeError) return workspaceScopeError;
  }

  const limit = resolveListLimit(req);
  const params = new URLSearchParams({
    select:
      'asset_id,account_id,workspace_id,public_id,widget_type,source,original_filename,normalized_filename,content_type,size_bytes,sha256,created_at,updated_at',
    account_id: `eq.${accountId}`,
    order: 'created_at.desc',
    limit: String(limit),
  });
  if (projection.view === 'created_in_workspace' && projection.workspaceId) {
    params.set('workspace_id', `eq.${projection.workspaceId}`);
  }

  const tokyoBase = resolveTokyoPublicAssetBase(env);

  try {
    const res = await supabaseFetch(env, `/rest/v1/account_assets?${params.toString()}`, { method: 'GET' });
    if (!res.ok) {
      const details = await readJson(res);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
    }
    let assets = (await res.json()) as AccountAssetRow[];
    const assetIds = assets.map((asset) => asset.asset_id).filter(Boolean);
    const variantsByAssetId = await loadVariantsByAssetIds(env, accountId, assetIds);
    const usageByAssetId =
      projection.view === 'used_in_workspace' && projection.workspaceId
        ? await loadUsageByAssetIdsForWorkspace(env, accountId, projection.workspaceId, assetIds)
        : await loadUsageByAssetIds(env, accountId, assetIds);

    if (projection.view === 'used_in_workspace' && projection.workspaceId) {
      assets = assets.filter((asset) => (usageByAssetId.get(asset.asset_id)?.length ?? 0) > 0);
    }

    return json({
      accountId,
      view: projection.view,
      workspaceId: projection.workspaceId,
      assets: assets.map((asset) =>
        normalizeAccountAsset(
          asset,
          variantsByAssetId.get(asset.asset_id) ?? [],
          usageByAssetId.get(asset.asset_id) ?? [],
          tokyoBase,
        ),
      ),
      pagination: {
        limit,
        count: assets.length,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
}

export async function handleAccountAssetGet(req: Request, env: Env, accountIdRaw: string, assetIdRaw: string) {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;

  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const assetIdResult = assertAssetId(assetIdRaw);
  if (!assetIdResult.ok) return assetIdResult.response;
  const assetId = assetIdResult.value;

  const ownerError = await authorizeAccountAccess(req, env, accountId, auth, 'viewer');
  if (ownerError) return ownerError;

  const projectionResult = resolveAccountAssetView(req);
  if (!projectionResult.ok) return projectionResult.response;
  const projection = projectionResult.projection;

  const tokyoBase = resolveTokyoPublicAssetBase(env);

  try {
    const account = await loadAccount(env, accountId);
    if (!account) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404);

    if (projection.workspaceId) {
      const workspaceScopeError = await assertWorkspaceInAccount(env, accountId, projection.workspaceId);
      if (workspaceScopeError) return workspaceScopeError;
    }

    const asset = await loadAccountAsset(env, accountId, assetId);
    if (!asset) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);

    const variantsByAssetId = await loadVariantsByAssetIds(env, accountId, [assetId]);
    const usageByAssetId =
      projection.view === 'used_in_workspace' && projection.workspaceId
        ? await loadUsageByAssetIdsForWorkspace(env, accountId, projection.workspaceId, [assetId])
        : await loadUsageByAssetIds(env, accountId, [assetId]);
    const usageRows = usageByAssetId.get(assetId) ?? [];

    if (projection.view === 'created_in_workspace' && projection.workspaceId && asset.workspace_id !== projection.workspaceId) {
      return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);
    }
    if (projection.view === 'used_in_workspace' && projection.workspaceId && usageRows.length === 0) {
      return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);
    }

    return json({
      accountId,
      view: projection.view,
      workspaceId: projection.workspaceId,
      asset: normalizeAccountAsset(
        asset,
        variantsByAssetId.get(assetId) ?? [],
        usageRows,
        tokyoBase,
      ),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
}

export async function handleAccountAssetDelete(req: Request, env: Env, accountIdRaw: string, assetIdRaw: string) {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;
  const assetIdResult = assertAssetId(assetIdRaw);
  if (!assetIdResult.ok) return assetIdResult.response;
  const assetId = assetIdResult.value;
  const ownerError = await authorizeAccountAccess(req, env, accountId, auth, 'editor');
  if (ownerError) return ownerError;
  try {
    const account = await loadAccount(env, accountId);
    if (!account) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404);

    const existing = await loadAccountAsset(env, accountId, assetId);
    if (!existing) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);
    const tokyoBase = resolveTokyoMutableAssetBase(env);
    if (!tokyoBase) {
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'TOKYO_BASE_URL missing' }, 500);
    }

    const tokyoToken = (env.TOKYO_DEV_JWT || env.PARIS_DEV_JWT || '').trim();
    if (!tokyoToken) {
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'TOKYO_DEV_JWT missing' }, 500);
    }

    const confirmInUse = (new URL(req.url).searchParams.get('confirmInUse') || '').trim();
    const tokyoUrl = new URL(`${tokyoBase}/assets/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}`);
    if (confirmInUse) tokyoUrl.searchParams.set('confirmInUse', confirmInUse);

    const tokyoRes = await fetch(
      tokyoUrl.toString(),
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokyoToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );
    const tokyoBody = await readJson(tokyoRes);
    if (tokyoRes.status === 404) {
      return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);
    }
    if (tokyoRes.status === 409 && tokyoBody && typeof tokyoBody === 'object') {
      return json(tokyoBody as Record<string, unknown>, { status: 409 });
    }
    if (!tokyoRes.ok) {
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: JSON.stringify(tokyoBody),
        },
        500,
      );
    }

    return json(
      (tokyoBody && typeof tokyoBody === 'object'
        ? tokyoBody
        : {
            accountId,
            assetId,
            deleted: true,
          }) as Record<string, unknown>,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
}

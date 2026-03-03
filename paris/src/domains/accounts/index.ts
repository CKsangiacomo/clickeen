import type { Env, LocalePolicy, WorkspaceRow } from '../../shared/types';
import { ckError } from '../../shared/errors';
import { assertDevAuth, isTrustedInternalServiceRequest } from '../../shared/auth';
import { readRomaAccountAuthzCapsuleHeader, verifyRomaAccountAuthzCapsule } from '../../shared/authz-capsule';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { isUuid } from '../../shared/validation';
import { toCanonicalAssetVersionPath } from '@clickeen/ck-contracts';
import { resolveWorkspaceL10nPolicy } from '../../shared/l10n';
import { loadWorkspaceById } from '../../shared/workspaces';
import { enqueueTokyoMirrorJob, resolveActivePublishLocales } from '../workspaces/service';
import { resolvePolicy, type Policy } from '@clickeen/ck-policy';

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

type WorkspaceTier = 'free' | 'tier1' | 'tier2' | 'tier3';

type WorkspaceInstanceStatus = 'published' | 'unpublished';
type WorkspaceInstanceRow = {
  public_id?: string | null;
  workspace_id?: string | null;
  status?: WorkspaceInstanceStatus | null;
  created_at?: string | null;
};

type TokyoAssetIdentityIntegritySnapshot = {
  ok?: boolean;
  reasonKey?: string | null;
  dbVariantCount?: number;
  r2ObjectCount?: number;
  missingInR2Count?: number;
  orphanInR2Count?: number;
  missingInR2?: string[];
  orphanInR2?: string[];
};

const ACCOUNT_ASSET_QUERY_PAGE_SIZE = 1000;

function normalizeWorkspaceTier(value: unknown): WorkspaceTier | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'free' || raw === 'tier1' || raw === 'tier2' || raw === 'tier3') return raw;
  return null;
}

function tierRank(tier: WorkspaceTier): number {
  switch (tier) {
    case 'tier3':
      return 4;
    case 'tier2':
      return 3;
    case 'tier1':
      return 2;
    case 'free':
      return 1;
    default:
      return 0;
  }
}

async function loadPagedRows<T>(args: {
  env: Env;
  table: string;
  baseParams: Record<string, string>;
  pageSize?: number;
}): Promise<T[]> {
  const pageSize = args.pageSize ?? ACCOUNT_ASSET_QUERY_PAGE_SIZE;
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

function assertNoticeId(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

function normalizePublicIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  raw.forEach((entry) => {
    const value = typeof entry === 'string' ? entry.trim() : '';
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out;
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

function requireRomaAssetSurface(req: Request): Response | null {
  const surface = (req.headers.get('x-clickeen-surface') || '').trim();
  if (surface === 'roma-assets') return null;
  return ckError(
    {
      kind: 'DENY',
      reasonKey: 'coreui.errors.auth.forbidden',
      detail: 'Asset delete is managed via Roma Assets.',
    },
    403,
  );
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

function resolveTokyoServiceToken(env: Env): string | null {
  const token = ((typeof env.TOKYO_DEV_JWT === 'string' ? env.TOKYO_DEV_JWT : '') || (typeof env.PARIS_DEV_JWT === 'string' ? env.PARIS_DEV_JWT : '')).trim();
  return token || null;
}

type KeepLiveInstanceRow = {
  public_id?: string | null;
  workspace_id?: string | null;
  status?: string | null;
  config?: unknown;
};

function buildTierDropLocalePolicy(args: {
  workspace: WorkspaceRow;
  policy: Policy;
}): { localePolicy: LocalePolicy; invalidWorkspaceLocales: string | null } {
  const workspaceL10nPolicy = resolveWorkspaceL10nPolicy(args.workspace.l10n_policy);
  const baseLocale = workspaceL10nPolicy.baseLocale;
  const publishLocales = resolveActivePublishLocales({
    workspaceLocales: args.workspace.l10n_locales,
    policy: args.policy,
    baseLocale,
  });
  const availableLocales = publishLocales.locales;

  const countryToLocale = Object.fromEntries(
    Object.entries(workspaceL10nPolicy.ip.countryToLocale).filter(([, locale]) => availableLocales.includes(locale)),
  );

  return {
    localePolicy: {
      baseLocale,
      availableLocales,
      ip: {
        enabled: workspaceL10nPolicy.ip.enabled,
        countryToLocale: workspaceL10nPolicy.ip.enabled ? countryToLocale : {},
      },
      switcher: {
        enabled: workspaceL10nPolicy.switcher.enabled,
      },
    },
    invalidWorkspaceLocales: publishLocales.invalidWorkspaceLocales,
  };
}

async function loadKeepLiveInstances(args: {
  env: Env;
  keepLivePublicIds: string[];
}): Promise<{ ok: true; rows: Array<{ publicId: string; workspaceId: string; config: Record<string, unknown> }> } | { ok: false; response: Response }> {
  if (args.keepLivePublicIds.length === 0) return { ok: true, rows: [] };
  const params = new URLSearchParams({
    select: 'public_id,workspace_id,status,config',
    public_id: `in.(${args.keepLivePublicIds.join(',')})`,
    limit: '1000',
  });
  const res = await supabaseFetch(args.env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = ((await res.json().catch(() => null)) as KeepLiveInstanceRow[] | null) ?? [];
  const out: Array<{ publicId: string; workspaceId: string; config: Record<string, unknown> }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const publicId = typeof row.public_id === 'string' ? row.public_id.trim() : '';
    if (!publicId || seen.has(publicId)) continue;
    seen.add(publicId);
    const workspaceId = typeof row.workspace_id === 'string' ? row.workspace_id.trim() : '';
    if (!workspaceId) {
      return {
        ok: false,
        response: ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.readFailed',
            detail: `keepLive instance missing workspace_id (${publicId})`,
          },
          500,
        ),
      };
    }
    const configRaw = row.config;
    if (!configRaw || typeof configRaw !== 'object' || Array.isArray(configRaw)) {
      return {
        ok: false,
        response: ckError(
          { kind: 'INTERNAL', reasonKey: 'coreui.errors.config.invalid', detail: `keepLive instance config invalid (${publicId})` },
          500,
        ),
      };
    }
    out.push({ publicId, workspaceId, config: configRaw as Record<string, unknown> });
  }

  const missing = args.keepLivePublicIds.filter((publicId) => !seen.has(publicId));
  if (missing.length > 0) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail: `keepLivePublicIds contains unknown publicId: ${missing[0]}`,
        },
        422,
      ),
    };
  }

  return { ok: true, rows: out };
}

async function enforceTierDropMirrorForKeptInstances(args: {
  env: Env;
  policy: Policy;
  keepLivePublicIds: string[];
}): Promise<{ ok: true; syncEnqueued: number; failed: string[]; failedDetails: Record<string, string> } | { ok: false; response: Response }> {
  if (args.keepLivePublicIds.length === 0) return { ok: true, syncEnqueued: 0, failed: [], failedDetails: {} };

  const seoGeoEntitled = args.policy.flags['embed.seoGeo.enabled'] === true;

  const keepRows = await loadKeepLiveInstances({ env: args.env, keepLivePublicIds: args.keepLivePublicIds });
  if (!keepRows.ok) return keepRows;

  const workspaceCache = new Map<string, WorkspaceRow | null>();

  const failed: string[] = [];
  const failedDetails: Record<string, string> = {};
  for (const row of keepRows.rows) {
    const publicId = row.publicId;

    let workspace = workspaceCache.get(row.workspaceId);
    if (workspace === undefined) {
      try {
        workspace = await loadWorkspaceById(args.env, row.workspaceId);
      } catch (error) {
        workspace = null;
        const detail = error instanceof Error ? error.message : String(error);
        console.error('[ParisWorker] workspace load failed (plan change)', { workspaceId: row.workspaceId, detail });
      }
      workspaceCache.set(row.workspaceId, workspace);
    }

    if (!workspace) {
      failed.push(publicId);
      failedDetails[publicId] = 'WORKSPACE_NOT_FOUND';
      continue;
    }

    const seoGeoConfigEnabled = Boolean((row.config as any)?.seoGeo?.enabled === true);
    const nextSeoGeo = seoGeoEntitled && seoGeoConfigEnabled;

    const { localePolicy, invalidWorkspaceLocales } = buildTierDropLocalePolicy({ workspace, policy: args.policy });
    if (invalidWorkspaceLocales) {
      console.warn('[ParisWorker] invalid workspace locales while enforcing plan change', { workspaceId: workspace.id, invalidWorkspaceLocales });
    }

    const enqueue = await enqueueTokyoMirrorJob(args.env, {
      v: 1,
      kind: 'enforce-live-surface',
      publicId,
      localePolicy,
      seoGeo: nextSeoGeo,
    });
    if (!enqueue.ok) {
      failed.push(publicId);
      failedDetails[publicId] = enqueue.error;
      console.error('[ParisWorker] tokyo enforce-live-surface enqueue failed (plan change)', { publicId, error: enqueue.error });
    }
  }

  return {
    ok: true,
    syncEnqueued: Math.max(0, keepRows.rows.length - failed.length),
    failed,
    failedDetails,
  };
}

async function ensureTokyoAssetIdentityIntegrity(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const tokyoBase = resolveTokyoMutableAssetBase(env);
  const tokyoToken = resolveTokyoServiceToken(env);
  if (!tokyoBase || !tokyoToken) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.assets.integrityUnavailable',
          detail: !tokyoBase ? 'TOKYO_BASE_URL missing' : 'TOKYO_DEV_JWT missing',
        },
        500,
      ),
    };
  }

  let res: Response;
  let payload:
    | {
        error?: { reasonKey?: string | null; detail?: string | null };
        accountId?: string;
        assetId?: string;
        integrity?: TokyoAssetIdentityIntegritySnapshot;
      }
    | null = null;
  try {
    const url = `${tokyoBase}/assets/integrity/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}`;
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokyoToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    payload = (await readJson(res)) as
      | {
          error?: { reasonKey?: string | null; detail?: string | null };
          accountId?: string;
          assetId?: string;
          integrity?: TokyoAssetIdentityIntegritySnapshot;
        }
      | null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.assets.integrityUnavailable',
          detail,
        },
        500,
      ),
    };
  }

  if (res.ok) return { ok: true };

  if (res.status === 404) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404) };
  }

  if (res.status === 409 && payload && typeof payload === 'object') {
    return {
      ok: false,
      response: json(payload as Record<string, unknown>, { status: 409 }),
    };
  }

  return {
    ok: false,
    response: ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.assets.integrityUnavailable',
        detail: JSON.stringify(payload),
      },
      500,
    ),
  };
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
    const localStage = String(env.ENV_STAGE || '').trim().toLowerCase() === 'local';
    if (localStage && isTrustedInternalServiceRequest(req, env)) {
      return null;
    }
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

async function loadWorkspaceIdsForAccount(env: Env, accountId: string): Promise<string[]> {
  const params = new URLSearchParams({
    select: 'id',
    account_id: `eq.${accountId}`,
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load workspaces for account (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json().catch(() => null)) as Array<{ id?: unknown }> | null;
  return (rows ?? [])
    .map((row) => (typeof row?.id === 'string' ? row.id : ''))
    .map((value) => value.trim())
    .filter(Boolean);
}

type AccountWorkspaceTierRow = { id?: unknown; tier?: unknown };

async function loadWorkspaceTiersForAccount(
  env: Env,
  accountId: string,
): Promise<Array<{ id: string; tier: WorkspaceTier }>> {
  const params = new URLSearchParams({
    select: 'id,tier',
    account_id: `eq.${accountId}`,
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load workspace tiers for account (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json().catch(() => null)) as AccountWorkspaceTierRow[] | null;
  const out: Array<{ id: string; tier: WorkspaceTier }> = [];
  (rows ?? []).forEach((row) => {
    const id = typeof row?.id === 'string' ? row.id.trim() : '';
    const tier = normalizeWorkspaceTier(row?.tier);
    if (!id || !tier) return;
    out.push({ id, tier });
  });
  return out;
}

type AccountNoticeRow = {
  notice_id: string;
  account_id: string;
  kind: string;
  status: 'open' | 'dismissed' | 'resolved';
  payload: unknown;
  email_pending: boolean;
  email_sent_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

async function createAccountNotice(args: {
  env: Env;
  accountId: string;
  kind: string;
  payload: Record<string, unknown>;
  emailPending: boolean;
}): Promise<{ ok: true; notice: AccountNoticeRow } | { ok: false; response: Response }> {
  const res = await supabaseFetch(args.env, `/rest/v1/account_notices`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      account_id: args.accountId,
      kind: args.kind,
      status: 'open',
      payload: args.payload,
      email_pending: args.emailPending,
    }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = (await res.json().catch(() => null)) as AccountNoticeRow[] | null;
  const notice = rows?.[0] ?? null;
  if (!notice?.notice_id) {
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'notice insert did not return a row' }, 500),
    };
  }
  return { ok: true, notice };
}

async function dismissAccountNotice(args: {
  env: Env;
  accountId: string;
  noticeId: string;
}): Promise<{ ok: true } | { ok: false; response: Response }> {
  const now = new Date().toISOString();
  const params = new URLSearchParams({
    notice_id: `eq.${args.noticeId}`,
    account_id: `eq.${args.accountId}`,
  });
  const res = await supabaseFetch(args.env, `/rest/v1/account_notices?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'dismissed', dismissed_at: now }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = (await res.json().catch(() => null)) as Array<{ notice_id?: string }> | null;
  if (!rows?.[0]?.notice_id) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.payload.invalid' }, 404) };
  }
  return { ok: true };
}

async function unpublishAccountInstances(args: {
  env: Env;
  accountId: string;
  keepLivePublicIds: string[];
}): Promise<
  | { ok: true; unpublished: string[]; tokyo: { deleteEnqueued: number; failed: string[] } }
  | { ok: false; response: Response }
> {
  const keepSet = new Set(args.keepLivePublicIds);

  try {
    const workspaceIds = await loadWorkspaceIdsForAccount(args.env, args.accountId);
    if (workspaceIds.length === 0) {
      return { ok: true, unpublished: [], tokyo: { deleteEnqueued: 0, failed: [] } };
    }

    const publishedRows = await loadPagedRows<WorkspaceInstanceRow>({
      env: args.env,
      table: 'widget_instances',
      baseParams: {
        select: 'public_id,workspace_id,status,created_at',
        workspace_id: `in.(${workspaceIds.join(',')})`,
        status: 'eq.published',
        order: 'created_at.desc',
      },
    });
    const publishedPublicIds = publishedRows
      .map((row) => (typeof row.public_id === 'string' ? row.public_id.trim() : ''))
      .filter(Boolean);
    const publishedSet = new Set(publishedPublicIds);

    const invalidKeeps = args.keepLivePublicIds.filter((publicId) => !publishedSet.has(publicId));
    if (invalidKeeps.length > 0) {
      return {
        ok: false,
        response: ckError(
          {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: `keepLivePublicIds contains unknown or non-live publicId: ${invalidKeeps[0]}`,
          },
          422,
        ),
      };
    }

    const toUnpublish = publishedPublicIds.filter((publicId) => !keepSet.has(publicId));
    if (toUnpublish.length === 0) {
      return { ok: true, unpublished: [], tokyo: { deleteEnqueued: 0, failed: [] } };
    }

    const patchParams = new URLSearchParams({
      public_id: `in.(${toUnpublish.join(',')})`,
      workspace_id: `in.(${workspaceIds.join(',')})`,
    });
    const patchRes = await supabaseFetch(args.env, `/rest/v1/widget_instances?${patchParams.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'unpublished' }),
    });
    if (!patchRes.ok) {
      const details = await readJson(patchRes);
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
      };
    }

    const failed: string[] = [];
    for (const publicId of toUnpublish) {
      const enqueue = await enqueueTokyoMirrorJob(args.env, { v: 1, kind: 'delete-instance-mirror', publicId });
      if (!enqueue.ok) {
        failed.push(publicId);
        console.error('[ParisWorker] tokyo delete-instance-mirror enqueue failed', enqueue.error);
      }
    }

    return {
      ok: true,
      unpublished: toUnpublish,
      tokyo: {
        deleteEnqueued: Math.max(0, toUnpublish.length - failed.length),
        failed,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500) };
  }
}

async function purgeAccountAssets(args: {
  env: Env;
  accountId: string;
}): Promise<{ ok: true; tokyo: Record<string, unknown> } | { ok: false; response: Response }> {
  try {
    const tokyoBase = resolveTokyoMutableAssetBase(args.env);
    if (!tokyoBase) {
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'TOKYO_BASE_URL missing' }, 500),
      };
    }

    const tokyoToken = resolveTokyoServiceToken(args.env);
    if (!tokyoToken) {
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'TOKYO_DEV_JWT missing' }, 500),
      };
    }

    const tokyoUrl = new URL(`${tokyoBase}/assets/purge/${encodeURIComponent(args.accountId)}`);
    tokyoUrl.searchParams.set('confirm', '1');
    const tokyoRes = await fetch(tokyoUrl.toString(), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokyoToken}`,
        accept: 'application/json',
        'x-clickeen-surface': 'roma-assets',
      },
      cache: 'no-store',
    });
    const tokyoBody = await readJson(tokyoRes);
    if (!tokyoRes.ok) {
      return {
        ok: false,
        response: json(
          (tokyoBody && typeof tokyoBody === 'object'
            ? (tokyoBody as Record<string, unknown>)
            : {
                error: {
                  kind: 'INTERNAL',
                  reasonKey: 'coreui.errors.db.writeFailed',
                  detail: JSON.stringify(tokyoBody),
                },
              }) as Record<string, unknown>,
          { status: tokyoRes.status },
        ),
      };
    }
    return { ok: true, tokyo: (tokyoBody && typeof tokyoBody === 'object' ? (tokyoBody as Record<string, unknown>) : { ok: true }) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500) };
  }
}

async function updateAccountWorkspaceTier(args: {
  env: Env;
  accountId: string;
  nextTier: WorkspaceTier;
}): Promise<{ ok: true; updated: number } | { ok: false; response: Response }> {
  const params = new URLSearchParams({
    account_id: `eq.${args.accountId}`,
  });
  const res = await supabaseFetch(args.env, `/rest/v1/workspaces?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ tier: args.nextTier }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = (await res.json().catch(() => null)) as Array<{ id?: string }> | null;
  return { ok: true, updated: rows?.length ?? 0 };
}

function selectDefaultKeepLivePublicIds(args: {
  publishedRows: WorkspaceInstanceRow[];
  maxPublishedPerWorkspace: number;
}): string[] {
  const max = Math.max(0, Math.floor(args.maxPublishedPerWorkspace));
  if (max <= 0) return [];

  const countsByWorkspace = new Map<string, number>();
  const keep: string[] = [];
  for (const row of args.publishedRows) {
    const publicId = typeof row.public_id === 'string' ? row.public_id.trim() : '';
    const workspaceId = typeof row.workspace_id === 'string' ? row.workspace_id.trim() : '';
    if (!publicId || !workspaceId) continue;

    const count = countsByWorkspace.get(workspaceId) ?? 0;
    if (count >= max) continue;
    countsByWorkspace.set(workspaceId, count + 1);
    keep.push(publicId);
  }
  return keep;
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

  const rows = await loadPagedRows<AccountAssetVariantRow>({
    env,
    table: 'account_asset_variants',
    baseParams: {
      select: 'asset_id,variant,r2_key,filename,content_type,size_bytes,created_at',
      account_id: `eq.${accountId}`,
      asset_id: `in.(${assetIds.join(',')})`,
      order: 'created_at.desc',
    },
  });
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

  const rows = await loadPagedRows<AccountAssetUsageRow>({
    env,
    table: 'account_asset_usage',
    baseParams: {
      select: 'account_id,asset_id,public_id,config_path,created_at,updated_at',
      account_id: `eq.${accountId}`,
      asset_id: `in.(${assetIds.join(',')})`,
      order: 'updated_at.desc',
    },
  });
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
  const rows = await loadPagedRows<{ public_id?: string }>({
    env,
    table: 'widget_instances',
    baseParams: {
      select: 'public_id',
      workspace_id: `eq.${workspaceId}`,
      order: 'public_id.asc',
    },
  });
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

export async function handleAccountAssetsPurge(req: Request, env: Env, accountIdRaw: string) {
  const surfaceError = requireRomaAssetSurface(req);
  if (surfaceError) return surfaceError;

  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;

  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const ownerError = await authorizeAccountAccess(req, env, accountId, auth, 'editor');
  if (ownerError) return ownerError;

  const confirmRaw = (new URL(req.url).searchParams.get('confirm') || '').trim().toLowerCase();
  const confirmed = confirmRaw === '1' || confirmRaw === 'true' || confirmRaw === 'yes';
  if (!confirmed) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.errors.account.assetsPurgeConfirmRequired',
        detail: 'confirm=1 is required to purge all account assets.',
      },
      409,
    );
  }

  try {
    const account = await loadAccount(env, accountId);
    if (!account) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404);

    const purged = await purgeAccountAssets({ env, accountId });
    if (!purged.ok) return purged.response;

    return json({ ok: true, accountId, tokyo: purged.tokyo });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
}

export async function handleAccountInstancesUnpublish(req: Request, env: Env, accountIdRaw: string) {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;

  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const ownerError = await authorizeAccountAccess(req, env, accountId, auth, 'editor');
  if (ownerError) return ownerError;

  const confirmRaw = (new URL(req.url).searchParams.get('confirm') || '').trim().toLowerCase();
  const confirmed = confirmRaw === '1' || confirmRaw === 'true' || confirmRaw === 'yes';
  if (!confirmed) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.errors.account.instancesUnpublishConfirmRequired',
        detail: 'confirm=1 is required to unpublish instances for an account.',
      },
      409,
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const keepLivePublicIds = normalizePublicIdList((payload as any).keepLivePublicIds);

  const result = await unpublishAccountInstances({ env, accountId, keepLivePublicIds });
  if (!result.ok) return result.response;
  return json({ ok: true, accountId, kept: keepLivePublicIds, unpublished: result.unpublished, tokyo: result.tokyo });
}

export async function handleAccountNoticeDismiss(
  req: Request,
  env: Env,
  accountIdRaw: string,
  noticeIdRaw: string,
) {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;

  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const noticeIdResult = assertNoticeId(noticeIdRaw);
  if (!noticeIdResult.ok) return noticeIdResult.response;
  const noticeId = noticeIdResult.value;

  const ownerError = await authorizeAccountAccess(req, env, accountId, auth, 'viewer');
  if (ownerError) return ownerError;

  const dismissed = await dismissAccountNotice({ env, accountId, noticeId });
  if (!dismissed.ok) return dismissed.response;
  return json({ ok: true, accountId, noticeId });
}

export async function handleAccountLifecyclePlanChange(req: Request, env: Env, accountIdRaw: string) {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;

  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const ownerError = await authorizeAccountAccess(req, env, accountId, auth, 'owner');
  if (ownerError) return ownerError;

  const confirmRaw = (new URL(req.url).searchParams.get('confirm') || '').trim().toLowerCase();
  const confirmed = confirmRaw === '1' || confirmRaw === 'true' || confirmRaw === 'yes';
  if (!confirmed) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'confirm=1 is required to apply a plan change.',
      },
      409,
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const nextTier = normalizeWorkspaceTier((payload as any).nextTier);
  if (!nextTier) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const keepLivePublicIdsRaw = (payload as any).keepLivePublicIds;
  const keepLivePublicIdsInput = keepLivePublicIdsRaw === undefined ? null : normalizePublicIdList(keepLivePublicIdsRaw);

  try {
    const workspaces = await loadWorkspaceTiersForAccount(env, accountId);
    if (workspaces.length === 0) {
      return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.workspace.notFound' }, 404);
    }

    const prevHighestTier = workspaces.reduce<WorkspaceTier>((best, workspace) => {
      return tierRank(workspace.tier) > tierRank(best) ? workspace.tier : best;
    }, 'free');

    const tierUpdated = await updateAccountWorkspaceTier({ env, accountId, nextTier });
    if (!tierUpdated.ok) return tierUpdated.response;

    const isTierDrop = tierRank(nextTier) < tierRank(prevHighestTier);

    let keepLivePublicIds: string[] = [];
    let unpublished: string[] = [];
    let tokyo = { deleteEnqueued: 0, failed: [] as string[] };
    let tokyoResync = { syncEnqueued: 0, failed: [] as string[], failedDetails: {} as Record<string, string> };

    if (isTierDrop) {
      const policy = resolvePolicy({ profile: nextTier, role: 'owner' });
      const maxPublished = policy.caps['instances.published.max'];

      if (maxPublished == null) {
        keepLivePublicIds = [];
      } else if (!Number.isFinite(maxPublished) || maxPublished < 0) {
        return ckError(
          { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'instances.published.max invalid' },
          500,
        );
      } else if (keepLivePublicIdsInput) {
        if (keepLivePublicIdsInput.length > maxPublished) {
          return ckError(
            {
              kind: 'VALIDATION',
              reasonKey: 'coreui.errors.payload.invalid',
              detail: `keepLivePublicIds exceeds instances.published.max (${maxPublished})`,
            },
            422,
          );
        }
        keepLivePublicIds = keepLivePublicIdsInput;
      } else {
        const workspaceIds = workspaces.map((w) => w.id);
        const publishedRows = await loadPagedRows<WorkspaceInstanceRow>({
          env,
          table: 'widget_instances',
          baseParams: {
            select: 'public_id,workspace_id,status,created_at',
            workspace_id: `in.(${workspaceIds.join(',')})`,
            status: 'eq.published',
            order: 'created_at.desc',
          },
        });
        keepLivePublicIds = selectDefaultKeepLivePublicIds({
          publishedRows,
          maxPublishedPerWorkspace: maxPublished,
        });
      }

      if (maxPublished != null) {
        const unpublish = await unpublishAccountInstances({ env, accountId, keepLivePublicIds });
        if (!unpublish.ok) return unpublish.response;
        unpublished = unpublish.unpublished;
        tokyo = unpublish.tokyo;
      }

      if (keepLivePublicIds.length > 0) {
        const mirror = await enforceTierDropMirrorForKeptInstances({
          env,
          policy,
          keepLivePublicIds,
        });
        if (!mirror.ok) return mirror.response;
        tokyoResync = { syncEnqueued: mirror.syncEnqueued, failed: mirror.failed, failedDetails: mirror.failedDetails };
      }
    }

    let assetsPurged = false;
    if (isTierDrop && nextTier === 'free') {
      const purged = await purgeAccountAssets({ env, accountId });
      if (!purged.ok) return purged.response;
      assetsPurged = true;
    }

    if (!isTierDrop) {
      return json({
        ok: true,
        accountId,
        fromTier: prevHighestTier,
        toTier: nextTier,
        isTierDrop: false,
        workspacesUpdated: tierUpdated.updated,
      });
    }

    const noticePayload: Record<string, unknown> = {
      fromTier: prevHighestTier,
      toTier: nextTier,
      workspacesUpdated: tierUpdated.updated,
      enforcement: {
        keptLivePublicIds: keepLivePublicIds,
        unpublishedCount: unpublished.length,
        assetsPurged,
        tokyoResync,
      },
    };
    const notice = await createAccountNotice({
      env,
      accountId,
      kind: 'tier_drop',
      payload: noticePayload,
      emailPending: true,
    });
    if (!notice.ok) return notice.response;

    return json({
      ok: true,
      accountId,
      noticeId: notice.notice.notice_id,
      fromTier: prevHighestTier,
      toTier: nextTier,
      isTierDrop: true,
      keptLivePublicIds: keepLivePublicIds,
      unpublished,
      tokyo,
      tokyoResync,
      assetsPurged,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
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

    const integrity = await ensureTokyoAssetIdentityIntegrity(env, accountId, assetId);
    if (!integrity.ok) return integrity.response;

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
  const surfaceError = requireRomaAssetSurface(req);
  if (surfaceError) return surfaceError;
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
          'x-clickeen-surface': 'roma-assets',
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

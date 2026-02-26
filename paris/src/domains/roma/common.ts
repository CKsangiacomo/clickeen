import {
  BUDGET_KEYS,
  resolveAiAgent,
  resolveAiPolicyCapsule,
  resolvePolicy,
  resolveWidgetCopilotRequestedAgentId,
} from '@clickeen/ck-policy';
import type { MemberRole } from '@clickeen/ck-policy';
import type { Env, WorkspaceRow } from '../../shared/types';
import { assertDevAuth, assertSupabaseAuth } from '../../shared/auth';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import {
  mintRomaAccountAuthzCapsule,
  mintRomaWorkspaceAuthzCapsule,
  readRomaAccountAuthzCapsuleHeader,
  verifyRomaAccountAuthzCapsule,
} from '../../shared/authz-capsule';
import { readBudgetUsed } from '../../shared/budgets';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, assertConfig, isUuid } from '../../shared/validation';
import { authorizeWorkspace as authorizeWorkspaceAccess } from '../../shared/workspace-auth';
import {
  AssetUsageValidationError,
  syncAccountAssetUsageForInstance,
  validateAccountAssetUsageForInstance,
} from '../../shared/assetUsage';
import {
  allowCuratedWrites,
  assertPublicId,
  assertWidgetType,
  isCuratedPublicId,
} from '../../shared/instances';
import {
  loadInstanceByPublicId,
  loadInstanceByWorkspaceAndPublicId,
  loadWidgetByType,
  resolveWidgetTypeForInstance,
} from '../instances';
import { resolveIdentityMePayload } from '../identity';
import { handleWorkspaceCreateInstance } from '../workspaces';

type AccountRow = {
  id: string;
  status: string;
  is_platform: boolean;
};

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkspaceMemberListRow = {
  user_id: string;
  role: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type AccountWorkspaceRow = {
  id: string;
  account_id: string;
  tier: WorkspaceRow['tier'];
  name: string;
  slug: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type InstanceListRow = {
  public_id: string;
  status: 'published' | 'unpublished';
  workspace_id: string;
};

type AccountAssetRow = {
  asset_id: string;
  size_bytes: number;
};

type AccountAssetListBootstrapRow = {
  asset_id: string;
  normalized_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

type AccountAssetUsageCountRow = {
  asset_id: string;
};

type RomaAssetsIntegritySnapshot = {
  ok: boolean;
  reasonKey: string | null;
  dbVariantCount: number;
  r2ObjectCount: number;
  missingInR2Count: number;
  orphanInR2Count: number;
  missingInR2: Array<{ assetId: string; r2Key: string }>;
  orphanInR2: string[];
};

type WorkspaceWidgetInstanceRow = {
  public_id: string;
  display_name?: string | null;
  workspace_id: string;
  widget_id: string | null;
};

type WidgetLookupRow = {
  id: string;
  type: string | null;
  name: string | null;
};

type CuratedWidgetInstanceListRow = {
  public_id: string;
  widget_type: string | null;
  meta: unknown;
  owner_account_id?: string | null;
};

type RomaWidgetsInstancePayload = {
  publicId: string;
  widgetType: string;
  displayName: string;
  workspaceId: string | null;
  source: 'workspace' | 'curated';
  actions: {
    edit: boolean;
    duplicate: boolean;
    delete: boolean;
  };
};

type AccountEntitlementsSnapshot = {
  flags: Record<string, boolean>;
  caps: Record<string, number | null>;
  budgets: Record<string, { max: number | null; used: number }>;
};

type RomaBootstrapDomainsPayload = {
  widgets: {
    accountId: string;
    workspaceId: string;
    widgetTypes: string[];
    instances: Array<{
      publicId: string;
      widgetType: string;
      displayName: string;
      workspaceId: string | null;
      source: 'workspace' | 'curated';
      actions: {
        edit: boolean;
        duplicate: boolean;
        delete: boolean;
      };
    }>;
  };
  templates: {
    accountId: string;
    workspaceId: string;
    widgetTypes: string[];
    instances: Array<{
      publicId: string;
      widgetType: string;
      displayName: string;
    }>;
  };
  assets: {
    accountId: string;
    workspaceId: string | null;
    assets: Array<{
      assetId: string;
      normalizedFilename: string;
      contentType: string;
      sizeBytes: number;
      usageCount: number;
      createdAt: string;
    }>;
    integrity: RomaAssetsIntegritySnapshot;
  };
  team: {
    workspaceId: string;
    role: string;
    members: Array<{
      userId: string;
      role: string;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  };
  billing: {
    accountId: string;
    role: string;
    provider: string;
    status: string;
    reasonKey: string;
    plan: {
      inferredTier: string;
      workspaceCount: number;
    };
    checkoutAvailable: boolean;
    portalAvailable: boolean;
  };
  usage: {
    accountId: string;
    role: string;
    usage: {
      workspaces: number;
      instances: {
        total: number;
        published: number;
        unpublished: number;
      };
      assets: {
        total: number;
        active: number;
        bytesActive: number;
      };
    };
  };
  settings: {
    accountSummary: {
      accountId: string;
      status: string;
      role: string;
      workspaceCount: number;
    };
    workspaceSummary: {
      workspaceId: string;
      accountId: string;
      tier: string;
      name: string;
      slug: string;
      role: string;
    };
    accountWorkspaces: Array<{
      workspaceId: string;
      accountId: string;
      tier: string;
      name: string;
      slug: string;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  };
};

const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';
const ROMA_AUTHZ_CAPSULE_TTL_SEC = 15 * 60;
const ROMA_WIDGET_LOOKUP_CACHE_TTL_MS = 5 * 60_000;
const ROMA_WIDGET_LOOKUP_STORE_KEY = '__CK_PARIS_ROMA_WIDGET_LOOKUP_STORE_V1__';

function accountAssetValidationPaths(detail: string): string[] | undefined {
  const match = String(detail || '').match(/ at ([^:]+):/);
  const path = match?.[1]?.trim() || '';
  return path ? [path] : undefined;
}

async function syncAccountAssetUsageForInstanceStrict(args: {
  env: Env;
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
}): Promise<Response | null> {
  try {
    await syncAccountAssetUsageForInstance(args);
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (error instanceof AssetUsageValidationError) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail,
          paths: accountAssetValidationPaths(detail),
        },
        422,
      );
    }
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
}

async function rollbackCreatedWorkspaceInstanceOnUsageSyncFailure(args: {
  env: Env;
  workspaceId: string;
  publicId: string;
}): Promise<void> {
  const path = `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(args.publicId)}&workspace_id=eq.${encodeURIComponent(args.workspaceId)}`;
  const res = await supabaseFetch(args.env, path, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    const details = await readJson(res);
    console.error(
      `[ParisWorker] Failed to rollback Minibob instance after usage sync error (${res.status}): ${JSON.stringify(details)}`,
    );
  }
}

async function validateAccountAssetUsageForInstanceStrict(args: {
  env: Env;
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
}): Promise<Response | null> {
  try {
    await validateAccountAssetUsageForInstance(args);
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (error instanceof AssetUsageValidationError) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail,
          paths: accountAssetValidationPaths(detail),
        },
        422,
      );
    }
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
}

const ROMA_ASSET_BOOTSTRAP_PAGE_SIZE = 1000;
const ROMA_ASSET_USAGE_ID_CHUNK_SIZE = 200;

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

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [values];
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    out.push(values.slice(i, i + chunkSize));
  }
  return out;
}

async function loadPagedRows<T>(args: {
  env: Env;
  table: string;
  baseParams: Record<string, string>;
  pageSize?: number;
}): Promise<T[]> {
  const pageSize = args.pageSize ?? ROMA_ASSET_BOOTSTRAP_PAGE_SIZE;
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

async function loadAccountAssetsMirrorIntegrityForBootstrap(
  env: Env,
  accountId: string,
): Promise<RomaAssetsIntegritySnapshot> {
  const tokyoBase = resolveTokyoMutableAssetBase(env);
  const tokyoToken = resolveTokyoServiceToken(env);
  if (!tokyoBase || !tokyoToken) {
    return {
      ok: false,
      reasonKey: 'coreui.errors.assets.integrityUnavailable',
      dbVariantCount: 0,
      r2ObjectCount: 0,
      missingInR2Count: 0,
      orphanInR2Count: 0,
      missingInR2: [],
      orphanInR2: [],
    };
  }
  let res: Response;
  let payload:
    | {
        error?: { reasonKey?: string | null };
        integrity?: {
          ok?: boolean;
          dbVariantCount?: number;
          r2ObjectCount?: number;
          missingInR2Count?: number;
          orphanInR2Count?: number;
          missingInR2?: Array<{ assetId?: string; r2Key?: string }>;
          orphanInR2?: Array<string>;
        };
      }
    | null = null;
  try {
    const url = `${tokyoBase}/assets/integrity/${encodeURIComponent(accountId)}`;
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
          error?: { reasonKey?: string | null };
          integrity?: {
            ok?: boolean;
            dbVariantCount?: number;
            r2ObjectCount?: number;
            missingInR2Count?: number;
            orphanInR2Count?: number;
            missingInR2?: Array<{ assetId?: string; r2Key?: string }>;
            orphanInR2?: Array<string>;
          };
        }
      | null;
  } catch {
    return {
      ok: false,
      reasonKey: 'coreui.errors.assets.integrityUnavailable',
      dbVariantCount: 0,
      r2ObjectCount: 0,
      missingInR2Count: 0,
      orphanInR2Count: 0,
      missingInR2: [],
      orphanInR2: [],
    };
  }

  const integrity = payload?.integrity ?? null;
  const missingInR2 =
    Array.isArray(integrity?.missingInR2)
      ? integrity.missingInR2
          .map((entry) => ({
            assetId: String(entry?.assetId || '').trim(),
            r2Key: String(entry?.r2Key || '').trim(),
          }))
          .filter((entry) => entry.assetId && entry.r2Key)
      : [];
  const orphanInR2 =
    Array.isArray(integrity?.orphanInR2) ? integrity.orphanInR2.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
  const missingInR2Count =
    typeof integrity?.missingInR2Count === 'number' && Number.isFinite(integrity.missingInR2Count)
      ? Math.max(0, Math.trunc(integrity.missingInR2Count))
      : missingInR2.length;
  const orphanInR2Count =
    typeof integrity?.orphanInR2Count === 'number' && Number.isFinite(integrity.orphanInR2Count)
      ? Math.max(0, Math.trunc(integrity.orphanInR2Count))
      : orphanInR2.length;

  return {
    ok: res.ok && Boolean(integrity?.ok === true),
    reasonKey:
      res.ok && integrity?.ok === true
        ? null
        : String(payload?.error?.reasonKey || 'coreui.errors.assets.integrityMismatch'),
    dbVariantCount:
      typeof integrity?.dbVariantCount === 'number' && Number.isFinite(integrity.dbVariantCount)
        ? Math.max(0, Math.trunc(integrity.dbVariantCount))
        : 0,
    r2ObjectCount:
      typeof integrity?.r2ObjectCount === 'number' && Number.isFinite(integrity.r2ObjectCount)
        ? Math.max(0, Math.trunc(integrity.r2ObjectCount))
        : 0,
    missingInR2Count,
    orphanInR2Count,
    missingInR2,
    orphanInR2,
  };
}

async function loadWorkspaceMembersForBootstrap(env: Env, workspaceId: string): Promise<RomaBootstrapDomainsPayload['team']['members']> {
  const params = new URLSearchParams({
    select: 'user_id,role,created_at',
    workspace_id: `eq.${workspaceId}`,
    order: 'created_at.asc',
    limit: '500',
  });
  const membersRes = await supabaseFetch(env, `/rest/v1/workspace_members?${params.toString()}`, { method: 'GET' });
  if (!membersRes.ok) {
    const details = await readJson(membersRes);
    throw new Error(
      `[ParisWorker] Failed to load workspace members for bootstrap (${membersRes.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = ((await membersRes.json()) as WorkspaceMemberListRow[]) ?? [];
  return rows.map((row) => ({
    userId: row.user_id,
    role: normalizeRole(row.role) ?? row.role,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }));
}

async function loadAccountUsageAssetRowsForBootstrap(env: Env, accountId: string): Promise<AccountAssetRow[]> {
  return loadPagedRows<AccountAssetRow>({
    env,
    table: 'account_assets',
    baseParams: {
      select: 'asset_id,size_bytes',
      account_id: `eq.${accountId}`,
      order: 'created_at.asc',
    },
  });
}

async function loadAccountAssetUsageCountMapForBootstrap(
  env: Env,
  accountId: string,
  assetIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (assetIds.length === 0) return counts;

  const chunks = chunkValues(assetIds, ROMA_ASSET_USAGE_ID_CHUNK_SIZE);
  for (const chunk of chunks) {
    const rows = await loadPagedRows<AccountAssetUsageCountRow>({
      env,
      table: 'account_asset_usage',
      baseParams: {
        select: 'asset_id',
        account_id: `eq.${accountId}`,
        asset_id: `in.(${chunk.join(',')})`,
      },
    });
    rows.forEach((row) => {
      const assetId = asTrimmedString(row.asset_id);
      if (!assetId) return;
      counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
    });
  }
  return counts;
}

async function loadAccountAssetsForBootstrap(
  env: Env,
  accountId: string,
): Promise<{
  assets: RomaBootstrapDomainsPayload['assets']['assets'];
  integrity: RomaAssetsIntegritySnapshot;
}> {
  const rows = await loadPagedRows<AccountAssetListBootstrapRow>({
    env,
    table: 'account_assets',
    baseParams: {
      select: 'asset_id,normalized_filename,content_type,size_bytes,created_at',
      account_id: `eq.${accountId}`,
      order: 'created_at.desc',
    },
  });
  const assetIds = rows.map((row) => asTrimmedString(row.asset_id)).filter((assetId): assetId is string => Boolean(assetId));
  const [usageCountMap, integrity] = await Promise.all([
    loadAccountAssetUsageCountMapForBootstrap(env, accountId, assetIds),
    loadAccountAssetsMirrorIntegrityForBootstrap(env, accountId),
  ]);
  const assets = rows.map((row) => {
    const assetId = asTrimmedString(row.asset_id) || '';
    return {
      assetId,
      normalizedFilename: row.normalized_filename,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      usageCount: usageCountMap.get(assetId) ?? 0,
      createdAt: row.created_at,
    };
  });
  return { assets, integrity };
}

type RomaWidgetLookupCacheEntry = {
  widgetType: string;
  expiresAt: number;
};

type RomaWidgetLookupStore = {
  cache: Record<string, RomaWidgetLookupCacheEntry | undefined>;
};

type IdempotencyRecord = {
  v: 1;
  status: number;
  body: unknown;
  createdAt: string;
};

type BootstrapOwnerRecord = {
  v: 1;
  userId: string;
  createdAt: string;
};

type MinibobHandoffStateRecord = {
  v: 1;
  handoffId: string;
  sourcePublicId: string;
  widgetType: string;
  widgetId: string;
  config: Record<string, unknown>;
  status: 'pending' | 'consumed';
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedByUserId?: string;
  consumedAccountId?: string;
  consumedWorkspaceId?: string;
  resultPublicId?: string;
};

type AccountAuthzResult =
  | {
      ok: true;
      auth: { source: 'dev' | 'supabase'; principal?: { userId: string } };
      account: AccountRow;
      role: MemberRole;
    }
  | {
      ok: false;
      response: Response;
    };

const ROMA_APP_IDEMPOTENCY_TTL_SEC = 60 * 60 * 24;
const ROMA_APP_BOOTSTRAP_TTL_SEC = 60 * 60 * 24 * 7;
const MINIBOB_HANDOFF_STATE_TTL_SEC = 60 * 60 * 24 * 7;
const MINIBOB_HANDOFF_MAX_CONFIG_BYTES = 7000;

function isRomaWidgetLookupStore(value: unknown): value is RomaWidgetLookupStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cache = record.cache;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;
  return true;
}

function resolveRomaWidgetLookupStore(): RomaWidgetLookupStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[ROMA_WIDGET_LOOKUP_STORE_KEY];
  if (isRomaWidgetLookupStore(existing)) return existing;
  const next: RomaWidgetLookupStore = { cache: {} };
  scope[ROMA_WIDGET_LOOKUP_STORE_KEY] = next;
  return next;
}

function requireRomaAppKv(env: Env): { ok: true; kv: KVNamespace } | { ok: false; response: Response } {
  if (!env.USAGE_KV) {
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.idempotency.unavailable' }, 503),
    };
  }
  return { ok: true, kv: env.USAGE_KV };
}

async function kvGetJson<T extends object>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvPutJson(kv: KVNamespace, key: string, value: object, expirationTtl: number): Promise<void> {
  await kv.put(key, JSON.stringify(value), { expirationTtl });
}

function requireIdempotencyKey(req: Request): { ok: true; value: string } | { ok: false; response: Response } {
  const key = (req.headers.get('Idempotency-Key') || '').trim();
  if (!key) {
    return {
      ok: false,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.idempotencyKey.required' }, 422),
    };
  }
  if (key.length < 8 || key.length > 200 || !/^[A-Za-z0-9_.:-]+$/.test(key)) {
    return {
      ok: false,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.idempotencyKey.invalid' }, 422),
    };
  }
  return { ok: true, value: key };
}

function parseBodyAsRecord(value: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; response: Response } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

function sanitizeWorkspaceName(value: unknown): { ok: true; value: string } | { ok: false; response: Response } {
  const name = asTrimmedString(value);
  if (!name) return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspace.name.required' }, 422) };
  if (name.length < 2 || name.length > 80) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspace.name.invalid' }, 422) };
  }
  return { ok: true, value: name };
}

function slugifyWorkspaceName(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'workspace';
}

function createUserInstancePublicId(widgetType: string): string {
  const normalized = widgetType
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const stem = normalized || 'instance';
  const suffix = `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  return `wgt_${stem}_u_${suffix}`;
}

function sanitizeWorkspaceSlug(raw: unknown, fallbackName: string): { ok: true; value: string } | { ok: false; response: Response } {
  const fromInput = asTrimmedString(raw);
  const candidate = fromInput ? slugifyWorkspaceName(fromInput) : slugifyWorkspaceName(fallbackName);
  if (!candidate || candidate.length > 64 || !/^[a-z0-9][a-z0-9_-]*$/.test(candidate)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspace.slug.invalid' }, 422) };
  }
  return { ok: true, value: candidate };
}

function assertHandoffId(value: unknown): { ok: true; value: string } | { ok: false; response: Response } {
  const handoffId = asTrimmedString(value);
  if (!handoffId || !/^mbh_[a-z0-9]{16,64}$/.test(handoffId)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.minibobHandoff.idInvalid' }, 422) };
  }
  return { ok: true, value: handoffId };
}

function resolveMinibobHandoffStateKey(handoffId: string): string {
  return `roma:minibob:handoff:state:${handoffId}`;
}

async function resolveMinibobHandoffSnapshot(args: {
  env: Env;
  sourcePublicId: string;
  widgetTypeHint?: string;
  draftConfig?: Record<string, unknown>;
}): Promise<
  | {
      ok: true;
      sourcePublicId: string;
      widgetType: string;
      widgetId: string;
      config: Record<string, unknown>;
    }
  | { ok: false; response: Response }
> {
  const sourcePublicIdResult = assertPublicId(args.sourcePublicId);
  if (!sourcePublicIdResult.ok) {
    return { ok: false, response: sourcePublicIdResult.response };
  }
  const sourcePublicId = sourcePublicIdResult.value;
  if (!isCuratedPublicId(sourcePublicId)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  const sourceInstance =
    args.widgetTypeHint && args.draftConfig
      ? null
      : await loadInstanceByPublicId(args.env, sourcePublicId).catch(() => null);
  if (!sourceInstance && !args.draftConfig) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404) };
  }

  const resolvedWidgetType =
    args.widgetTypeHint ||
    (sourceInstance && 'widget_type' in sourceInstance ? asTrimmedString(sourceInstance.widget_type) : null);
  const widgetTypeResult = assertWidgetType(resolvedWidgetType);
  if (!widgetTypeResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422) };
  }
  const widgetType = widgetTypeResult.value;
  const widget = await loadWidgetByType(args.env, widgetType).catch(() => null);
  if (!widget?.id || !isUuid(widget.id)) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.widget.notFound' }, 404) };
  }

  const configCandidate =
    args.draftConfig ??
    (sourceInstance && 'config' in sourceInstance ? (sourceInstance.config as Record<string, unknown>) : null);
  const configResult = assertConfig(configCandidate);
  if (!configResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }
  const serializedConfig = JSON.stringify(configResult.value);
  if (serializedConfig.length > MINIBOB_HANDOFF_MAX_CONFIG_BYTES) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  return {
    ok: true,
    sourcePublicId,
    widgetType,
    widgetId: widget.id,
    config: JSON.parse(serializedConfig) as Record<string, unknown>,
  };
}

function roleRank(role: MemberRole): number {
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

function normalizeRole(value: unknown): MemberRole | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'owner' || raw === 'admin' || raw === 'editor' || raw === 'viewer') {
    return raw;
  }
  return null;
}

function normalizeWorkspaceTier(value: unknown): WorkspaceRow['tier'] | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'free' || raw === 'tier1' || raw === 'tier2' || raw === 'tier3') {
    return raw;
  }
  return null;
}

function deriveHighestRole(roles: MemberRole[]): MemberRole | null {
  if (roles.length === 0) return null;
  let best: MemberRole = roles[0];
  for (const role of roles) {
    if (roleRank(role) > roleRank(best)) best = role;
  }
  return best;
}

function assertAccountId(value: string): { ok: true; value: string } | { ok: false; response: Response } {
  const accountId = String(value || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' }, 422) };
  }
  return { ok: true, value: accountId };
}

function assertWorkspaceId(value: string): { ok: true; value: string } | { ok: false; response: Response } {
  const workspaceId = String(value || '').trim();
  if (!workspaceId || !isUuid(workspaceId)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' }, 422) };
  }
  return { ok: true, value: workspaceId };
}

export type {
  AccountAssetListBootstrapRow,
  AccountAssetRow,
  AccountAssetUsageCountRow,
  AccountAuthzResult,
  AccountEntitlementsSnapshot,
  AccountRow,
  AccountWorkspaceRow,
  BootstrapOwnerRecord,
  CuratedWidgetInstanceListRow,
  IdempotencyRecord,
  InstanceListRow,
  MinibobHandoffStateRecord,
  RomaBootstrapDomainsPayload,
  RomaWidgetsInstancePayload,
  WidgetLookupRow,
  WorkspaceMemberListRow,
  WorkspaceMembershipRow,
  WorkspaceWidgetInstanceRow,
};

export {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  MINIBOB_HANDOFF_MAX_CONFIG_BYTES,
  MINIBOB_HANDOFF_STATE_TTL_SEC,
  ROMA_APP_BOOTSTRAP_TTL_SEC,
  ROMA_APP_IDEMPOTENCY_TTL_SEC,
  ROMA_AUTHZ_CAPSULE_TTL_SEC,
  ROMA_WIDGET_LOOKUP_CACHE_TTL_MS,
  accountAssetValidationPaths,
  assertAccountId,
  assertHandoffId,
  assertWorkspaceId,
  createUserInstancePublicId,
  deriveHighestRole,
  isRomaWidgetLookupStore,
  kvGetJson,
  kvPutJson,
  loadAccountAssetsForBootstrap,
  loadAccountAssetUsageCountMapForBootstrap,
  loadAccountUsageAssetRowsForBootstrap,
  loadWorkspaceMembersForBootstrap,
  normalizeRole,
  normalizeWorkspaceTier,
  parseBodyAsRecord,
  requireIdempotencyKey,
  requireRomaAppKv,
  resolveMinibobHandoffSnapshot,
  resolveMinibobHandoffStateKey,
  resolveRomaWidgetLookupStore,
  roleRank,
  rollbackCreatedWorkspaceInstanceOnUsageSyncFailure,
  sanitizeWorkspaceName,
  sanitizeWorkspaceSlug,
  slugifyWorkspaceName,
  syncAccountAssetUsageForInstanceStrict,
  validateAccountAssetUsageForInstanceStrict,
};

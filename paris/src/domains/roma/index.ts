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
  deleted_at?: string | null;
};

type AccountAssetListBootstrapRow = {
  asset_id: string;
  normalized_filename: string;
  content_type: string;
  size_bytes: number;
  deleted_at?: string | null;
  created_at: string;
};

type AccountAssetUsageCountRow = {
  asset_id: string;
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
      deletedAt: string | null;
      createdAt: string;
    }>;
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
      isPlatform: boolean;
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
  const assetParams = new URLSearchParams({
    select: 'asset_id,size_bytes,deleted_at',
    account_id: `eq.${accountId}`,
    limit: '5000',
  });
  const assetRes = await supabaseFetch(env, `/rest/v1/account_assets?${assetParams.toString()}`, { method: 'GET' });
  if (!assetRes.ok) {
    const details = await readJson(assetRes);
    throw new Error(
      `[ParisWorker] Failed to load account usage assets for bootstrap (${assetRes.status}): ${JSON.stringify(details)}`,
    );
  }
  return ((await assetRes.json()) as AccountAssetRow[]) ?? [];
}

async function loadAccountAssetUsageCountMapForBootstrap(
  env: Env,
  accountId: string,
  assetIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (assetIds.length === 0) return counts;

  const params = new URLSearchParams({
    select: 'asset_id',
    account_id: `eq.${accountId}`,
    asset_id: `in.(${assetIds.join(',')})`,
    limit: '5000',
  });
  const usageRes = await supabaseFetch(env, `/rest/v1/account_asset_usage?${params.toString()}`, { method: 'GET' });
  if (!usageRes.ok) {
    const details = await readJson(usageRes);
    throw new Error(
      `[ParisWorker] Failed to load account asset usage counts for bootstrap (${usageRes.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = ((await usageRes.json()) as AccountAssetUsageCountRow[]) ?? [];
  rows.forEach((row) => {
    const assetId = asTrimmedString(row.asset_id);
    if (!assetId) return;
    counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
  });
  return counts;
}

async function loadAccountAssetsForBootstrap(env: Env, accountId: string): Promise<RomaBootstrapDomainsPayload['assets']['assets']> {
  const params = new URLSearchParams({
    select: 'asset_id,normalized_filename,content_type,size_bytes,deleted_at,created_at',
    account_id: `eq.${accountId}`,
    deleted_at: 'is.null',
    order: 'created_at.desc',
    limit: '200',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_assets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account assets for bootstrap (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await res.json()) as AccountAssetListBootstrapRow[]) ?? [];
  const assetIds = rows.map((row) => asTrimmedString(row.asset_id)).filter((assetId): assetId is string => Boolean(assetId));
  const usageCountMap = await loadAccountAssetUsageCountMapForBootstrap(env, accountId, assetIds);
  return rows.map((row) => {
    const assetId = asTrimmedString(row.asset_id) || '';
    return {
      assetId,
      normalizedFilename: row.normalized_filename,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      usageCount: usageCountMap.get(assetId) ?? 0,
      deletedAt: row.deleted_at ?? null,
      createdAt: row.created_at,
    };
  });
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

async function loadAccountWorkspaces(env: Env, accountId: string): Promise<AccountWorkspaceRow[]> {
  const params = new URLSearchParams({
    select: 'id,account_id,tier,name,slug,created_at,updated_at',
    account_id: `eq.${accountId}`,
    order: 'created_at.asc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account workspaces (${res.status}): ${JSON.stringify(details)}`);
  }
  return ((await res.json()) as AccountWorkspaceRow[]) ?? [];
}

function normalizeWidgetTypeLabel(value: unknown): string {
  const widgetType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return widgetType || 'unknown';
}

function readCuratedMeta(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function formatCuratedDisplayName(meta: Record<string, unknown> | null, fallback: string): string {
  if (!meta) return fallback;
  const styleName = asTrimmedString(meta.styleName ?? meta.name ?? meta.title);
  if (!styleName) return fallback;
  return styleName;
}

async function loadKnownWidgetTypes(env: Env): Promise<string[]> {
  const params = new URLSearchParams({
    select: 'type',
    order: 'type.asc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load widget types (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await res.json()) as Array<{ type?: string | null }>) ?? [];
  return Array.from(
    new Set(
      rows
        .map((row) => normalizeWidgetTypeLabel(row?.type))
        .filter((type) => type !== 'unknown'),
    ),
  );
}

async function resolveWidgetTypesById(env: Env, widgetIds: string[]): Promise<Map<string, string>> {
  const store = resolveRomaWidgetLookupStore();
  const now = Date.now();
  const missing: string[] = [];
  const resolved = new Map<string, string>();

  widgetIds.forEach((rawId) => {
    const widgetId = asTrimmedString(rawId);
    if (!widgetId) return;
    const cached = store.cache[widgetId];
    if (cached && cached.expiresAt > now) {
      resolved.set(widgetId, cached.widgetType);
      return;
    }
    if (cached) delete store.cache[widgetId];
    missing.push(widgetId);
  });

  if (missing.length > 0) {
    const uniqueMissing = Array.from(new Set(missing));
    const widgetParams = new URLSearchParams({
      select: 'id,type,name',
      id: `in.(${uniqueMissing.join(',')})`,
      limit: String(uniqueMissing.length),
    });
    const widgetRes = await supabaseFetch(env, `/rest/v1/widgets?${widgetParams.toString()}`, { method: 'GET' });
    if (!widgetRes.ok) {
      const details = await readJson(widgetRes);
      throw new Error(`[ParisWorker] Failed to load widget rows (${widgetRes.status}): ${JSON.stringify(details)}`);
    }
    const widgetRows = ((await widgetRes.json()) as WidgetLookupRow[]) ?? [];
    const rowById = new Map<string, WidgetLookupRow>();
    widgetRows.forEach((widget) => {
      const widgetId = asTrimmedString(widget.id);
      if (!widgetId) return;
      rowById.set(widgetId, widget);
    });

    uniqueMissing.forEach((widgetId) => {
      const row = rowById.get(widgetId);
      const widgetType = normalizeWidgetTypeLabel(row?.type);
      resolved.set(widgetId, widgetType);
      store.cache[widgetId] = {
        widgetType,
        expiresAt: Date.now() + ROMA_WIDGET_LOOKUP_CACHE_TTL_MS,
      };
    });
  }

  return resolved;
}

async function loadWorkspaceWidgetsInstances(
  env: Env,
  workspaceId: string,
): Promise<RomaWidgetsInstancePayload[]> {
  const withDisplayParams = new URLSearchParams({
    workspace_id: `eq.${workspaceId}`,
    order: 'created_at.desc',
    limit: '500',
  });
  withDisplayParams.set('select', 'public_id,display_name,workspace_id,widget_id');
  const instanceRes = await supabaseFetch(env, `/rest/v1/widget_instances?${withDisplayParams.toString()}`, {
    method: 'GET',
  });
  if (!instanceRes.ok) {
    const details = await readJson(instanceRes);
    throw new Error(`[ParisWorker] Failed to load workspace instances (${instanceRes.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await instanceRes.json()) as WorkspaceWidgetInstanceRow[]) ?? [];

  const widgetIds = Array.from(
    new Set(rows.map((row) => asTrimmedString(row.widget_id)).filter((id): id is string => Boolean(id))),
  );
  const widgetTypeById = widgetIds.length > 0 ? await resolveWidgetTypesById(env, widgetIds) : new Map<string, string>();

  return rows.map((row) => {
    const widgetId = asTrimmedString(row.widget_id);
    const widgetType = widgetId ? widgetTypeById.get(widgetId) ?? 'unknown' : 'unknown';
    return {
      publicId: row.public_id,
      widgetType,
      displayName: asTrimmedString(row.display_name) || DEFAULT_INSTANCE_DISPLAY_NAME,
      workspaceId: asTrimmedString(row.workspace_id) || null,
      source: 'workspace',
      actions: {
        edit: true,
        duplicate: true,
        delete: true,
      },
    };
  });
}

async function loadCuratedWidgetsInstances(env: Env): Promise<RomaWidgetsInstancePayload[]> {
  const params = new URLSearchParams({
    select: 'public_id,widget_type,meta,owner_account_id',
    order: 'created_at.desc',
    limit: '500',
  });
  const curatedRes = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, {
    method: 'GET',
  });
  if (!curatedRes.ok) {
    const details = await readJson(curatedRes);
    throw new Error(`[ParisWorker] Failed to load curated instances (${curatedRes.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await curatedRes.json()) as CuratedWidgetInstanceListRow[]) ?? [];
  return mapCuratedRowsToRomaInstances(rows);
}

async function loadOwnedCuratedWidgetsInstances(
  env: Env,
  ownerAccountId: string,
): Promise<RomaWidgetsInstancePayload[]> {
  const params = new URLSearchParams({
    select: 'public_id,widget_type,meta,owner_account_id',
    owner_account_id: `eq.${ownerAccountId}`,
    order: 'created_at.desc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account-owned curated instances (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await res.json()) as CuratedWidgetInstanceListRow[]) ?? [];
  return mapCuratedRowsToRomaInstances(rows);
}

function mapCuratedRowsToRomaInstances(rows: CuratedWidgetInstanceListRow[]): RomaWidgetsInstancePayload[] {
  return rows.map((row) => {
    const publicId = asTrimmedString(row.public_id) || 'unknown';
    const meta = readCuratedMeta(row.meta);
    return {
      publicId,
      widgetType: normalizeWidgetTypeLabel(row.widget_type),
      displayName: formatCuratedDisplayName(meta, publicId),
      workspaceId: null,
      source: 'curated',
      actions: {
        edit: true,
        duplicate: true,
        delete: true,
      },
    };
  });
}

function mergeRomaWidgetInstances(
  primary: RomaWidgetsInstancePayload[],
  secondary: RomaWidgetsInstancePayload[],
): RomaWidgetsInstancePayload[] {
  const merged = new Map<string, RomaWidgetsInstancePayload>();
  for (const item of primary) merged.set(item.publicId, item);
  for (const item of secondary) {
    if (!merged.has(item.publicId)) merged.set(item.publicId, item);
  }
  return Array.from(merged.values());
}

type CuratedOwnerLookupRow = {
  public_id: string;
  owner_account_id?: string | null;
};

async function loadCuratedInstanceOwnerAccountId(env: Env, publicId: string): Promise<string | null> {
  const params = new URLSearchParams({
    select: 'public_id,owner_account_id',
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load curated owner (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await res.json()) as CuratedOwnerLookupRow[]) ?? [];
  const owner = asTrimmedString(rows[0]?.owner_account_id);
  return owner || null;
}

async function deleteWorkspaceInstance(env: Env, workspaceId: string, publicId: string): Promise<void> {
  const deletePath = `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`;
  const deleteRes = await supabaseFetch(env, deletePath, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    throw new Error(`[ParisWorker] Failed to delete workspace instance (${deleteRes.status}): ${JSON.stringify(details)}`);
  }
}

async function deleteCuratedInstance(env: Env, publicId: string): Promise<void> {
  const deleteRes = await supabaseFetch(
    env,
    `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    throw new Error(`[ParisWorker] Failed to delete curated instance (${deleteRes.status}): ${JSON.stringify(details)}`);
  }
}

async function resolveAccountMembershipRole(env: Env, accountId: string, userId: string): Promise<MemberRole | null> {
  const workspaces = await loadAccountWorkspaces(env, accountId);
  const workspaceIds = workspaces.map((workspace) => workspace.id).filter(Boolean);
  if (workspaceIds.length === 0) return null;

  const membershipParams = new URLSearchParams({
    select: 'workspace_id,role',
    user_id: `eq.${userId}`,
    workspace_id: `in.(${workspaceIds.join(',')})`,
    limit: '500',
  });
  const membershipRes = await supabaseFetch(env, `/rest/v1/workspace_members?${membershipParams.toString()}`, {
    method: 'GET',
  });
  if (!membershipRes.ok) {
    const details = await readJson(membershipRes);
    throw new Error(`[ParisWorker] Failed to resolve account membership (${membershipRes.status}): ${JSON.stringify(details)}`);
  }
  const memberships = (await membershipRes.json()) as WorkspaceMembershipRow[];
  const roles: MemberRole[] = memberships
    .map((row) => normalizeRole(row.role))
    .filter((role): role is MemberRole => Boolean(role));
  return deriveHighestRole(roles);
}

function accountRoleLabel(workspaceRole: MemberRole): 'account_owner' | 'account_admin' | 'account_member' {
  if (workspaceRole === 'owner') return 'account_owner';
  if (workspaceRole === 'admin') return 'account_admin';
  return 'account_member';
}

async function authorizeAccount(
  req: Request,
  env: Env,
  accountId: string,
  minRole: MemberRole,
): Promise<AccountAuthzResult> {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return { ok: false, response: auth.response };

  const userId = auth.principal?.userId ?? '';
  if (!userId) {
    return { ok: false, response: ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.auth.required' }, 401) };
  }

  const accountCapsule = readRomaAccountAuthzCapsuleHeader(req);
  if (accountCapsule) {
    const verified = await verifyRomaAccountAuthzCapsule(env, accountCapsule);
    if (!verified.ok) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    const payload = verified.payload;
    if (payload.userId !== userId || payload.accountId !== accountId) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    if (roleRank(payload.role) < roleRank(minRole)) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    return {
      ok: true,
      auth,
      account: {
        id: payload.accountId,
        status: payload.accountStatus,
        is_platform: payload.isPlatform,
      },
      role: payload.role,
    };
  }

  let account: AccountRow | null = null;
  try {
    account = await loadAccount(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500) };
  }
  if (!account) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404) };
  }

  let role: MemberRole | null = null;
  try {
    role = await resolveAccountMembershipRole(env, accountId, userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500) };
  }

  if (!role) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
  }

  if (roleRank(role) < roleRank(minRole)) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
  }

  return { ok: true, auth, account, role };
}

function tierRank(tier: WorkspaceRow['tier']): number {
  switch (tier) {
    case 'tier3':
      return 4;
    case 'tier2':
      return 3;
    case 'tier1':
      return 2;
    case 'free':
    default:
      return 1;
  }
}

function inferHighestTier(workspaces: AccountWorkspaceRow[]): WorkspaceRow['tier'] {
  let tier: WorkspaceRow['tier'] = 'free';
  for (const workspace of workspaces) {
    if (tierRank(workspace.tier) > tierRank(tier)) tier = workspace.tier;
  }
  return tier;
}

function inferHighestTierFromIdentityWorkspaces(
  workspaces: Array<{
    accountId: string;
    tier: string;
  }>,
  accountId: string,
): WorkspaceRow['tier'] | null {
  let best: WorkspaceRow['tier'] | null = null;
  for (const workspace of workspaces) {
    if (asTrimmedString(workspace.accountId) !== accountId) continue;
    const tier = normalizeWorkspaceTier(workspace.tier);
    if (!tier) continue;
    if (!best || tierRank(tier) > tierRank(best)) best = tier;
  }
  return best;
}

async function buildRomaBootstrapDomainsSnapshot(args: {
  env: Env;
  accountId: string;
  accountStatus: string;
  isPlatform: boolean;
  accountRole: MemberRole;
  workspace: {
    workspaceId: string;
    accountId: string;
    tier: string;
    name: string;
    slug: string;
    role: MemberRole;
  };
}): Promise<RomaBootstrapDomainsPayload> {
  const accountRoleLabelValue = accountRoleLabel(args.accountRole);
  const [accountWorkspaces, teamMembers, usageAssets, assets, workspaceWidgetRows, ownedCuratedRows, curatedRows] = await Promise.all([
    loadAccountWorkspaces(args.env, args.accountId),
    loadWorkspaceMembersForBootstrap(args.env, args.workspace.workspaceId),
    loadAccountUsageAssetRowsForBootstrap(args.env, args.accountId),
    loadAccountAssetsForBootstrap(args.env, args.accountId),
    loadWorkspaceWidgetsInstances(args.env, args.workspace.workspaceId),
    loadOwnedCuratedWidgetsInstances(args.env, args.accountId),
    loadCuratedWidgetsInstances(args.env),
  ]);

  const workspaceIds = accountWorkspaces.map((workspace) => workspace.id).filter(Boolean);
  let instances: InstanceListRow[] = [];
  if (workspaceIds.length > 0) {
    const instanceParams = new URLSearchParams({
      select: 'public_id,status,workspace_id',
      workspace_id: `in.(${workspaceIds.join(',')})`,
      limit: '5000',
    });
    const instanceRes = await supabaseFetch(args.env, `/rest/v1/widget_instances?${instanceParams.toString()}`, { method: 'GET' });
    if (!instanceRes.ok) {
      const details = await readJson(instanceRes);
      throw new Error(
        `[ParisWorker] Failed to load account instances for bootstrap (${instanceRes.status}): ${JSON.stringify(details)}`,
      );
    }
    instances = ((await instanceRes.json()) as InstanceListRow[]) ?? [];
  }

  const activeUsageAssets = usageAssets.filter((asset) => !asset.deleted_at);
  const usageBytes = activeUsageAssets.reduce((sum, asset) => {
    const size = Number.isFinite(asset.size_bytes) ? asset.size_bytes : 0;
    return sum + Math.max(0, size);
  }, 0);
  const publishedInstances = instances.filter((instance) => instance.status === 'published').length;

  const inferredTier = inferHighestTier(accountWorkspaces);
  const canMutateWorkspace = roleRank(args.workspace.role) >= roleRank('editor');
  const canDeleteCurated = roleRank(args.workspace.role) >= roleRank('admin');

  const widgetCatalog = mergeRomaWidgetInstances(workspaceWidgetRows, ownedCuratedRows).map((instance) => ({
    ...instance,
    actions: {
      edit: true,
      duplicate: canMutateWorkspace,
      delete: instance.source === 'curated' ? canDeleteCurated : canMutateWorkspace,
    },
  }));
  const widgetTypes = Array.from(
    new Set(widgetCatalog.map((instance) => instance.widgetType).filter((widgetType) => widgetType !== 'unknown')),
  ).sort((a, b) => a.localeCompare(b));

  const templateTypes = Array.from(
    new Set(curatedRows.map((instance) => instance.widgetType).filter((widgetType) => widgetType !== 'unknown')),
  ).sort((a, b) => a.localeCompare(b));

  return {
    widgets: {
      accountId: args.accountId,
      workspaceId: args.workspace.workspaceId,
      widgetTypes,
      instances: widgetCatalog,
    },
    templates: {
      accountId: args.accountId,
      workspaceId: args.workspace.workspaceId,
      widgetTypes: templateTypes,
      instances: curatedRows.map((instance) => ({
        publicId: instance.publicId,
        widgetType: instance.widgetType,
        displayName: instance.displayName,
      })),
    },
    assets: {
      accountId: args.accountId,
      workspaceId: args.workspace.workspaceId,
      assets,
    },
    team: {
      workspaceId: args.workspace.workspaceId,
      role: args.workspace.role,
      members: teamMembers,
    },
    billing: {
      accountId: args.accountId,
      role: accountRoleLabelValue,
      provider: 'stripe',
      status: 'not_configured',
      reasonKey: 'coreui.errors.billing.notConfigured',
      plan: {
        inferredTier,
        workspaceCount: accountWorkspaces.length,
      },
      checkoutAvailable: false,
      portalAvailable: false,
    },
    usage: {
      accountId: args.accountId,
      role: accountRoleLabelValue,
      usage: {
        workspaces: accountWorkspaces.length,
        instances: {
          total: instances.length,
          published: publishedInstances,
          unpublished: Math.max(0, instances.length - publishedInstances),
        },
        assets: {
          total: usageAssets.length,
          active: activeUsageAssets.length,
          bytesActive: usageBytes,
        },
      },
    },
    settings: {
      accountSummary: {
        accountId: args.accountId,
        status: args.accountStatus,
        isPlatform: args.isPlatform,
        role: accountRoleLabelValue,
        workspaceCount: accountWorkspaces.length,
      },
      workspaceSummary: {
        workspaceId: args.workspace.workspaceId,
        accountId: args.workspace.accountId,
        tier: args.workspace.tier,
        name: args.workspace.name,
        slug: args.workspace.slug,
        role: args.workspace.role,
      },
      accountWorkspaces: accountWorkspaces
        .map((workspace) => ({
          workspaceId: workspace.id,
          accountId: workspace.account_id,
          tier: workspace.tier,
          name: workspace.name,
          slug: workspace.slug,
          createdAt: workspace.created_at ?? null,
          updatedAt: workspace.updated_at ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

async function resolveAccountEntitlementsSnapshot(args: {
  env: Env;
  accountId: string;
  profile: WorkspaceRow['tier'];
  role: MemberRole;
}): Promise<AccountEntitlementsSnapshot> {
  const policy = resolvePolicy({ profile: args.profile, role: args.role });
  const budgets: Record<string, { max: number | null; used: number }> = {};

  await Promise.all(
    BUDGET_KEYS.map(async (budgetKey) => {
      const used = await readBudgetUsed({
        env: args.env,
        scope: { kind: 'account', accountId: args.accountId },
        budgetKey,
      });
      const max = policy.budgets[budgetKey]?.max ?? null;
      budgets[budgetKey] = { max, used };
    }),
  );

  return {
    flags: policy.flags,
    caps: policy.caps,
    budgets,
  };
}

function replayFromIdempotency(record: IdempotencyRecord): Response {
  const headers = new Headers();
  headers.set('x-idempotent-replay', '1');
  return json(record.body, { status: record.status, headers });
}

async function loadIdempotencyRecord(kv: KVNamespace, key: string): Promise<IdempotencyRecord | null> {
  const existing = await kvGetJson<IdempotencyRecord>(kv, key);
  if (!existing || existing.v !== 1) return null;
  if (!Number.isFinite(existing.status) || existing.status < 100 || existing.status > 599) return null;
  return existing;
}

async function storeIdempotencyRecord(
  kv: KVNamespace,
  key: string,
  status: number,
  body: unknown,
  ttlSec = ROMA_APP_IDEMPOTENCY_TTL_SEC,
): Promise<void> {
  const payload: IdempotencyRecord = {
    v: 1,
    status,
    body,
    createdAt: new Date().toISOString(),
  };
  await kvPutJson(kv, key, payload, ttlSec);
}

async function storeBootstrapOwner(kv: KVNamespace, accountId: string, userId: string): Promise<void> {
  const key = `roma:bootstrap:account-owner:${accountId}`;
  const payload: BootstrapOwnerRecord = {
    v: 1,
    userId,
    createdAt: new Date().toISOString(),
  };
  await kvPutJson(kv, key, payload, ROMA_APP_BOOTSTRAP_TTL_SEC);
}

async function hasBootstrapOwnerAccess(kv: KVNamespace, accountId: string, userId: string): Promise<boolean> {
  const key = `roma:bootstrap:account-owner:${accountId}`;
  const payload = await kvGetJson<BootstrapOwnerRecord>(kv, key);
  if (!payload || payload.v !== 1) return false;
  return payload.userId === userId;
}

async function clearBootstrapOwner(kv: KVNamespace, accountId: string): Promise<void> {
  await kv.delete(`roma:bootstrap:account-owner:${accountId}`);
}

async function createWorkspaceForAccount(args: {
  env: Env;
  accountId: string;
  name: string;
  slugBase: string;
}): Promise<{ ok: true; workspace: AccountWorkspaceRow } | { ok: false; response: Response }> {
  const { env, accountId, name, slugBase } = args;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = attempt === 0 ? slugBase : `${slugBase}-${attempt + 1}`;
    const insertRes = await supabaseFetch(env, '/rest/v1/workspaces', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        account_id: accountId,
        name,
        slug,
        tier: 'free',
      }),
    });
    if (insertRes.status === 409) {
      continue;
    }
    if (!insertRes.ok) {
      const details = await readJson(insertRes);
      return {
        ok: false,
        response: ckError(
          { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) },
          500,
        ),
      };
    }
    const rows = ((await insertRes.json()) as AccountWorkspaceRow[]) ?? [];
    const workspace = rows[0];
    if (!workspace?.id) {
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed' }, 500),
      };
    }
    return { ok: true, workspace };
  }

  return {
    ok: false,
    response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspace.slug.conflict' }, 409),
  };
}

function resolveMinibobHandoffRoute(publicId: string, workspaceId: string, accountId: string): string {
  const search = new URLSearchParams({
    workspaceId,
    accountId,
    publicId,
    subject: 'workspace',
  });
  return `/builder/${encodeURIComponent(publicId)}?${search.toString()}`;
}

async function materializeMinibobHandoffInstance(args: {
  env: Env;
  accountId: string;
  workspaceId: string;
  handoffId: string;
  widgetType: string;
  widgetId: string;
  config: Record<string, unknown>;
}): Promise<
  | { ok: true; publicId: string }
  | { ok: false; response: Response }
> {
  const handoffIdResult = assertHandoffId(args.handoffId);
  if (!handoffIdResult.ok) return { ok: false, response: handoffIdResult.response };

  const widgetTypeResult = assertWidgetType(args.widgetType);
  if (!widgetTypeResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422) };
  }
  const widgetType = widgetTypeResult.value;

  let widgetId = asTrimmedString(args.widgetId);
  if (!isUuid(widgetId)) {
    const widget = await loadWidgetByType(args.env, widgetType).catch(() => null);
    widgetId = asTrimmedString(widget?.id);
  }
  if (!widgetId || !isUuid(widgetId)) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.widget.notFound' }, 404) };
  }

  const configResult = assertConfig(args.config);
  if (!configResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  const suffix = handoffIdResult.value.replace(/^mbh_/, '').replace(/[^a-z0-9_-]/g, '').slice(0, 48) || 'handoff';
  const publicId = `wgt_${widgetType}_u_${suffix}`;
  const usageValidationError = await validateAccountAssetUsageForInstanceStrict({
    env: args.env,
    accountId: args.accountId,
    publicId,
    config: configResult.value,
  });
  if (usageValidationError) return { ok: false, response: usageValidationError };

  const insertRes = await supabaseFetch(args.env, '/rest/v1/widget_instances', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      widget_id: widgetId,
      public_id: publicId,
      status: 'unpublished',
      config: configResult.value,
      workspace_id: args.workspaceId,
      kind: 'user',
    }),
  });
  if (insertRes.status === 409) {
    const existing = await loadInstanceByPublicId(args.env, publicId).catch(() => null);
    if (existing && !('widget_type' in existing) && existing.workspace_id === args.workspaceId) {
      return { ok: true, publicId };
    }
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.alreadyConsumed' }, 409) };
  }
  if (!insertRes.ok) {
    const details = await readJson(insertRes);
    return {
      ok: false,
      response: ckError(
        { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) },
        500,
      ),
    };
  }

  const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
    env: args.env,
    accountId: args.accountId,
    publicId,
    config: configResult.value,
  });
  if (usageSyncError) {
    await rollbackCreatedWorkspaceInstanceOnUsageSyncFailure({
      env: args.env,
      workspaceId: args.workspaceId,
      publicId,
    });
    return { ok: false, response: usageSyncError };
  }

  return { ok: true, publicId };
}

export async function handleMinibobHandoffStart(req: Request, env: Env): Promise<Response> {
  const kvResult = requireRomaAppKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  const bodyResult = parseBodyAsRecord(bodyRaw);
  if (!bodyResult.ok) return bodyResult.response;

  const sourcePublicId =
    asTrimmedString(bodyResult.value.sourcePublicId) ||
    asTrimmedString(bodyResult.value.publicId);
  if (!sourcePublicId) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.minibobHandoff.sourcePublicIdRequired' }, 422);
  }

  let widgetTypeHint: string | undefined;
  if (bodyResult.value.widgetType !== undefined) {
    const widgetTypeResult = assertWidgetType(bodyResult.value.widgetType);
    if (!widgetTypeResult.ok) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
    }
    widgetTypeHint = widgetTypeResult.value;
  }

  let draftConfig: Record<string, unknown> | undefined;
  if (bodyResult.value.draftConfig !== undefined) {
    const configResult = assertConfig(bodyResult.value.draftConfig);
    if (!configResult.ok) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
    }
    const serialized = JSON.stringify(configResult.value);
    if (serialized.length > MINIBOB_HANDOFF_MAX_CONFIG_BYTES) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
    }
    draftConfig = JSON.parse(serialized) as Record<string, unknown>;
  }

  const snapshot = await resolveMinibobHandoffSnapshot({
    env,
    sourcePublicId,
    widgetTypeHint,
    draftConfig,
  });
  if (!snapshot.ok) return snapshot.response;

  const handoffId = `mbh_${crypto.randomUUID().replace(/-/g, '')}`;
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + MINIBOB_HANDOFF_STATE_TTL_SEC * 1000).toISOString();

  const record: MinibobHandoffStateRecord = {
    v: 1,
    handoffId,
    sourcePublicId: snapshot.sourcePublicId,
    widgetType: snapshot.widgetType,
    widgetId: snapshot.widgetId,
    config: snapshot.config,
    status: 'pending',
    createdAt,
    expiresAt,
  };

  try {
    await kvPutJson(kv, resolveMinibobHandoffStateKey(handoffId), record, MINIBOB_HANDOFF_STATE_TTL_SEC);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.minibobHandoff.unavailable', detail }, 503);
  }

  return json(
    {
      handoffId,
      sourcePublicId: snapshot.sourcePublicId,
      widgetType: snapshot.widgetType,
      expiresAt,
    },
    { status: 201 },
  );
}

export async function handleAccountCreate(req: Request, env: Env): Promise<Response> {
  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireRomaAppKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  const replayKey = `roma:idem:accounts:create:${auth.principal.userId}:${idempotencyKey}`;
  const existing = await loadIdempotencyRecord(kv, replayKey);
  if (existing) return replayFromIdempotency(existing);

  let bodyRaw: unknown = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      bodyRaw = await req.json();
    } catch {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
    }
  }
  if (bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw)) {
    const ignoredName = asTrimmedString((bodyRaw as Record<string, unknown>).name);
    if (ignoredName && ignoredName.length > 120) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.account.name.invalid' }, 422);
    }
  } else if (bodyRaw !== null && bodyRaw !== undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const accountId = crypto.randomUUID();
  const insertRes = await supabaseFetch(env, '/rest/v1/accounts', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: accountId,
      status: 'active',
      is_platform: false,
    }),
  });
  if (!insertRes.ok) {
    const details = await readJson(insertRes);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: JSON.stringify(details),
      },
      500,
    );
  }

  try {
    await storeBootstrapOwner(kv, accountId, auth.principal.userId);
  } catch (error) {
    await supabaseFetch(env, `/rest/v1/accounts?id=eq.${accountId}`, { method: 'DELETE' }).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.idempotency.unavailable', detail }, 503);
  }

  const payload = {
    accountId,
    status: 'active',
    isPlatform: false,
    role: 'account_owner',
    bootstrap: {
      needsWorkspace: true,
      ownerSource: 'bootstrap_kv',
    },
  };
  await storeIdempotencyRecord(kv, replayKey, 201, payload).catch(() => undefined);
  return json(payload, { status: 201 });
}

export async function handleAccountCreateWorkspace(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;
  const userId = auth.principal.userId;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireRomaAppKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  const replayKey = `roma:idem:accounts:${accountId}:workspaces:create:${userId}:${idempotencyKey}`;
  const existing = await loadIdempotencyRecord(kv, replayKey);
  if (existing) return replayFromIdempotency(existing);

  const account = await loadAccount(env, accountId).catch(() => null);
  if (!account) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404);

  let membershipRole: MemberRole | null = null;
  try {
    membershipRole = await resolveAccountMembershipRole(env, accountId, userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  let bootstrapAllowed = false;
  if (!membershipRole || roleRank(membershipRole) < roleRank('admin')) {
    bootstrapAllowed = await hasBootstrapOwnerAccess(kv, accountId, userId).catch(() => false);
    if (!bootstrapAllowed) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    membershipRole = 'owner';
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  const bodyResult = parseBodyAsRecord(bodyRaw);
  if (!bodyResult.ok) return bodyResult.response;

  const nameResult = sanitizeWorkspaceName(bodyResult.value.name);
  if (!nameResult.ok) return nameResult.response;
  const slugResult = sanitizeWorkspaceSlug(bodyResult.value.slug, nameResult.value);
  if (!slugResult.ok) return slugResult.response;

  const created = await createWorkspaceForAccount({
    env,
    accountId,
    name: nameResult.value,
    slugBase: slugResult.value,
  });
  if (!created.ok) return created.response;

  const memberRes = await supabaseFetch(env, '/rest/v1/workspace_members', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      workspace_id: created.workspace.id,
      user_id: userId,
      role: 'owner',
    }),
  });
  if (!memberRes.ok) {
    const details = await readJson(memberRes);
    return ckError(
      { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) },
      500,
    );
  }

  if (bootstrapAllowed) {
    await clearBootstrapOwner(kv, accountId).catch(() => undefined);
  }

  const payload = {
    accountId,
    role: accountRoleLabel(membershipRole),
    workspace: {
      workspaceId: created.workspace.id,
      accountId: created.workspace.account_id,
      tier: created.workspace.tier,
      name: created.workspace.name,
      slug: created.workspace.slug,
      createdAt: created.workspace.created_at ?? null,
      updatedAt: created.workspace.updated_at ?? null,
    },
  };
  await storeIdempotencyRecord(kv, replayKey, 201, payload).catch(() => undefined);
  return json(payload, { status: 201 });
}

export async function handleMinibobHandoffComplete(req: Request, env: Env): Promise<Response> {
  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;
  const userId = auth.principal.userId;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireRomaAppKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  const bodyResult = parseBodyAsRecord(bodyRaw);
  if (!bodyResult.ok) return bodyResult.response;

  const accountIdResult = assertAccountId(String(bodyResult.value.accountId || ''));
  if (!accountIdResult.ok) return accountIdResult.response;
  const workspaceIdResult = assertWorkspaceId(String(bodyResult.value.workspaceId || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;

  const handoffIdRaw = asTrimmedString(bodyResult.value.handoffId);
  if (!handoffIdRaw) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.minibobHandoff.idRequired' }, 422);
  }
  const handoffIdResult = assertHandoffId(handoffIdRaw);
  if (!handoffIdResult.ok) return handoffIdResult.response;
  const handoffId = handoffIdResult.value;

  const replayKey = `roma:idem:minibob:handoff:complete:${userId}:${idempotencyKey}`;
  const idemExisting = await loadIdempotencyRecord(kv, replayKey);
  if (idemExisting) return replayFromIdempotency(idemExisting);

  const workspaceAuth = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'viewer');
  if (!workspaceAuth.ok) return workspaceAuth.response;
  const workspace = workspaceAuth.workspace;
  if (workspace.account_id !== accountIdResult.value) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.account.mismatch' }, 403);
  }

  const handoffStateKey = resolveMinibobHandoffStateKey(handoffId);
  const existingHandoff = await kvGetJson<MinibobHandoffStateRecord>(kv, handoffStateKey);
  if (!existingHandoff || existingHandoff.v !== 1) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.minibobHandoff.notFound' }, 404);
  }
  if (existingHandoff.handoffId !== handoffId) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.minibobHandoff.notFound' }, 404);
  }

  const expiresAtMs = Date.parse(existingHandoff.expiresAt);
  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.expired' }, 410);
  }

  if (existingHandoff.status === 'consumed') {
    const sameTarget =
      existingHandoff.consumedByUserId === userId &&
      existingHandoff.consumedAccountId === accountIdResult.value &&
      existingHandoff.consumedWorkspaceId === workspaceIdResult.value &&
      typeof existingHandoff.resultPublicId === 'string' &&
      existingHandoff.resultPublicId.length > 0;
    if (!sameTarget) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.alreadyConsumed' }, 409);
    }
    const replayPayload = {
      handoffId: existingHandoff.handoffId,
      accountId: existingHandoff.consumedAccountId as string,
      workspaceId: existingHandoff.consumedWorkspaceId as string,
      sourcePublicId: existingHandoff.sourcePublicId,
      publicId: existingHandoff.resultPublicId as string,
      builderRoute: resolveMinibobHandoffRoute(
        existingHandoff.resultPublicId as string,
        existingHandoff.consumedWorkspaceId as string,
        existingHandoff.consumedAccountId as string,
      ),
      replay: true,
    };
    await storeIdempotencyRecord(kv, replayKey, 200, replayPayload).catch(() => undefined);
    return json(replayPayload, { status: 200 });
  }
  if (existingHandoff.status !== 'pending') {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.unavailable' }, 409);
  }

  const materialized = await materializeMinibobHandoffInstance({
    env,
    accountId: accountIdResult.value,
    workspaceId: workspaceIdResult.value,
    handoffId,
    widgetType: existingHandoff.widgetType,
    widgetId: existingHandoff.widgetId,
    config: existingHandoff.config,
  });
  if (!materialized.ok) return materialized.response;

  const completedState: MinibobHandoffStateRecord = {
    ...existingHandoff,
    status: 'consumed',
    consumedAt: new Date().toISOString(),
    consumedByUserId: userId,
    consumedAccountId: accountIdResult.value,
    consumedWorkspaceId: workspaceIdResult.value,
    resultPublicId: materialized.publicId,
  };
  await kvPutJson(kv, handoffStateKey, completedState, MINIBOB_HANDOFF_STATE_TTL_SEC).catch(() => undefined);

  const payload = {
    handoffId,
    accountId: accountIdResult.value,
    workspaceId: workspaceIdResult.value,
    sourcePublicId: existingHandoff.sourcePublicId,
    publicId: materialized.publicId,
    builderRoute: resolveMinibobHandoffRoute(materialized.publicId, workspaceIdResult.value, accountIdResult.value),
    replay: false,
  };
  await storeIdempotencyRecord(kv, replayKey, 200, payload).catch(() => undefined);
  return json(payload, { status: 200 });
}

export async function handleWorkspaceGet(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const workspace = authorized.workspace;
  return json({
    workspaceId: workspace.id,
    accountId: workspace.account_id,
    tier: workspace.tier,
    name: workspace.name,
    slug: workspace.slug,
    role: authorized.role,
  });
}

export async function handleRomaWidgetDuplicate(req: Request, env: Env): Promise<Response> {
  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }
  const bodyResult = parseBodyAsRecord(bodyRaw);
  if (!bodyResult.ok) return bodyResult.response;

  const workspaceIdResult = assertWorkspaceId(String(bodyResult.value.workspaceId || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const sourcePublicIdResult = assertPublicId(bodyResult.value.sourcePublicId);
  if (!sourcePublicIdResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);
  }
  const sourcePublicId = sourcePublicIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;

  const sourceIsCurated = isCuratedPublicId(sourcePublicId);

  let sourceInstance: Awaited<ReturnType<typeof loadInstanceByPublicId>> = null;
  try {
    sourceInstance = sourceIsCurated
      ? await loadInstanceByPublicId(env, sourcePublicId)
      : await loadInstanceByWorkspaceAndPublicId(env, workspaceId, sourcePublicId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!sourceInstance) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  let widgetType: string | null = null;
  try {
    widgetType = await resolveWidgetTypeForInstance(env, sourceInstance);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!widgetType) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);
  }
  const widgetTypeResult = assertWidgetType(widgetType);
  if (!widgetTypeResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
  }

  const configResult = assertConfig(sourceInstance.config);
  if (!configResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const destinationPublicId = createUserInstancePublicId(widgetTypeResult.value);
  const createUrl = new URL(req.url);
  createUrl.pathname = `/api/workspaces/${encodeURIComponent(workspaceId)}/instances`;
  createUrl.search = '';
  createUrl.searchParams.set('subject', 'workspace');

  const createHeaders = new Headers();
  const authorization = req.headers.get('authorization');
  if (authorization) createHeaders.set('authorization', authorization);
  createHeaders.set('content-type', 'application/json');

  const createReq = new Request(createUrl.toString(), {
    method: 'POST',
    headers: createHeaders,
    body: JSON.stringify({
      publicId: destinationPublicId,
      widgetType: widgetTypeResult.value,
      status: 'unpublished',
      config: configResult.value,
    }),
  });

  const createResponse = await handleWorkspaceCreateInstance(createReq, env, workspaceId);
  if (!createResponse.ok) return createResponse;

  const createdPayload = await readJson(createResponse);
  const createdPublicIdRaw =
    createdPayload && typeof createdPayload === 'object' && 'publicId' in createdPayload
      ? asTrimmedString((createdPayload as { publicId?: unknown }).publicId)
      : null;
  const createdPublicId = createdPublicIdRaw || destinationPublicId;

  return json(
    {
      workspaceId,
      sourcePublicId,
      publicId: createdPublicId,
      widgetType: widgetTypeResult.value,
      status: 'unpublished',
      source: sourceIsCurated ? 'curated' : 'workspace',
    },
    { status: 201 },
  );
}

export async function handleRomaWidgetDelete(
  req: Request,
  env: Env,
  publicIdRaw: string,
): Promise<Response> {
  const publicIdResult = assertPublicId(publicIdRaw);
  if (!publicIdResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);
  }
  const publicId = publicIdResult.value;

  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(String(url.searchParams.get('workspaceId') || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;

  const sourceIsCurated = isCuratedPublicId(publicId);
  if (sourceIsCurated) {
    if (!allowCuratedWrites(env)) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    if (roleRank(authorized.role) < roleRank('admin')) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }

    let ownerAccountId: string | null = null;
    try {
      ownerAccountId = await loadCuratedInstanceOwnerAccountId(env, publicId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
    }
    if (!ownerAccountId) {
      return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
    }
    if (ownerAccountId !== authorized.workspace.account_id) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }

    try {
      await deleteCuratedInstance(env, publicId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
    }
    const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
      env,
      accountId: authorized.workspace.account_id,
      publicId,
      config: {},
    });
    if (usageSyncError) return usageSyncError;

    return json({ workspaceId, publicId, source: 'curated', deleted: true }, { status: 200 });
  }

  let existing: Awaited<ReturnType<typeof loadInstanceByWorkspaceAndPublicId>> = null;
  try {
    existing = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!existing) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  try {
    await deleteWorkspaceInstance(env, workspaceId, publicId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
  const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
    env,
    accountId: authorized.workspace.account_id,
    publicId,
    config: {},
  });
  if (usageSyncError) return usageSyncError;

  return json({ workspaceId, publicId, source: 'workspace', deleted: true }, { status: 200 });
}

export async function handleRomaBootstrap(req: Request, env: Env): Promise<Response> {
  const resolved = await resolveIdentityMePayload(req, env);
  if (!resolved.ok) return resolved.response;

  const payload = resolved.payload;
  const workspaceId = asTrimmedString(payload.defaults.workspaceId) || '';
  const workspace = workspaceId
    ? payload.workspaces.find((candidate) => candidate.workspaceId === workspaceId) ?? null
    : null;

  let authz: {
    workspaceCapsule: string | null;
    workspaceId: string | null;
    accountId: string | null;
    role: MemberRole | null;
    profile: WorkspaceRow['tier'] | null;
    authzVersion: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    accountCapsule: string | null;
    accountRole: MemberRole | null;
    accountProfile: WorkspaceRow['tier'] | null;
    accountAuthzVersion: string | null;
    accountIssuedAt: string | null;
    accountExpiresAt: string | null;
    entitlements: AccountEntitlementsSnapshot | null;
  } = {
    workspaceCapsule: null,
    workspaceId: null,
    accountId: null,
    role: null,
    profile: null,
    authzVersion: null,
    issuedAt: null,
    expiresAt: null,
    accountCapsule: null,
    accountRole: null,
    accountProfile: null,
    accountAuthzVersion: null,
    accountIssuedAt: null,
    accountExpiresAt: null,
    entitlements: null,
  };
  let domains: RomaBootstrapDomainsPayload | null = null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresSec = nowSec + ROMA_AUTHZ_CAPSULE_TTL_SEC;
  const issuedAtIso = new Date(nowSec * 1000).toISOString();
  const expiresAtIso = new Date(expiresSec * 1000).toISOString();

  if (workspace) {
    const role = normalizeRole(workspace.role);
    const profile = normalizeWorkspaceTier(workspace.tier);
    const accountId = asTrimmedString(workspace.accountId);
    const authzVersion =
      asTrimmedString(workspace.membershipVersion) || `workspace:${workspace.workspaceId}:role:${workspace.role}`;

    if (role && profile && accountId) {
      const accountRecord = payload.accounts.find((entry) => asTrimmedString(entry.accountId) === accountId) ?? null;
      const accountStatus = asTrimmedString(accountRecord?.status) || 'active';
      const isPlatform = accountRecord?.isPlatform === true;
      const roleCandidates: MemberRole[] = [
        role,
        ...(Array.isArray(accountRecord?.workspaceRoles)
          ? accountRecord.workspaceRoles
              .map((candidate) => normalizeRole(candidate))
              .filter((candidate): candidate is MemberRole => Boolean(candidate))
          : []),
      ];
      const accountRole = deriveHighestRole(roleCandidates);
      const accountRoleResolved: MemberRole = accountRole ?? role;
      const accountProfile = inferHighestTierFromIdentityWorkspaces(payload.workspaces, accountId) || profile;
      const accountAuthzVersion = `account:${accountId}:role:${accountRoleResolved}:profile:${accountProfile}`;

      try {
        const [workspaceCapsule, accountCapsule, entitlements, domainsSnapshot] = await Promise.all([
          mintRomaWorkspaceAuthzCapsule(env, {
            sub: resolved.principal.userId,
            userId: resolved.principal.userId,
            accountId,
            workspaceId: workspace.workspaceId,
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug,
            workspaceWebsiteUrl: workspace.websiteUrl ?? null,
            workspaceTier: profile,
            role,
            authzVersion,
            iat: nowSec,
            exp: expiresSec,
          }),
          mintRomaAccountAuthzCapsule(env, {
            sub: resolved.principal.userId,
            userId: resolved.principal.userId,
            accountId,
            accountStatus,
            isPlatform,
            role: accountRoleResolved,
            profile: accountProfile,
            authzVersion: accountAuthzVersion,
            iat: nowSec,
            exp: expiresSec,
          }),
          resolveAccountEntitlementsSnapshot({
            env,
            accountId,
            profile: accountProfile,
            role: accountRoleResolved,
          }),
          buildRomaBootstrapDomainsSnapshot({
            env,
            accountId,
            accountStatus,
            isPlatform,
            accountRole: accountRoleResolved,
            workspace: {
              workspaceId: workspace.workspaceId,
              accountId,
              tier: profile,
              name: workspace.name,
              slug: workspace.slug,
              role,
            },
          }),
        ]);

        authz = {
          workspaceCapsule: workspaceCapsule.token,
          workspaceId: workspace.workspaceId,
          accountId,
          role,
          profile,
          authzVersion,
          issuedAt: issuedAtIso,
          expiresAt: expiresAtIso,
          accountCapsule: accountCapsule?.token ?? null,
          accountRole: accountRoleResolved,
          accountProfile,
          accountAuthzVersion,
          accountIssuedAt: issuedAtIso,
          accountExpiresAt: expiresAtIso,
          entitlements,
        };
        domains = domainsSnapshot;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
          500,
        );
      }
    }
  }

  return json({
    ...payload,
    authz,
    domains,
  });
}

export async function handleRomaWidgets(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(String(url.searchParams.get('workspaceId') || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let catalogInstances: RomaWidgetsInstancePayload[] = [];
  try {
    const [workspaceRows, ownedCuratedRows] = await Promise.all([
      loadWorkspaceWidgetsInstances(env, authorized.workspace.id),
      loadOwnedCuratedWidgetsInstances(env, authorized.workspace.account_id),
    ]);
    catalogInstances = mergeRomaWidgetInstances(workspaceRows, ownedCuratedRows);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const canMutateWorkspace = roleRank(authorized.role) >= roleRank('editor');
  const canDeleteCurated = roleRank(authorized.role) >= roleRank('admin');
  const actionAwareInstances = catalogInstances.map((instance) => ({
    ...instance,
    actions: {
      edit: true,
      duplicate: canMutateWorkspace,
      delete: instance.source === 'curated' ? canDeleteCurated : canMutateWorkspace,
    },
  }));

  const widgetTypeSet = new Set<string>();
  actionAwareInstances.forEach((instance) => {
    if (instance.widgetType !== 'unknown') widgetTypeSet.add(instance.widgetType);
  });

  return json({
    account: {
      accountId: authorized.workspace.account_id,
    },
    workspace: {
      workspaceId: authorized.workspace.id,
      accountId: authorized.workspace.account_id,
      name: authorized.workspace.name,
      slug: authorized.workspace.slug,
      tier: authorized.workspace.tier,
      role: authorized.role,
    },
    widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
    instances: actionAwareInstances,
  });
}

export async function handleRomaTemplates(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(String(url.searchParams.get('workspaceId') || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let curatedInstances: RomaWidgetsInstancePayload[] = [];
  try {
    curatedInstances = await loadCuratedWidgetsInstances(env);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const widgetTypeSet = new Set<string>();
  curatedInstances.forEach((instance) => {
    if (instance.widgetType !== 'unknown') widgetTypeSet.add(instance.widgetType);
  });

  return json({
    account: {
      accountId: authorized.workspace.account_id,
    },
    workspace: {
      workspaceId: authorized.workspace.id,
      accountId: authorized.workspace.account_id,
      name: authorized.workspace.name,
      slug: authorized.workspace.slug,
      tier: authorized.workspace.tier,
      role: authorized.role,
    },
    widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
    instances: curatedInstances,
  });
}

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
  const authorized = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'admin');
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
    isPlatform: authorized.account.is_platform,
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
    select: 'asset_id,size_bytes,deleted_at',
    account_id: `eq.${accountId}`,
    limit: '5000',
  });
  const assetRes = await supabaseFetch(env, `/rest/v1/account_assets?${assetParams.toString()}`, { method: 'GET' });
  if (!assetRes.ok) {
    const details = await readJson(assetRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const assets = ((await assetRes.json()) as AccountAssetRow[]) ?? [];

  const activeAssets = assets.filter((asset) => !asset.deleted_at);
  const assetBytes = activeAssets.reduce((sum, asset) => {
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
        active: activeAssets.length,
        bytesActive: assetBytes,
      },
    },
  });
}

export async function handleAccountBillingSummary(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'admin');
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

  const authorized = await authorizeAccount(req, env, accountId, 'admin');
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

  const authorized = await authorizeAccount(req, env, accountId, 'admin');
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

import { getEntitlementsMatrix } from '@clickeen/ck-policy';
import { isUuid } from '@clickeen/ck-contracts';
import {
  assertUploadAuth,
  buildAccountAssetKey,
  buildAccountAssetReplaceKey,
  guessContentTypeFromExt,
  json,
  normalizeAccountAssetReadKey,
  normalizePublicId,
  normalizeWidgetType,
  parseAccountAssetIdentityFromKey,
  pickExtension,
  requireDevAuth,
  sanitizeUploadFilename,
  sha256Hex,
  supabaseFetch,
} from '../index';
import type { Env } from '../index';

const L10N_VERSION_CAP_KEY = 'l10n.versions.max';
const DEFAULT_L10N_VERSION_LIMIT = 1;
export const UPLOAD_SIZE_CAP_KEY = 'uploads.size.max';
export const UPLOADS_COUNT_BUDGET_KEY = 'budget.uploads.count';
const DEFAULT_UPLOAD_SIZE_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_UPLOADS_COUNT_MAX = 5;
export const UPLOADS_BYTES_BUDGET_KEY = 'budget.uploads.bytes';
const DEFAULT_UPLOADS_BYTES_MAX = DEFAULT_UPLOAD_SIZE_MAX_BYTES * DEFAULT_UPLOADS_COUNT_MAX;

function getUtcPeriodKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

async function readKvCounter(kv: KVNamespace, key: string): Promise<number> {
  const raw = await kv.get(key);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function consumeAccountBudget(args: {
  env: Env;
  accountId: string;
  budgetKey: string;
  max: number | null;
  amount?: number;
}): Promise<
  | { ok: true; used: number; nextUsed: number }
  | { ok: false; used: number; max: number; reasonKey: 'coreui.upsell.reason.budgetExceeded'; detail: string }
> {
  const amount = typeof args.amount === 'number' ? args.amount : 1;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('[tokyo] consumeAccountBudget amount must be positive');
  if (args.max == null) return { ok: true, used: 0, nextUsed: amount };
  const max = Math.max(0, Math.floor(args.max));
  const kv = args.env.USAGE_KV;
  if (!kv) return { ok: true, used: 0, nextUsed: amount };

  const periodKey = getUtcPeriodKey(new Date());
  const counterKey = `usage.budget.v1.${args.budgetKey}.${periodKey}.acct:${args.accountId}`;
  const used = await readKvCounter(kv, counterKey);
  const nextUsed = used + amount;
  if (nextUsed > max) {
    return {
      ok: false,
      used,
      max,
      reasonKey: 'coreui.upsell.reason.budgetExceeded',
      detail: `${args.budgetKey} budget exceeded (max=${max})`,
    };
  }

  await kv.put(counterKey, String(nextUsed), { expirationTtl: 400 * 24 * 60 * 60 });
  return { ok: true, used, nextUsed };
}

export function resolveL10nVersionLimit(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[L10N_VERSION_CAP_KEY];
  if (!entry || entry.kind !== 'cap') return DEFAULT_L10N_VERSION_LIMIT;
  const fallback = 'free' as keyof typeof entry.values;
  const profile = (matrix.tiers.includes(tier as typeof matrix.tiers[number])
    ? (tier as typeof matrix.tiers[number])
    : fallback) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_L10N_VERSION_LIMIT;
  return Math.max(1, Math.floor(value));
}

export function resolveUploadSizeLimitBytes(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[UPLOAD_SIZE_CAP_KEY];
  if (!entry || entry.kind !== 'cap') return DEFAULT_UPLOAD_SIZE_MAX_BYTES;
  const fallback = 'free' as keyof typeof entry.values;
  const profile = (matrix.tiers.includes(tier as typeof matrix.tiers[number])
    ? (tier as typeof matrix.tiers[number])
    : fallback) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DEFAULT_UPLOAD_SIZE_MAX_BYTES;
  return Math.max(1, Math.floor(value));
}

export function resolveUploadsCountBudgetMax(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[UPLOADS_COUNT_BUDGET_KEY];
  if (!entry || entry.kind !== 'budget') return DEFAULT_UPLOADS_COUNT_MAX;
  const fallback = 'free' as keyof typeof entry.values;
  const profile = (matrix.tiers.includes(tier as typeof matrix.tiers[number])
    ? (tier as typeof matrix.tiers[number])
    : fallback) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return DEFAULT_UPLOADS_COUNT_MAX;
  return Math.floor(value);
}

export function resolveUploadsBytesBudgetMax(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[UPLOADS_BYTES_BUDGET_KEY];
  if (!entry || entry.kind !== 'budget') return DEFAULT_UPLOADS_BYTES_MAX;
  const fallback = 'free' as keyof typeof entry.values;
  const profile = (matrix.tiers.includes(tier as typeof matrix.tiers[number])
    ? (tier as typeof matrix.tiers[number])
    : fallback) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return DEFAULT_UPLOADS_BYTES_MAX;
  return Math.floor(value);
}

export async function loadWorkspaceTier(env: Env, workspaceId: string): Promise<string | null> {
  if (!isUuid(workspaceId)) return null;
  const params = new URLSearchParams({
    select: 'tier',
    id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase workspace read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ tier?: string | null }>;
  return rows?.[0]?.tier ?? null;
}

type WorkspaceUploadContext = {
  tier: string | null;
  accountId: string | null;
};

export type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

function normalizeMemberRole(value: unknown): MemberRole | null {
  switch (value) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return value;
    default:
      return null;
  }
}

export function roleRank(role: MemberRole): number {
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

export async function loadWorkspaceUploadContext(env: Env, workspaceId: string): Promise<WorkspaceUploadContext | null> {
  if (!isUuid(workspaceId)) return null;
  const params = new URLSearchParams({
    select: 'tier,account_id',
    id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase workspace read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{
    tier?: string | null;
    account_id?: string | null;
  }>;
  const row = rows?.[0];
  if (!row) return null;
  return {
    tier: typeof row.tier === 'string' ? row.tier : null,
    accountId: typeof row.account_id === 'string' ? row.account_id : null,
  };
}

export async function loadWorkspaceMembershipRole(
  env: Env,
  workspaceId: string,
  userId: string,
): Promise<MemberRole | null> {
  if (!isUuid(workspaceId) || !isUuid(userId)) return null;
  const params = new URLSearchParams({
    select: 'role',
    workspace_id: `eq.${workspaceId}`,
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspace_members?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase workspace membership read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ role?: unknown }>;
  return normalizeMemberRole(rows?.[0]?.role);
}

export async function loadAccountMembershipRole(env: Env, accountId: string, userId: string): Promise<MemberRole | null> {
  if (!isUuid(accountId) || !isUuid(userId)) return null;

  const workspaceParams = new URLSearchParams({
    select: 'id',
    account_id: `eq.${accountId}`,
    limit: '500',
  });
  const workspaceRes = await supabaseFetch(env, `/rest/v1/workspaces?${workspaceParams.toString()}`, { method: 'GET' });
  if (!workspaceRes.ok) {
    const text = await workspaceRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account workspaces read failed (${workspaceRes.status}) ${text}`.trim());
  }
  const workspaces = (await workspaceRes.json().catch(() => [])) as Array<{ id?: unknown }>;
  const workspaceIds = workspaces
    .map((row) => (typeof row.id === 'string' ? row.id.trim() : ''))
    .filter(Boolean);
  if (!workspaceIds.length) return null;

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
    const text = await membershipRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account membership read failed (${membershipRes.status}) ${text}`.trim());
  }

  const memberships = (await membershipRes.json().catch(() => [])) as Array<{ role?: unknown }>;
  let highest: MemberRole | null = null;
  memberships.forEach((entry) => {
    const role = normalizeMemberRole(entry.role);
    if (!role) return;
    if (!highest || roleRank(role) > roleRank(highest)) highest = role;
  });
  return highest;
}

type AccountAssetSource = 'bob.publish' | 'bob.export' | 'devstudio' | 'promotion' | 'api';

export function normalizeAccountAssetSource(raw: string | null): AccountAssetSource | null {
  const value = String(raw || '').trim();
  if (!value) return 'api';
  if (value === 'bob.publish' || value === 'bob.export' || value === 'devstudio' || value === 'promotion' || value === 'api') {
    return value;
  }
  return null;
}

type AccountUploadProfile = {
  status: 'active' | 'disabled';
};

export async function loadAccountUploadProfile(env: Env, accountId: string): Promise<AccountUploadProfile | null> {
  if (!isUuid(accountId)) return null;
  const params = new URLSearchParams({
    select: 'status',
    id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/accounts?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ status?: unknown }>;
  const row = rows?.[0];
  if (!row) return null;
  const status = row.status === 'disabled' ? 'disabled' : row.status === 'active' ? 'active' : null;
  if (!status) return null;
  return { status };
}

export async function persistAccountAssetMetadata(args: {
  env: Env;
  accountId: string;
  assetId: string;
  workspaceId?: string | null;
  publicId?: string | null;
  widgetType?: string | null;
  variant: string;
  key: string;
  source: AccountAssetSource;
  originalFilename: string;
  normalizedFilename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}): Promise<void> {
  const assetRow = {
    asset_id: args.assetId,
    account_id: args.accountId,
    workspace_id: args.workspaceId ?? null,
    public_id: args.publicId ?? null,
    widget_type: args.widgetType ?? null,
    source: args.source,
    original_filename: args.originalFilename,
    normalized_filename: args.normalizedFilename,
    content_type: args.contentType,
    size_bytes: args.sizeBytes,
    sha256: args.sha256,
  };
  const assetRes = await supabaseFetch(args.env, '/rest/v1/account_assets', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(assetRow),
  });
  if (!assetRes.ok) {
    const text = await assetRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_assets insert failed (${assetRes.status}) ${text}`.trim());
  }

  const variantRow = {
    asset_id: args.assetId,
    account_id: args.accountId,
    variant: args.variant,
    r2_key: args.key,
    filename: args.normalizedFilename,
    content_type: args.contentType,
    size_bytes: args.sizeBytes,
  };
  const variantRes = await supabaseFetch(args.env, '/rest/v1/account_asset_variants', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(variantRow),
  });
  if (!variantRes.ok) {
    const text = await variantRes.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_variants insert failed (${variantRes.status}) ${text}`.trim());
  }
}

type AccountAssetRow = {
  asset_id: string;
  account_id: string;
};

export async function loadAccountAssetByIdentity(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<AccountAssetRow | null> {
  const params = new URLSearchParams({
    select: 'asset_id,account_id',
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_assets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_assets read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as AccountAssetRow[];
  return rows?.[0] ?? null;
}

type AccountAssetVariantKeyRow = {
  variant?: string | null;
  r2_key?: string | null;
  filename?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
};

export async function loadAccountAssetVariantKeys(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    select: 'variant,r2_key',
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
    limit: '200',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_variants?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_variants list failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as AccountAssetVariantKeyRow[];
  return rows
    .map((row) => (typeof row.r2_key === 'string' ? row.r2_key.trim() : ''))
    .filter(Boolean);
}

export async function loadPrimaryAccountAssetKey(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    select: 'variant,r2_key',
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
    order: 'created_at.asc',
    limit: '32',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_variants?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_variants read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as AccountAssetVariantKeyRow[];
  if (!rows.length) return null;
  const original = rows.find((row) => typeof row.variant === 'string' && row.variant.toLowerCase() === 'original');
  const preferred = original ?? rows[0];
  const key = typeof preferred?.r2_key === 'string' ? preferred.r2_key.trim() : '';
  return key || null;
}

export type ReplaceAccountAssetAtomicResult = {
  previousKey: string | null;
  currentKey: string;
  replay: boolean;
};

export async function replaceAccountAssetVariantAtomic(args: {
  env: Env;
  accountId: string;
  assetId: string;
  variant: string;
  key: string;
  normalizedFilename: string;
  contentType: string;
  sizeBytes: number;
  source: AccountAssetSource;
  originalFilename: string;
  sha256: string;
  idempotencyKey: string;
  requestSha256: string;
}): Promise<ReplaceAccountAssetAtomicResult> {
  const res = await supabaseFetch(args.env, '/rest/v1/rpc/replace_account_asset_variant', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_account_id: args.accountId,
      p_asset_id: args.assetId,
      p_variant: args.variant,
      p_new_r2_key: args.key,
      p_filename: args.normalizedFilename,
      p_content_type: args.contentType,
      p_size_bytes: Math.max(0, Math.trunc(args.sizeBytes)),
      p_source: args.source,
      p_original_filename: args.originalFilename,
      p_sha256: args.sha256,
      p_idempotency_key: args.idempotencyKey,
      p_request_sha256: args.requestSha256,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const lowered = text.toLowerCase();
    if (res.status === 400 && lowered.includes('asset not found')) {
      const err = new Error('ASSET_NOT_FOUND');
      (err as Error & { code?: string }).code = 'ASSET_NOT_FOUND';
      throw err;
    }
    if (res.status === 400 && lowered.includes('idempotency key reused with different payload')) {
      const err = new Error('IDEMPOTENCY_CONFLICT');
      (err as Error & { code?: string }).code = 'IDEMPOTENCY_CONFLICT';
      throw err;
    }
    throw new Error(`[tokyo] Supabase replace_account_asset_variant failed (${res.status}) ${text}`.trim());
  }

  const rows = (await res.json().catch(() => [])) as Array<{
    previous_r2_key?: string | null;
    current_r2_key?: string | null;
    replay?: boolean | null;
  }>;
  const row = rows?.[0] ?? null;
  const currentKey = typeof row?.current_r2_key === 'string' ? row.current_r2_key.trim() : '';
  if (!currentKey) {
    throw new Error('[tokyo] replace_account_asset_variant returned empty current_r2_key');
  }
  return {
    previousKey: typeof row?.previous_r2_key === 'string' && row.previous_r2_key.trim() ? row.previous_r2_key.trim() : null,
    currentKey,
    replay: row?.replay === true,
  };
}

export async function loadAccountAssetUsageCountByIdentity(env: Env, accountId: string, assetId: string): Promise<number> {
  const params = new URLSearchParams({
    select: 'asset_id',
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
    limit: '5000',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_usage?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_usage read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ asset_id?: unknown }>;
  return rows.length;
}

export async function loadAccountAssetUsagePublicIdsByIdentity(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    select: 'public_id',
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
    limit: '5000',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_usage?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_usage public ids read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ public_id?: unknown }>;
  const out: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    const normalized = normalizePublicId(row?.public_id);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

export type InstanceRenderHealthStatus = 'healthy' | 'degraded' | 'error';

type InstanceRenderHealthUpsert = {
  publicId: string;
  status: InstanceRenderHealthStatus;
  reason?: string | null;
  detail?: string | null;
};

function normalizeRenderHealthReason(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  return value.slice(0, 120);
}

function normalizeRenderHealthDetail(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  return value.slice(0, 1000);
}

export async function upsertInstanceRenderHealth(
  env: Env,
  update: InstanceRenderHealthUpsert,
): Promise<void> {
  const publicId = normalizePublicId(update.publicId);
  if (!publicId) return;
  const status = update.status;
  if (status !== 'healthy' && status !== 'degraded' && status !== 'error') return;
  const row = {
    public_id: publicId,
    status,
    reason: normalizeRenderHealthReason(update.reason),
    detail: normalizeRenderHealthDetail(update.detail),
    updated_at: new Date().toISOString(),
  };
  const res = await supabaseFetch(env, '/rest/v1/instance_render_health?on_conflict=public_id', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase instance_render_health upsert failed (${res.status}) ${text}`.trim());
  }
}

export async function upsertInstanceRenderHealthBatch(
  env: Env,
  updates: InstanceRenderHealthUpsert[],
): Promise<void> {
  if (!updates.length) return;
  const rows = updates
    .map((update) => {
      const publicId = normalizePublicId(update.publicId);
      if (!publicId) return null;
      const status = update.status;
      if (status !== 'healthy' && status !== 'degraded' && status !== 'error') return null;
      return {
        public_id: publicId,
        status,
        reason: normalizeRenderHealthReason(update.reason),
        detail: normalizeRenderHealthDetail(update.detail),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is { public_id: string; status: InstanceRenderHealthStatus; reason: string | null; detail: string | null; updated_at: string } => Boolean(row));
  if (!rows.length) return;
  const res = await supabaseFetch(env, '/rest/v1/instance_render_health?on_conflict=public_id', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase instance_render_health batch upsert failed (${res.status}) ${text}`.trim());
  }
}

export async function deleteAccountAssetUsageByIdentity(env: Env, accountId: string, assetId: string): Promise<void> {
  const params = new URLSearchParams({
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_usage?${params.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_usage cleanup failed (${res.status}) ${text}`.trim());
  }
}

export async function deleteAccountAssetVariantsByIdentity(env: Env, accountId: string, assetId: string): Promise<void> {
  const params = new URLSearchParams({
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
  });
  const res = await supabaseFetch(env, `/rest/v1/account_asset_variants?${params.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_asset_variants cleanup failed (${res.status}) ${text}`.trim());
  }
}

export async function deleteAccountAssetByIdentity(env: Env, accountId: string, assetId: string): Promise<void> {
  const params = new URLSearchParams({
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
  });
  const res = await supabaseFetch(env, `/rest/v1/account_assets?${params.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account_assets cleanup failed (${res.status}) ${text}`.trim());
  }
}


export {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleReplaceAccountAssetContent,
  handleUploadAccountAsset,
} from './assets-handlers';

import { getEntitlementsMatrix } from '@clickeen/ck-policy';
import { isUuid } from '@clickeen/ck-contracts';
import {
  buildAccountAssetKey,
  guessContentTypeFromExt,
  json,
  normalizeAccountAssetReadKey,
  normalizePublicId,
  normalizeWidgetType,
  parseAccountAssetIdentityFromKey,
  pickExtension,
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

export async function loadAccountMembershipRole(env: Env, accountId: string, userId: string): Promise<MemberRole | null> {
  if (!isUuid(accountId) || !isUuid(userId)) return null;

  const params = new URLSearchParams({
    select: 'role',
    account_id: `eq.${accountId}`,
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_members?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account membership read failed (${res.status}) ${text}`.trim());
  }

  const rows = (await res.json().catch(() => [])) as Array<{ role?: unknown }>;
  return normalizeMemberRole(rows?.[0]?.role);
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
  tier: string | null;
};

export async function loadAccountUploadProfile(env: Env, accountId: string): Promise<AccountUploadProfile | null> {
  if (!isUuid(accountId)) return null;
  const params = new URLSearchParams({
    select: 'status,tier',
    id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/accounts?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[tokyo] Supabase account read failed (${res.status}) ${text}`.trim());
  }
  const rows = (await res.json().catch(() => [])) as Array<{ status?: unknown; tier?: unknown }>;
  const row = rows?.[0];
  if (!row) return null;
  const status = row.status === 'disabled' ? 'disabled' : row.status === 'active' ? 'active' : null;
  if (!status) return null;
  const tier = typeof row.tier === 'string' ? row.tier : null;
  return { status, tier };
}

export async function persistAccountAssetMetadata(args: {
  env: Env;
  accountId: string;
  assetId: string;
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
  const existing = await loadAccountAssetManifestByIdentity(args.env, args.accountId, args.assetId);
  const nowIso = new Date().toISOString();
  const nextVariant: AccountAssetVariantMeta = {
    variant: args.variant,
    key: args.key,
    filename: args.normalizedFilename,
    contentType: args.contentType,
    sizeBytes: args.sizeBytes,
    createdAt: nowIso,
  };
  const variants = (existing?.variants ?? []).filter((variant) => variant.variant !== args.variant);
  variants.push(nextVariant);

  const manifest: AccountAssetManifest = {
    assetId: args.assetId,
    accountId: args.accountId,
    publicId: args.publicId ?? existing?.publicId ?? null,
    widgetType: args.widgetType ?? existing?.widgetType ?? null,
    source: args.source,
    originalFilename: args.originalFilename,
    normalizedFilename: args.normalizedFilename,
    contentType: args.contentType,
    sizeBytes: args.sizeBytes,
    sha256: args.sha256,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    variants,
  };

  await saveAccountAssetManifest(args.env, manifest);
}

type AccountAssetRow = {
  asset_id: string;
  account_id: string;
};

export type AccountAssetVariantMeta = {
  variant: string;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type AccountAssetManifest = {
  assetId: string;
  accountId: string;
  publicId: string | null;
  widgetType: string | null;
  source: AccountAssetSource;
  originalFilename: string;
  normalizedFilename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  updatedAt: string;
  variants: AccountAssetVariantMeta[];
};

const ACCOUNT_ASSET_META_PREFIX = 'assets/meta/accounts';

function accountAssetManifestKey(accountId: string, assetId: string): string {
  return `${ACCOUNT_ASSET_META_PREFIX}/${accountId}/assets/${assetId}.json`;
}

function accountAssetManifestPrefix(accountId: string): string {
  return `${ACCOUNT_ASSET_META_PREFIX}/${accountId}/assets/`;
}

function normalizeAssetVariantMeta(raw: unknown): AccountAssetVariantMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const variant = typeof row.variant === 'string' ? row.variant.trim() : '';
  const key = typeof row.key === 'string' ? row.key.trim() : '';
  if (!variant || !key) return null;
  return {
    variant,
    key,
    filename: typeof row.filename === 'string' && row.filename.trim() ? row.filename.trim() : 'asset.bin',
    contentType:
      typeof row.contentType === 'string' && row.contentType.trim()
        ? row.contentType.trim()
        : 'application/octet-stream',
    sizeBytes:
      typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) && row.sizeBytes >= 0
        ? Math.floor(row.sizeBytes)
        : 0,
    createdAt:
      typeof row.createdAt === 'string' && row.createdAt.trim()
        ? row.createdAt.trim()
        : new Date().toISOString(),
  };
}

function normalizeAccountAssetManifest(raw: unknown): AccountAssetManifest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const accountId = typeof row.accountId === 'string' ? row.accountId.trim() : '';
  const assetId = typeof row.assetId === 'string' ? row.assetId.trim() : '';
  const source = normalizeAccountAssetSource(typeof row.source === 'string' ? row.source : null);
  if (!accountId || !assetId || !source) return null;
  return {
    accountId,
    assetId,
    publicId: typeof row.publicId === 'string' && row.publicId.trim() ? row.publicId.trim() : null,
    widgetType: typeof row.widgetType === 'string' && row.widgetType.trim() ? row.widgetType.trim() : null,
    source,
    originalFilename:
      typeof row.originalFilename === 'string' && row.originalFilename.trim()
        ? row.originalFilename.trim()
        : 'upload.bin',
    normalizedFilename:
      typeof row.normalizedFilename === 'string' && row.normalizedFilename.trim()
        ? row.normalizedFilename.trim()
        : 'upload.bin',
    contentType:
      typeof row.contentType === 'string' && row.contentType.trim()
        ? row.contentType.trim()
        : 'application/octet-stream',
    sizeBytes:
      typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) && row.sizeBytes >= 0
        ? Math.floor(row.sizeBytes)
        : 0,
    sha256: typeof row.sha256 === 'string' && row.sha256.trim() ? row.sha256.trim() : '',
    createdAt:
      typeof row.createdAt === 'string' && row.createdAt.trim()
        ? row.createdAt.trim()
        : new Date().toISOString(),
    updatedAt:
      typeof row.updatedAt === 'string' && row.updatedAt.trim()
        ? row.updatedAt.trim()
        : new Date().toISOString(),
    variants: Array.isArray(row.variants)
      ? row.variants
          .map((variant) => normalizeAssetVariantMeta(variant))
          .filter((variant): variant is AccountAssetVariantMeta => Boolean(variant))
      : [],
  };
}

async function saveAccountAssetManifest(env: Env, manifest: AccountAssetManifest): Promise<void> {
  await env.TOKYO_R2.put(accountAssetManifestKey(manifest.accountId, manifest.assetId), JSON.stringify(manifest), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function loadAccountAssetManifestByIdentity(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<AccountAssetManifest | null> {
  const key = accountAssetManifestKey(accountId, assetId);
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  const payload = (await obj.json().catch(() => null)) as unknown;
  const manifest = normalizeAccountAssetManifest(payload);
  if (!manifest) return null;
  if (manifest.accountId !== accountId || manifest.assetId !== assetId) return null;
  return manifest;
}

export async function listAccountAssetManifestsByAccount(
  env: Env,
  accountId: string,
): Promise<AccountAssetManifest[]> {
  const prefix = accountAssetManifestPrefix(accountId);
  const manifests: AccountAssetManifest[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor, limit: 1000 });
    const batch = await Promise.all(
      listed.objects.map(async (entry: { key?: string }) => {
        const key = typeof entry.key === 'string' ? entry.key.trim() : '';
        if (!key || !key.endsWith('.json')) return null;
        const obj = await env.TOKYO_R2.get(key);
        if (!obj) return null;
        const payload = (await obj.json().catch(() => null)) as unknown;
        const manifest = normalizeAccountAssetManifest(payload);
        if (!manifest) return null;
        if (manifest.accountId !== accountId) return null;
        return manifest;
      }),
    );
    batch.forEach((item: AccountAssetManifest | null) => {
      if (item) manifests.push(item);
    });
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return manifests;
}

export async function loadAccountAssetByIdentity(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<AccountAssetRow | null> {
  const manifest = await loadAccountAssetManifestByIdentity(env, accountId, assetId);
  if (!manifest) return null;
  return {
    asset_id: manifest.assetId,
    account_id: manifest.accountId,
  };
}

export type AccountAssetVariantIdentity = {
  assetId: string;
  r2Key: string;
};

export async function loadAccountAssetVariantKeys(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<string[]> {
  const manifest = await loadAccountAssetManifestByIdentity(env, accountId, assetId);
  if (!manifest) return [];
  return manifest.variants
    .map((variant) => variant.key)
    .filter(Boolean);
}

export async function loadAccountAssetVariantIdentitiesByAccount(
  env: Env,
  accountId: string,
): Promise<AccountAssetVariantIdentity[]> {
  const manifests = await listAccountAssetManifestsByAccount(env, accountId);
  const out: AccountAssetVariantIdentity[] = [];
  manifests.forEach((manifest) => {
    manifest.variants.forEach((variant) => {
      const r2Key = typeof variant.key === 'string' ? variant.key.trim() : '';
      if (!r2Key) return;
      out.push({ assetId: manifest.assetId, r2Key });
    });
  });
  return out;
}

export async function loadPrimaryAccountAssetKey(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<string | null> {
  const manifest = await loadAccountAssetManifestByIdentity(env, accountId, assetId);
  if (!manifest || !manifest.variants.length) return null;
  const original = manifest.variants.find((row) => row.variant.toLowerCase() === 'original');
  const preferred = original ?? manifest.variants[0];
  const key = typeof preferred?.key === 'string' ? preferred.key.trim() : '';
  return key || null;
}

export async function loadAccountAssetUsageCountByIdentity(_env: Env, _accountId: string, _assetId: string): Promise<number> {
  return 0;
}

export async function loadAccountAssetUsagePublicIdsByIdentity(
  _env: Env,
  _accountId: string,
  _assetId: string,
): Promise<string[]> {
  return [];
}

export async function deleteAccountAssetUsageByIdentity(_env: Env, _accountId: string, _assetId: string): Promise<void> {
  // Usage index is no longer persisted in Supabase.
}

export async function deleteAccountAssetVariantsByIdentity(_env: Env, _accountId: string, _assetId: string): Promise<void> {
  // Variant metadata is embedded in the asset manifest and removed with deleteAccountAssetByIdentity.
}

export async function deleteAccountAssetByIdentity(env: Env, accountId: string, assetId: string): Promise<void> {
  await env.TOKYO_R2.delete(accountAssetManifestKey(accountId, assetId));
}


export {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetIdentityIntegrity,
  handleGetAccountAssetMirrorIntegrity,
  handleListAccountAssetMetadata,
  handlePurgeAccountAssets,
  handleUploadAccountAsset,
} from './assets-handlers';

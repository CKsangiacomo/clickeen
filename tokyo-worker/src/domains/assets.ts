import { getEntitlementsMatrix } from '@clickeen/ck-policy';
import {
  classifyAccountAssetType,
  type AccountAssetType,
  normalizeAccountAssetReadKey,
  supabaseFetch,
} from '../index';
import type { Env } from '../index';

const L10N_VERSION_CAP_KEY = 'l10n.versions.max';
export const UPLOAD_SIZE_CAP_KEY = 'uploads.size.max';
export const STORAGE_BYTES_BUDGET_KEY = 'budget.uploads.bytes';
const ACCOUNT_STORAGE_USAGE_PREFIX = 'usage.storage.v1';

function resolveEntitlementTierOrThrow(tier: string | null): string {
  const normalized = typeof tier === 'string' ? tier.trim() : '';
  if (!normalized) {
    throw new Error('[tokyo] Missing account tier for entitlement resolution');
  }
  const matrix = getEntitlementsMatrix();
  if (!matrix.tiers.includes(normalized as typeof matrix.tiers[number])) {
    throw new Error(`[tokyo] Invalid account tier for entitlement resolution: ${normalized}`);
  }
  return normalized;
}

export function resolveL10nVersionLimit(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[L10N_VERSION_CAP_KEY];
  if (!entry || entry.kind !== 'cap') throw new Error(`[tokyo] Missing entitlement cap: ${L10N_VERSION_CAP_KEY}`);
  const profile = resolveEntitlementTierOrThrow(tier) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[tokyo] Invalid entitlement cap value for ${L10N_VERSION_CAP_KEY}`);
  }
  return Math.max(1, Math.floor(value));
}

export function resolveUploadSizeLimitBytes(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[UPLOAD_SIZE_CAP_KEY];
  if (!entry || entry.kind !== 'cap') throw new Error(`[tokyo] Missing entitlement cap: ${UPLOAD_SIZE_CAP_KEY}`);
  const profile = resolveEntitlementTierOrThrow(tier) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`[tokyo] Invalid entitlement cap value for ${UPLOAD_SIZE_CAP_KEY}`);
  }
  return Math.max(1, Math.floor(value));
}

export function resolveStorageBytesBudgetMax(tier: string | null): number | null {
  const matrix = getEntitlementsMatrix();
  const entry = matrix.capabilities[STORAGE_BYTES_BUDGET_KEY];
  if (!entry || entry.kind !== 'budget') throw new Error(`[tokyo] Missing entitlement budget: ${STORAGE_BYTES_BUDGET_KEY}`);
  const profile = resolveEntitlementTierOrThrow(tier) as keyof typeof entry.values;
  const value = entry.values[profile];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`[tokyo] Invalid entitlement budget value for ${STORAGE_BYTES_BUDGET_KEY}`);
  }
  return Math.floor(value);
}

function normalizeNonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.floor(value));
}

function accountStorageUsageKey(accountId: string, budgetKey = STORAGE_BYTES_BUDGET_KEY): string {
  return `${ACCOUNT_STORAGE_USAGE_PREFIX}.${budgetKey}.acct:${accountId}`;
}

async function writeAccountStoredBytesUsage(env: Env, accountId: string, totalBytes: number): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv) {
    throw new Error('[tokyo] Missing USAGE_KV for account storage usage mirror');
  }
  await kv.put(accountStorageUsageKey(accountId), String(normalizeNonNegativeInt(totalBytes)));
}

export type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

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

type AccountAssetSource = 'bob.publish' | 'bob.export' | 'devstudio' | 'promotion' | 'api';

export function normalizeAccountAssetSource(raw: string | null): AccountAssetSource | null {
  const value = String(raw || '').trim();
  if (!value) return 'api';
  if (value === 'bob.publish' || value === 'bob.export' || value === 'devstudio' || value === 'promotion' || value === 'api') {
    return value;
  }
  return null;
}


export async function persistAccountAssetMetadata(args: {
  env: Env;
  accountId: string;
  assetId: string;
  publicId?: string | null;
  widgetType?: string | null;
  key: string;
  source: AccountAssetSource;
  originalFilename: string;
  normalizedFilename: string;
  contentType: string;
  assetType: AccountAssetType;
  sizeBytes: number;
  sha256: string;
}): Promise<void> {
  const existing = await loadAccountAssetManifestByIdentity(args.env, args.accountId, args.assetId);
  const nowIso = new Date().toISOString();

  const manifest: AccountAssetManifest = {
    assetId: args.assetId,
    accountId: args.accountId,
    publicId: args.publicId ?? existing?.publicId ?? null,
    widgetType: args.widgetType ?? existing?.widgetType ?? null,
    source: args.source,
    originalFilename: args.originalFilename,
    normalizedFilename: args.normalizedFilename,
    contentType: args.contentType,
    assetType: args.assetType,
    sizeBytes: args.sizeBytes,
    sha256: args.sha256,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    key: args.key,
  };

  await saveAccountAssetManifest(args.env, manifest);
}

type AccountAssetRow = {
  asset_id: string;
  account_id: string;
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
  assetType: AccountAssetType;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  updatedAt: string;
  key: string;
};

export function sumAccountAssetManifestSizeBytes(manifests: AccountAssetManifest[]): number {
  return manifests.reduce((total, manifest) => total + normalizeNonNegativeInt(manifest.sizeBytes), 0);
}

const ACCOUNT_ASSET_META_PREFIX = 'assets/meta/accounts';

function accountAssetManifestKey(accountId: string, assetId: string): string {
  return `${ACCOUNT_ASSET_META_PREFIX}/${accountId}/assets/${assetId}.json`;
}

function accountAssetManifestPrefix(accountId: string): string {
  return `${ACCOUNT_ASSET_META_PREFIX}/${accountId}/assets/`;
}

function normalizeAssetManifestKey(row: Record<string, unknown>): string | null {
  const directRaw = typeof row.key === 'string' ? row.key.trim() : '';
  if (!directRaw) return null;
  const direct = normalizeAccountAssetReadKey(directRaw.startsWith('/') ? directRaw : `/${directRaw}`);
  return direct || null;
}

export function normalizeAccountAssetManifestStrict(raw: unknown): AccountAssetManifest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const accountId = typeof row.accountId === 'string' ? row.accountId.trim() : '';
  const assetId = typeof row.assetId === 'string' ? row.assetId.trim() : '';
  const source = normalizeAccountAssetSource(typeof row.source === 'string' ? row.source : null);
  if (!accountId || !assetId || !source) return null;
  const normalizedFilename =
    typeof row.normalizedFilename === 'string' && row.normalizedFilename.trim()
      ? row.normalizedFilename.trim()
      : 'upload.bin';
  const contentType =
    typeof row.contentType === 'string' && row.contentType.trim()
      ? row.contentType.trim()
      : 'application/octet-stream';
  const ext = normalizedFilename.includes('.') ? normalizedFilename.split('.').pop() || '' : '';
  const fallbackAssetType = classifyAccountAssetType(contentType, ext);
  const assetType =
    row.assetType === 'image' ||
    row.assetType === 'vector' ||
    row.assetType === 'video' ||
    row.assetType === 'audio' ||
    row.assetType === 'document' ||
    row.assetType === 'other'
      ? row.assetType
      : fallbackAssetType;
  const key = normalizeAssetManifestKey(row);
  if (!key) return null;
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
    normalizedFilename,
    contentType,
    assetType,
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
    key,
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
  const manifest = normalizeAccountAssetManifestStrict(payload);
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
        const manifest = normalizeAccountAssetManifestStrict(payload);
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

export async function loadAccountStoredBytesUsage(env: Env, accountId: string): Promise<number> {
  const manifests = await listAccountAssetManifestsByAccount(env, accountId);
  return sumAccountAssetManifestSizeBytes(manifests);
}

export async function syncAccountStoredBytesUsage(
  env: Env,
  accountId: string,
  manifests?: AccountAssetManifest[],
): Promise<number> {
  const totalBytes = manifests ? sumAccountAssetManifestSizeBytes(manifests) : await loadAccountStoredBytesUsage(env, accountId);
  await writeAccountStoredBytesUsage(env, accountId, totalBytes);
  return totalBytes;
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

export type AccountAssetBlobIdentity = {
  assetId: string;
  r2Key: string;
};

export async function loadAccountAssetBlobKeys(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<string[]> {
  const manifest = await loadAccountAssetManifestByIdentity(env, accountId, assetId);
  if (!manifest) return [];
  return manifest.key ? [manifest.key] : [];
}

export async function loadAccountAssetBlobIdentitiesByAccount(
  env: Env,
  accountId: string,
): Promise<AccountAssetBlobIdentity[]> {
  const manifests = await listAccountAssetManifestsByAccount(env, accountId);
  const out: AccountAssetBlobIdentity[] = [];
  manifests.forEach((manifest) => {
    const r2Key = typeof manifest.key === 'string' ? manifest.key.trim() : '';
    if (!r2Key) return;
    out.push({ assetId: manifest.assetId, r2Key });
  });
  return out;
}

export async function loadPrimaryAccountAssetKey(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<string | null> {
  const manifest = await loadAccountAssetManifestByIdentity(env, accountId, assetId);
  if (!manifest) return null;
  const key = typeof manifest.key === 'string' ? manifest.key.trim() : '';
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

export async function deleteAccountAssetByIdentity(env: Env, accountId: string, assetId: string): Promise<void> {
  await env.TOKYO_R2.delete(accountAssetManifestKey(accountId, assetId));
}


export {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetIdentityIntegrity,
  handleGetAccountAssetMirrorIntegrity,
  handleListAccountAssetMetadata,
  handleUploadAccountAsset,
} from './assets-handlers';

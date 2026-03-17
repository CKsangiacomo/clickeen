import { collectConfigMediaAssetIds, materializeConfigMedia } from '@clickeen/ck-contracts';
import { buildTokyoAssetControlHeaders, fetchTokyoAssetControl } from './tokyo-asset-control';

type ResolvedAccountAssetEntry = {
  assetId: string;
  assetRef: string;
  url: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeResolvedAccountAssetEntry(raw: unknown): ResolvedAccountAssetEntry | null {
  if (!isRecord(raw)) return null;
  const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
  const assetRef = typeof raw.assetRef === 'string' ? raw.assetRef.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!assetId || !assetRef || !url) return null;
  return { assetId, assetRef, url };
}

async function resolveTokyoAccountAssetsById(args: {
  accountId: string;
  accountCapsule?: string | null;
  assetIds: string[];
}): Promise<{
  assetsById: Map<string, ResolvedAccountAssetEntry>;
  missingAssetIds: string[];
}> {
  if (!args.assetIds.length) {
    return { assetsById: new Map(), missingAssetIds: [] };
  }

  const response = await fetchTokyoAssetControl({
    path: `/__internal/assets/account/${encodeURIComponent(args.accountId)}/resolve`,
    method: 'POST',
    headers: buildTokyoAssetControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      contentType: 'application/json',
    }),
    body: JSON.stringify({ assetIds: args.assetIds }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        assets?: unknown;
        missingAssetIds?: unknown;
        error?: { detail?: unknown; reasonKey?: unknown };
      }
    | null;

  if (!response.ok) {
    const detail =
      typeof payload?.error?.detail === 'string'
        ? payload.error.detail
        : typeof payload?.error?.reasonKey === 'string'
          ? payload.error.reasonKey
          : `tokyo_account_assets_resolve_http_${response.status}`;
    throw new Error(detail);
  }

  const assetsById = new Map<string, ResolvedAccountAssetEntry>();
  const assets = Array.isArray(payload?.assets) ? payload.assets : [];
  for (const asset of assets) {
    const normalized = normalizeResolvedAccountAssetEntry(asset);
    if (!normalized) continue;
    assetsById.set(normalized.assetId, normalized);
  }

  const missingAssetIds = Array.isArray(payload?.missingAssetIds)
    ? payload.missingAssetIds
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return { assetsById, missingAssetIds };
}

export async function materializeRuntimeConfigMedia(args: {
  accountId: string;
  accountCapsule?: string | null;
  config: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const assetIds = collectConfigMediaAssetIds(args.config);
  if (!assetIds.length) {
    return structuredClone(args.config);
  }

  const { assetsById, missingAssetIds } = await resolveTokyoAccountAssetsById({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    assetIds,
  });

  if (missingAssetIds.length) {
    throw new Error(`roma.errors.assets.resolve.missing:${missingAssetIds.join(',')}`);
  }

  const materialized = materializeConfigMedia(args.config, assetsById);
  if (!isRecord(materialized)) {
    throw new Error('roma.errors.assets.resolve.invalidMaterializedConfig');
  }
  return materialized;
}

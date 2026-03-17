import { collectConfigMediaAssetIds, materializeConfigMedia } from '@clickeen/ck-contracts';

type ResolvedAssetEntry = {
  assetId: string;
  assetRef: string;
  url: string;
};

type HostedAssetBridge = {
  resolveAssets: (assetIds: string[]) => Promise<unknown>;
};

const HOSTED_ASSET_BRIDGE_KEY = '__CK_CLICKEEN_HOSTED_ACCOUNT_ASSET_BRIDGE__';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeResolvedAssetEntry(raw: unknown): ResolvedAssetEntry | null {
  if (!isRecord(raw)) return null;
  const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
  const assetRef = typeof raw.assetRef === 'string' ? raw.assetRef.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!assetId || !assetRef || !url) return null;
  return { assetId, assetRef, url };
}

function resolveHostedAssetBridge(): HostedAssetBridge | null {
  const root = globalThis as Record<string, unknown>;
  const candidate = root[HOSTED_ASSET_BRIDGE_KEY];
  if (!isRecord(candidate)) return null;
  if (typeof candidate.resolveAssets !== 'function') return null;
  return {
    resolveAssets: candidate.resolveAssets as HostedAssetBridge['resolveAssets'],
  };
}

export function resolveRuntimeAssetApiBase(raw: string | null | undefined): string {
  return String(raw || '').trim().replace(/\/+$/, '');
}

export async function materializeRuntimeConfigForPreview(args: {
  config: Record<string, unknown>;
  accountId?: string | null;
  assetApiBase?: string | null;
}): Promise<Record<string, unknown>> {
  const assetIds = collectConfigMediaAssetIds(args.config);
  const assetApiBase = resolveRuntimeAssetApiBase(args.assetApiBase);
  const baseMaterialized = materializeConfigMedia(args.config, null);
  if (!isRecord(baseMaterialized)) {
    throw new Error('coreui.errors.assets.previewMaterialization.invalidConfig');
  }
  if (!assetIds.length) {
    return baseMaterialized;
  }

  const hostedBridge = resolveHostedAssetBridge();
  if (!hostedBridge && !assetApiBase) {
    throw new Error('coreui.errors.assets.previewMaterialization.missingContext');
  }
  let payload:
    | {
        assets?: unknown;
        missingAssetIds?: unknown;
        error?: { detail?: unknown; reasonKey?: unknown };
      }
    | null;

  if (hostedBridge) {
    payload = (await hostedBridge.resolveAssets(assetIds).catch((error) => {
      throw error instanceof Error ? error : new Error(String(error));
    })) as {
      assets?: unknown;
      missingAssetIds?: unknown;
      error?: { detail?: unknown; reasonKey?: unknown };
    } | null;
  } else {
    const response = await fetch(
      `${assetApiBase}/resolve`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ assetIds }),
      },
    );
    payload = (await response.json().catch(() => null)) as
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
            : `coreui.errors.assets.previewMaterialization.http_${response.status}`;
      throw new Error(detail);
    }
  }

  const missingAssetIds = Array.isArray(payload?.missingAssetIds)
    ? payload.missingAssetIds
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  if (missingAssetIds.length) {
    throw new Error(`coreui.errors.assets.previewMaterialization.missing:${missingAssetIds.join(',')}`);
  }

  const assetsById = new Map<string, ResolvedAssetEntry>();
  const assets = Array.isArray(payload?.assets) ? payload.assets : [];
  for (const asset of assets) {
    const normalized = normalizeResolvedAssetEntry(asset);
    if (!normalized) continue;
    assetsById.set(normalized.assetId, normalized);
  }

  const materialized = materializeConfigMedia(args.config, assetsById);
  if (!isRecord(materialized)) {
    throw new Error('coreui.errors.assets.previewMaterialization.invalidMaterializedConfig');
  }
  return materialized;
}

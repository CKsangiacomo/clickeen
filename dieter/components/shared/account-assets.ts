import {
  isUuid,
  normalizeAccountAssetRecord,
  normalizeResolvedAccountAsset,
  type AccountAssetRecord,
  type ResolvedAccountAsset,
} from '@clickeen/ck-contracts';

export type AccountAssetTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AccountAssetsClient = {
  listAssets: () => Promise<AccountAssetRecord[]>;
  resolveAssets: (assetIdsRaw: string[]) => Promise<{
    assetsById: Map<string, ResolvedAccountAsset>;
    missingAssetIds: string[];
  }>;
  uploadAsset: (file: File, source?: string) => Promise<AccountAssetRecord>;
};

type AccountAssetsListResponse = {
  assets?: unknown;
  error?: { reasonKey?: unknown; detail?: unknown };
};

type AccountAssetsResolveResponse = {
  assets?: unknown;
  missingAssetIds?: unknown;
  error?: { reasonKey?: unknown; detail?: unknown };
};

type AccountAssetUploadResponse = {
  assetId?: unknown;
  assetRef?: unknown;
  assetType?: unknown;
  filename?: unknown;
  url?: unknown;
  contentType?: unknown;
  sizeBytes?: unknown;
  createdAt?: unknown;
  error?: { reasonKey?: unknown; detail?: unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveApiErrorReason(payload: unknown, status: number, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    const reasonKey = asTrimmedString(payload.error.reasonKey);
    if (reasonKey) return reasonKey;
    const detail = asTrimmedString(payload.error.detail);
    if (detail) return detail;
  }
  return fallback || `HTTP_${status}`;
}

export function createAccountAssetsClient(fetchRoute: AccountAssetTransport): AccountAssetsClient {
  return {
    async listAssets(): Promise<AccountAssetRecord[]> {
      const response = await fetchRoute('/api/account/assets', {
        method: 'GET',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      const payload = (await response.json().catch(() => null)) as AccountAssetsListResponse | null;
      if (!response.ok) {
        throw new Error(resolveApiErrorReason(payload, response.status, 'coreui.errors.db.readFailed'));
      }
      const assets = Array.isArray(payload?.assets) ? payload.assets : [];
      return assets.map(normalizeAccountAssetRecord).filter((asset): asset is AccountAssetRecord => Boolean(asset));
    },

    async resolveAssets(assetIdsRaw: string[]): Promise<{
      assetsById: Map<string, ResolvedAccountAsset>;
      missingAssetIds: string[];
    }> {
      const seen = new Set<string>();
      const assetIds = assetIdsRaw
        .map((entry) => asTrimmedString(entry))
        .filter((assetId) => {
          if (!isUuid(assetId) || seen.has(assetId)) return false;
          seen.add(assetId);
          return true;
        });

      if (!assetIds.length) {
        return { assetsById: new Map(), missingAssetIds: [] };
      }

      const response = await fetchRoute('/api/account/assets/resolve', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ assetIds }),
      });
      const payload = (await response.json().catch(() => null)) as AccountAssetsResolveResponse | null;
      if (!response.ok) {
        throw new Error(resolveApiErrorReason(payload, response.status, 'coreui.errors.db.readFailed'));
      }

      const assetsById = new Map<string, ResolvedAccountAsset>();
      const assets = Array.isArray(payload?.assets) ? payload.assets : [];
      for (const asset of assets) {
        const normalized = normalizeResolvedAccountAsset(asset);
        if (!normalized) continue;
        assetsById.set(normalized.assetId, normalized);
      }

      const missingAssetIds = Array.isArray(payload?.missingAssetIds)
        ? payload.missingAssetIds
            .map((entry) => asTrimmedString(entry))
            .filter((entry): entry is string => Boolean(entry))
        : [];

      return { assetsById, missingAssetIds };
    },

    async uploadAsset(file: File, source = 'api'): Promise<AccountAssetRecord> {
      if (!(file instanceof File) || file.size <= 0) {
        throw new Error('coreui.errors.payload.empty');
      }

      const response = await fetchRoute('/api/account/assets/upload', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'content-type': file.type || 'application/octet-stream',
          'x-filename': file.name || 'upload.bin',
          'x-source': source,
        },
        body: file,
      });
      const payload = (await response.json().catch(() => null)) as AccountAssetUploadResponse | null;
      if (!response.ok) {
        throw new Error(resolveApiErrorReason(payload, response.status, 'coreui.errors.assets.uploadFailed'));
      }

      const normalized = normalizeAccountAssetRecord(payload);
      if (!normalized) {
        throw new Error('coreui.errors.assets.uploadFailed');
      }
      return normalized;
    },
  };
}

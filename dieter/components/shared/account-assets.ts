import type { AccountAssetRecord, ResolvedAccountAsset } from '@clickeen/ck-contracts';

export type { AccountAssetRecord, ResolvedAccountAsset } from '@clickeen/ck-contracts';

export type AccountAssetsTransport = {
  listAssets: () => Promise<Response>;
  resolveAssets: (assetRefs: string[]) => Promise<Response>;
  uploadAsset: (file: File, source: string) => Promise<Response>;
};

const ACCOUNT_ASSET_UPSELL_REASONS = new Set([
  'coreui.upsell.reason.limitReached',
  'coreui.upsell.reason.platform.uploads',
]);

export type AccountAssetsClient = {
  listAssets: () => Promise<AccountAssetRecord[]>;
  resolveAssets: (assetRefsRaw: string[]) => Promise<{
    assetsByRef: Map<string, ResolvedAccountAsset>;
  }>;
  uploadAsset: (file: File, source: string) => Promise<AccountAssetRecord>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isExactString(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value === value.trim(); }

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean { const actual = Object.keys(value); return actual.length === keys.length && keys.every((key) => actual.includes(key)); }

function resolveApiErrorReason(payload: unknown, status: number, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    const reasonKey = typeof payload.error.reasonKey === 'string' ? payload.error.reasonKey : '';
    if (reasonKey) return reasonKey;
    const detail = typeof payload.error.detail === 'string' ? payload.error.detail : '';
    if (detail) return detail;
  }
  return fallback || `HTTP_${status}`;
}

export function dispatchAccountAssetUpsell(root: HTMLElement, reasonKey: unknown): boolean {
  const normalizedReasonKey = typeof reasonKey === 'string' ? reasonKey : '';
  if (!ACCOUNT_ASSET_UPSELL_REASONS.has(normalizedReasonKey)) return false;
  root.dispatchEvent(
    new CustomEvent('bob-upsell', {
      detail: { reasonKey: normalizedReasonKey },
      bubbles: true,
    }),
  );
  return true;
}

export function createAccountAssetsClient(transport: AccountAssetsTransport): AccountAssetsClient {
  return {
    async listAssets(): Promise<AccountAssetRecord[]> {
      const response = await transport.listAssets();
      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        throw new Error(resolveApiErrorReason(payload, response.status, 'coreui.errors.db.readFailed'));
      }
      if (!Array.isArray(payload?.assets) || (payload.assets as unknown[]).some((asset) => !isRecord(asset) || !isExactString(asset.assetRef) || !isExactString(asset.assetType) || !isExactString(asset.filename) || !isExactString(asset.contentType) || !isExactString(asset.createdAt) || typeof asset.sizeBytes !== 'number' || !Number.isFinite(asset.sizeBytes))) throw new Error('coreui.errors.assets.payloadInvalid');
      return payload.assets as AccountAssetRecord[];
    },

    async resolveAssets(assetRefsRaw: string[]): Promise<{
      assetsByRef: Map<string, ResolvedAccountAsset>;
    }> {
      const requested = new Set(assetRefsRaw);
      if (requested.size !== assetRefsRaw.length) throw new Error('coreui.errors.assets.payloadInvalid');
      const response = await transport.resolveAssets(assetRefsRaw);
      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        throw new Error(resolveApiErrorReason(payload, response.status, 'coreui.errors.db.readFailed'));
      }

      if (!isRecord(payload) || !hasOnlyKeys(payload, ['assets']) || !Array.isArray(payload.assets) || payload.assets.length !== assetRefsRaw.length || (payload.assets as unknown[]).some((asset) => !isRecord(asset) || !hasOnlyKeys(asset, ['assetRef', 'url']) || !isExactString(asset.assetRef) || !isExactString(asset.url) || !requested.delete(asset.assetRef))) throw new Error('coreui.errors.assets.payloadInvalid');
      return { assetsByRef: new Map((payload.assets as ResolvedAccountAsset[]).map((asset) => [asset.assetRef, asset])) };
    },

    async uploadAsset(file: File, source: string): Promise<AccountAssetRecord> {
      if (!(file instanceof File) || file.size <= 0) {
        throw new Error('coreui.errors.payload.empty');
      }

      const response = await transport.uploadAsset(file, source);
      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        throw new Error(resolveApiErrorReason(payload, response.status, 'coreui.errors.assets.uploadFailed'));
      }

      if (!isRecord(payload) || !isExactString(payload.assetRef) || !isExactString(payload.assetType) || !isExactString(payload.filename) || !isExactString(payload.contentType) || !isExactString(payload.createdAt) || typeof payload.sizeBytes !== 'number' || !Number.isFinite(payload.sizeBytes)) throw new Error('coreui.errors.assets.uploadFailed');
      return payload as AccountAssetRecord;
    },
  };
}

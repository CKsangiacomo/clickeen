import { isUuid } from '@clickeen/ck-contracts';
import { type AssetPickerOverlayItem } from './asset-picker-overlay';

export type MediaAssetChoice = {
  assetRef: string;
  filename: string;
  assetType: string;
  contentType: string;
  sizeBytes: number;
  url: string;
};

export type AssetPickerMediaKind = 'image' | 'video';

function readFillDocumentDatasetValue(key: string): string {
  if (typeof document === 'undefined') return '';
  const value = (document.documentElement.dataset as Record<string, string | undefined>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function resolveImageAssetPickerContext(): { accountId: string } | null {
  const accountId = readFillDocumentDatasetValue('ckOwnerAccountId');
  if (!isUuid(accountId)) return null;
  return {
    accountId,
  };
}

export function formatAssetSizeLabel(sizeBytes: number): string {
  const safe = Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0;
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${Math.round(safe / 1024)} KB`;
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchMediaAssetChoices(kind: AssetPickerMediaKind): Promise<MediaAssetChoice[]> {
  const context = resolveImageAssetPickerContext();
  if (!context) {
    throw new Error('No account context available.');
  }

  const params = new URLSearchParams({
    view: 'all',
    limit: '200',
  });

  const response = await fetch(`/api/assets/${encodeURIComponent(context.accountId)}?${params.toString()}`, {
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const reasonKey = String((payload?.error as Record<string, unknown> | undefined)?.reasonKey || '').trim();
    throw new Error(reasonKey || `HTTP_${response.status}`);
  }

  const assets = Array.isArray(payload?.assets) ? (payload?.assets as Array<Record<string, unknown>>) : [];
  return assets
    .map((asset) => {
      const assetRef = String(asset.assetRef || '').trim();
      if (!assetRef.startsWith('assets/versions/')) return null;
      const assetType = String(asset.assetType || '').trim().toLowerCase();
      if (kind === 'image') {
        if (assetType !== 'image' && assetType !== 'vector') return null;
      } else if (assetType !== 'video') {
        return null;
      }
      const contentType = String(asset.contentType || '').trim().toLowerCase();
      const filename = String(asset.filename || '').trim();
      if (!filename) return null;
      const sizeBytes = Number(asset.sizeBytes);
      const url = String(asset.url || '').trim();
      if (!url || (!url.startsWith('/') && !/^https?:\/\//i.test(url))) return null;
      return {
        assetRef,
        filename,
        assetType,
        contentType,
        sizeBytes: Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0,
        url,
      } satisfies MediaAssetChoice;
    })
    .filter((asset): asset is MediaAssetChoice => Boolean(asset));
}

export function fetchImageAssetChoices(): Promise<MediaAssetChoice[]> {
  return fetchMediaAssetChoices('image');
}

export function fetchVideoAssetChoices(): Promise<MediaAssetChoice[]> {
  return fetchMediaAssetChoices('video');
}

export function toAssetPickerOverlayItems(assets: MediaAssetChoice[]): AssetPickerOverlayItem[] {
  return assets.map((asset) => ({
    assetId: asset.assetRef,
    normalizedFilename: asset.filename,
    contentType: asset.assetType || asset.contentType,
    sizeLabel: formatAssetSizeLabel(asset.sizeBytes),
    url: asset.url,
  }));
}

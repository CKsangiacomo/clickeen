import { isUuid } from '@clickeen/ck-contracts';
import { type AssetPickerOverlayItem } from './asset-picker-overlay';

export type ImageAssetChoice = {
  assetId: string;
  accountId: string;
  normalizedFilename: string;
  contentType: string;
  sizeBytes: number;
  usageCount: number;
  url: string;
};

function readFillDocumentDatasetValue(key: string): string {
  if (typeof document === 'undefined') return '';
  const value = (document.documentElement.dataset as Record<string, string | undefined>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function resolveImageAssetPickerContext(): { accountId: string; workspaceId: string | null } | null {
  const accountId = readFillDocumentDatasetValue('ckOwnerAccountId');
  if (!isUuid(accountId)) return null;
  const workspaceIdRaw = readFillDocumentDatasetValue('ckWorkspaceId');
  return {
    accountId,
    workspaceId: isUuid(workspaceIdRaw) ? workspaceIdRaw : null,
  };
}

export function formatAssetSizeLabel(sizeBytes: number): string {
  const safe = Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0;
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${Math.round(safe / 1024)} KB`;
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveAssetChoiceUrl(accountId: string, assetId: string): string {
  return `/arsenale/a/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}`;
}

export async function fetchImageAssetChoices(): Promise<ImageAssetChoice[]> {
  const context = resolveImageAssetPickerContext();
  if (!context) {
    throw new Error('No account context available.');
  }

  const params = new URLSearchParams({
    view: 'all',
    limit: '200',
  });
  if (context.workspaceId) params.set('workspaceId', context.workspaceId);

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
      const assetId = String(asset.assetId || '').trim();
      if (!isUuid(assetId)) return null;
      const contentType = String(asset.contentType || '').trim().toLowerCase();
      if (!contentType.startsWith('image/')) return null;
      const normalizedFilename = String(asset.normalizedFilename || '').trim() || `asset-${assetId.slice(0, 8)}`;
      const sizeBytes = Number(asset.sizeBytes);
      const usageCount = Number(asset.usageCount);
      return {
        assetId,
        accountId: context.accountId,
        normalizedFilename,
        contentType,
        sizeBytes: Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0,
        usageCount: Number.isFinite(usageCount) ? Math.max(0, Math.trunc(usageCount)) : 0,
        url: resolveAssetChoiceUrl(context.accountId, assetId),
      } satisfies ImageAssetChoice;
    })
    .filter((asset): asset is ImageAssetChoice => Boolean(asset));
}

export function toAssetPickerOverlayItems(assets: ImageAssetChoice[]): AssetPickerOverlayItem[] {
  return assets.map((asset) => ({
    assetId: asset.assetId,
    normalizedFilename: asset.normalizedFilename,
    contentType: asset.contentType,
    sizeLabel: formatAssetSizeLabel(asset.sizeBytes),
    usageCount: asset.usageCount,
    url: asset.url,
  }));
}

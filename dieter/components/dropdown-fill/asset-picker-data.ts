import { isUuid } from '@clickeen/ck-contracts';
import { type AssetPickerOverlayItem } from './asset-picker-overlay';
import {
  resolveEditorAssetChoices,
  type ResolvedEditorAssetChoice,
} from '../shared/assetResolve';

export type MediaAssetChoice = {
  assetId: string;
  assetRef: string;
  filename: string;
  assetType: string;
  contentType: string;
  sizeBytes: number;
  url: string;
};

export type AssetPickerMediaKind = 'image' | 'video';

export type ResolvedMediaAssetChoice = ResolvedEditorAssetChoice;

function readFillDocumentDatasetValue(key: string): string {
  if (typeof document === 'undefined') return '';
  const value = (document.documentElement.dataset as Record<string, string | undefined>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function resolveAssetApiBase(): string {
  return readFillDocumentDatasetValue('ckAssetApiBase').replace(/\/+$/, '');
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

function normalizeMediaAssetChoice(asset: Record<string, unknown>, kind?: AssetPickerMediaKind): MediaAssetChoice | null {
  const assetId = String(asset.assetId || '').trim();
  if (!isUuid(assetId)) return null;
  const assetRef = String(asset.assetRef || '').trim();
  if (!assetRef.startsWith('assets/versions/')) return null;
  const assetType = String(asset.assetType || '').trim().toLowerCase();
  if (kind === 'image') {
    if (assetType !== 'image' && assetType !== 'vector') return null;
  } else if (kind === 'video' && assetType !== 'video') {
    return null;
  }
  const contentType = String(asset.contentType || '').trim().toLowerCase();
  const filename = String(asset.filename || '').trim();
  const sizeBytes = Number(asset.sizeBytes);
  const url = String(asset.url || '').trim();
  if (!url || (!url.startsWith('/') && !/^https?:\/\//i.test(url))) return null;
  return {
    assetId,
    assetRef,
    filename,
    assetType,
    contentType,
    sizeBytes: Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0,
    url,
  } satisfies MediaAssetChoice;
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
  const assetApiBase = resolveAssetApiBase();
  const endpoint = assetApiBase
    ? `${assetApiBase}/${encodeURIComponent(context.accountId)}?${params.toString()}`
    : `/api/assets/${encodeURIComponent(context.accountId)}?${params.toString()}`;

  const response = await fetch(endpoint, {
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const reasonKey = String((payload?.error as Record<string, unknown> | undefined)?.reasonKey || '').trim();
    throw new Error(reasonKey || `HTTP_${response.status}`);
  }

  const assets = Array.isArray(payload?.assets) ? (payload?.assets as Array<Record<string, unknown>>) : [];
  return assets
    .map((asset) => normalizeMediaAssetChoice(asset, kind))
    .filter((asset): asset is MediaAssetChoice => Boolean(asset));
}

export function fetchImageAssetChoices(): Promise<MediaAssetChoice[]> {
  return fetchMediaAssetChoices('image');
}

export function fetchVideoAssetChoices(): Promise<MediaAssetChoice[]> {
  return fetchMediaAssetChoices('video');
}

export async function resolveMediaAssetChoices(
  assetIdsRaw: string[],
): Promise<Map<string, ResolvedMediaAssetChoice>> {
  return resolveEditorAssetChoices(assetIdsRaw);
}

export function toAssetPickerOverlayItems(assets: MediaAssetChoice[]): AssetPickerOverlayItem[] {
  return assets.map((asset) => ({
    assetId: asset.assetId,
    normalizedFilename: asset.filename,
    contentType: asset.assetType || asset.contentType,
    sizeLabel: formatAssetSizeLabel(asset.sizeBytes),
    url: asset.url,
  }));
}

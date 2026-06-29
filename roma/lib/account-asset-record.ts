import type { AccountAssetRecord, ResolvedAccountAsset } from '@clickeen/ck-contracts';

const ASSET_REF_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isExactAccountAssetRef(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 240) return false;
  if (value.trim() !== value || value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..' && ASSET_REF_SEGMENT_RE.test(segment));
}

function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value) && value === value.trim();
}

export function parseAccountAssetRecord(raw: unknown): AccountAssetRecord | null {
  if (!isRecord(raw)) return null;
  if (!isExactAccountAssetRef(raw.assetRef)) return null;
  if (!isNonEmptyTrimmedString(raw.assetType)) return null;
  if (!isNonEmptyTrimmedString(raw.filename)) return null;
  if (!isNonEmptyTrimmedString(raw.contentType)) return null;
  if (!isNonEmptyTrimmedString(raw.createdAt)) return null;
  if (typeof raw.sizeBytes !== 'number' || !Number.isFinite(raw.sizeBytes) || raw.sizeBytes < 0) return null;
  return {
    assetRef: raw.assetRef,
    assetType: raw.assetType,
    filename: raw.filename,
    contentType: raw.contentType,
    sizeBytes: Math.trunc(raw.sizeBytes),
    createdAt: raw.createdAt,
  };
}

export function parseResolvedAccountAsset(raw: unknown): ResolvedAccountAsset | null {
  if (!isRecord(raw)) return null;
  if (!isExactAccountAssetRef(raw.assetRef)) return null;
  if (!isNonEmptyTrimmedString(raw.url)) return null;
  if (!isNonEmptyTrimmedString(raw.assetType)) return null;
  if (!isNonEmptyTrimmedString(raw.contentType)) return null;
  return {
    assetRef: raw.assetRef,
    url: raw.url,
    assetType: raw.assetType,
    contentType: raw.contentType,
  };
}

export function isAccountAssetRef(value: unknown): value is string {
  return isExactAccountAssetRef(value);
}

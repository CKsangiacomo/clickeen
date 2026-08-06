import { isRecord } from '@clickeen/ck-contracts';
import { isAccountAssetRef } from './account-asset-record';

export type CatalogAssetMapping = {
  sourceAssetRef: string;
  destinationAssetRef: string;
};

function isDeclaredString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value) && value === value.trim();
}

export function parseCatalogAssetMappings(
  raw: unknown,
  expectedAssetRefs: string[],
): CatalogAssetMapping[] {
  if (!isRecord(raw) || Object.keys(raw).length !== 1 || !Array.isArray(raw.mappings)) {
    throw new Error('coreui.errors.catalog.assets.copyInvalid');
  }
  const expected = new Set(expectedAssetRefs);
  if (expected.size !== expectedAssetRefs.length) {
    throw new Error('coreui.errors.catalog.assets.copyInvalid');
  }
  const seen = new Set<string>();
  const mappings = raw.mappings.map((entry) => {
    if (!isRecord(entry) || Object.keys(entry).length !== 2) {
      throw new Error('coreui.errors.catalog.assets.copyInvalid');
    }
    const sourceAssetRef = entry.sourceAssetRef;
    const destinationAssetRef = entry.destinationAssetRef;
    if (
      !isDeclaredString(sourceAssetRef) ||
      !isDeclaredString(destinationAssetRef) ||
      !isAccountAssetRef(sourceAssetRef) ||
      !isAccountAssetRef(destinationAssetRef) ||
      !expected.has(sourceAssetRef) ||
      seen.has(sourceAssetRef)
    ) {
      throw new Error('coreui.errors.catalog.assets.copyInvalid');
    }
    seen.add(sourceAssetRef);
    return { sourceAssetRef, destinationAssetRef };
  });
  if (seen.size !== expected.size) throw new Error('coreui.errors.catalog.assets.copyInvalid');
  return mappings;
}

export function rewriteConfigMediaAssetRefs<T extends Record<string, unknown>>(
  config: T,
  mappings: CatalogAssetMapping[],
): T {
  const bySource = new Map(mappings.map((mapping) => [mapping.sourceAssetRef, mapping.destinationAssetRef]));
  const rewriteMedia = (media: Record<string, unknown>): Record<string, unknown> => ({
    ...media,
    ...(typeof media.assetRef === 'string' && bySource.has(media.assetRef)
      ? { assetRef: bySource.get(media.assetRef)! }
      : {}),
    ...(typeof media.posterAssetRef === 'string' && bySource.has(media.posterAssetRef)
      ? { posterAssetRef: bySource.get(media.posterAssetRef)! }
      : {}),
  });
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!isRecord(node)) return node;
    const mediaKey = node.type === 'image' && isRecord(node.image)
      ? 'image'
      : node.type === 'video' && isRecord(node.video)
        ? 'video'
        : null;
    return Object.fromEntries(Object.entries(node).map(([key, entry]) => [
      key,
      mediaKey === key ? rewriteMedia(entry as Record<string, unknown>) : visit(entry),
    ]));
  };
  return visit(config) as T;
}

export function discardConfigMediaAssets(
  config: Record<string, unknown>,
  assetRefs: string[],
): Record<string, unknown> {
  const discarded = new Set(assetRefs);
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!isRecord(node)) return node;
    const type = node.type;
    const media = type === 'image' && isRecord(node.image)
      ? node.image
      : type === 'video' && isRecord(node.video)
        ? node.video
        : null;
    if (
      media &&
      (
        (typeof media.assetRef === 'string' && discarded.has(media.assetRef)) ||
        (typeof media.posterAssetRef === 'string' && discarded.has(media.posterAssetRef))
      )
    ) {
      return { type: 'none' };
    }
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, visit(value)]));
  };
  return visit(config) as Record<string, unknown>;
}

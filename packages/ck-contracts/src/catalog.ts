export type CatalogPresentation = {
  thumbnailAssetRef: string;
  description: string;
  category: string;
  displayOrder: number;
};

export function parseCatalogPresentation(raw: unknown): CatalogPresentation | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const thumbnail = parseAccountAssetRef(value.thumbnailAssetRef);
  if (
    Object.keys(value).length !== 4 ||
    !thumbnail ||
    thumbnail.accountId !== 'CLICKEEN' ||
    typeof value.description !== 'string' ||
    !value.description.trim() ||
    typeof value.category !== 'string' ||
    !value.category.trim() ||
    typeof value.displayOrder !== 'number' ||
    !Number.isInteger(value.displayOrder) ||
    value.displayOrder < 0
  ) return null;
  return {
    thumbnailAssetRef: value.thumbnailAssetRef as string,
    description: value.description,
    category: value.category,
    displayOrder: value.displayOrder,
  };
}
import { parseAccountAssetRef } from './index';

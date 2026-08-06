import { parseCatalogPresentation, type CatalogPresentation } from '@clickeen/ck-contracts/catalog';

export type DevStudioCatalogTemplate = {
  templateId: string;
  templateName: string;
  widgetType: string;
  catalogPresentation: CatalogPresentation;
};

export type DevStudioCatalogSource = {
  sourceId: string;
  displayName: string;
  widgetType: string;
};

export type DevStudioCatalogCollection = {
  templates: DevStudioCatalogTemplate[];
  sources: DevStudioCatalogSource[];
  widgetTypes: string[];
};

function exactString(value: unknown): string {
  return typeof value === 'string' && value && value === value.trim() ? value : '';
}

function decodeTemplate(raw: unknown): DevStudioCatalogTemplate | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const templateId = exactString(value.templateId);
  const templateName = exactString(value.templateName);
  const widgetType = exactString(value.widgetType);
  const catalogPresentation = parseCatalogPresentation(value.catalogPresentation);
  if (!templateId || !templateName || !catalogPresentation || !widgetType) return null;
  return {
    templateId,
    templateName,
    widgetType,
    catalogPresentation,
  };
}

function decodeSource(raw: unknown): DevStudioCatalogSource | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const sourceId = exactString(value.sourceId);
  const displayName = exactString(value.displayName);
  const widgetType = exactString(value.widgetType);
  if (!sourceId || !displayName || !widgetType) return null;
  return {
    sourceId,
    displayName,
    widgetType,
  };
}

export function decodeCatalogCollection(raw: unknown): DevStudioCatalogCollection | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.templates) || !Array.isArray(value.sources)) return null;
  const templates = value.templates.map(decodeTemplate);
  const sources = value.sources.map(decodeSource);
  const rawWidgetTypes = value.widgetTypes;
  if (
    templates.some((entry) => !entry) ||
    sources.some((entry) => !entry) ||
    (rawWidgetTypes !== undefined && !Array.isArray(rawWidgetTypes))
  ) return null;
  const widgetTypes = Array.isArray(rawWidgetTypes) ? rawWidgetTypes.map(exactString) : [];
  if (widgetTypes.some((widgetType) => !widgetType)) return null;
  const resolvedTemplates = templates as DevStudioCatalogTemplate[];
  const resolvedSources = sources as DevStudioCatalogSource[];
  if (
    new Set(resolvedTemplates.map((template) => template.templateId)).size !== resolvedTemplates.length ||
    new Set(resolvedSources.map((source) => source.sourceId)).size !== resolvedSources.length ||
    new Set(widgetTypes).size !== widgetTypes.length
  ) return null;
  return {
    templates: resolvedTemplates,
    sources: resolvedSources,
    widgetTypes,
  };
}

export function decodeCatalogDetail(raw: unknown): DevStudioCatalogTemplate | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return decodeTemplate((raw as Record<string, unknown>).template);
}

export function readCatalogPresentation(raw: {
  thumbnailAssetRef: string;
  description: string;
  category: string;
  displayOrder: string;
}): CatalogPresentation | null {
  if (
    raw.thumbnailAssetRef !== raw.thumbnailAssetRef.trim() ||
    raw.description !== raw.description.trim() ||
    raw.category !== raw.category.trim() ||
    raw.displayOrder !== raw.displayOrder.trim() ||
    !/^\d+$/.test(raw.displayOrder)
  ) return null;
  const displayOrder = Number(raw.displayOrder);
  return parseCatalogPresentation({
    thumbnailAssetRef: raw.thumbnailAssetRef,
    description: raw.description,
    category: raw.category,
    displayOrder,
  });
}

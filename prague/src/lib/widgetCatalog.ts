import { isRecord } from '@clickeen/ck-contracts';
import widgetsManifest from '../../../tokyo/product/widgets/manifest.json';

export type PragueWidgetCatalogEntry = {
  widgetType: string;
  label: string;
  description: string;
  category: string;
  capabilities: {
    seoGeo: boolean;
  };
};

function parseWidgetCatalogEntry(value: unknown, index: number): PragueWidgetCatalogEntry {
  if (!isRecord(value)) {
    throw new Error(`prague.widgetCatalog.invalidEntry:${index}`);
  }

  const capabilities = value.capabilities;
  if (
    typeof value.widgetType !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.category !== 'string' ||
    !isRecord(capabilities) ||
    typeof capabilities.seoGeo !== 'boolean'
  ) {
    throw new Error(`prague.widgetCatalog.invalidEntry:${index}`);
  }

  return {
    widgetType: value.widgetType,
    label: value.label,
    description: value.description,
    category: value.category,
    capabilities: {
      seoGeo: capabilities.seoGeo,
    },
  };
}

function parseWidgetCatalogManifest(raw: unknown): PragueWidgetCatalogEntry[] {
  if (!isRecord(raw) || !Array.isArray(raw.widgets)) {
    throw new Error('prague.widgetCatalog.invalidManifest');
  }

  return raw.widgets.map(parseWidgetCatalogEntry);
}

const WIDGET_CATALOG = parseWidgetCatalogManifest(widgetsManifest);

export function resolvePragueWidgetCatalogEntry(widgetType: string): PragueWidgetCatalogEntry {
  const normalizedWidgetType = String(widgetType || '').trim();
  const entry = WIDGET_CATALOG.find(
    (candidate) => candidate.widgetType === normalizedWidgetType,
  );

  if (!entry) {
    throw new Error(`prague.widgetCatalog.missing:${normalizedWidgetType}`);
  }

  return entry;
}

export function resolvePragueWidgetLabel(widgetType: string): string {
  return resolvePragueWidgetCatalogEntry(widgetType).label;
}

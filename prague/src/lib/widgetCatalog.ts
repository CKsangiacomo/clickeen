import { isRecord } from '@clickeen/ck-contracts';
import countdownCatalog from '../../../tokyo/product/widgets/countdown/catalog.json';
import faqCatalog from '../../../tokyo/product/widgets/faq/catalog.json';
import logoshowcaseCatalog from '../../../tokyo/product/widgets/logoshowcase/catalog.json';

export type PragueWidgetCatalogEntry = {
  widgetType: string;
  label: string;
  description: string;
  category: string;
};

function parseWidgetCatalogEntry(widgetType: string, value: unknown, index: number): PragueWidgetCatalogEntry {
  if (!isRecord(value)) {
    throw new Error(`prague.widgetCatalog.invalidEntry:${index}`);
  }

  if (
    typeof value.label !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.category !== 'string'
  ) {
    throw new Error(`prague.widgetCatalog.invalidEntry:${index}`);
  }

  return {
    widgetType,
    label: value.label,
    description: value.description,
    category: value.category,
  };
}

const WIDGET_CATALOG = [
  parseWidgetCatalogEntry('faq', faqCatalog, 0),
  parseWidgetCatalogEntry('countdown', countdownCatalog, 1),
  parseWidgetCatalogEntry('logoshowcase', logoshowcaseCatalog, 2),
];

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

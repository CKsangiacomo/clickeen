export type PragueWidgetCatalogEntry = {
  widgetType: string;
  label: string;
  description: string;
  category: string;
};

const WIDGET_CATALOG: PragueWidgetCatalogEntry[] = [
  {
    widgetType: 'faq',
    label: 'FAQ',
    description: 'Answer common questions with grouped, editable content.',
    category: 'Support',
  },
  {
    widgetType: 'countdown',
    label: 'Countdown',
    description: 'Show launch, offer, or event timing in one active widget.',
    category: 'Conversion',
  },
  {
    widgetType: 'logoshowcase',
    label: 'Logo showcase',
    description: 'Display brand, customer, or partner logos from one saved config.',
    category: 'Social proof',
  },
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

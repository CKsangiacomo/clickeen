export type PragueWidgetLabelEntry = {
  widgetType: string;
  label: string;
  description: string;
  category: string;
};

const PRAGUE_WIDGET_LABELS: PragueWidgetLabelEntry[] = [
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

export function resolvePragueWidgetLabelEntry(widgetType: string): PragueWidgetLabelEntry {
  const normalizedWidgetType = String(widgetType || '').trim();
  const entry = PRAGUE_WIDGET_LABELS.find(
    (candidate) => candidate.widgetType === normalizedWidgetType,
  );

  if (!entry) {
    throw new Error(`prague.widgetLabel.missing:${normalizedWidgetType}`);
  }

  return entry;
}

export function resolvePragueWidgetLabel(widgetType: string): string {
  return resolvePragueWidgetLabelEntry(widgetType).label;
}

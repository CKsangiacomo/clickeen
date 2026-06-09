const LEGACY_WIDGET_TYPES = new Set(['split']);

export function isLegacyWidgetType(widgetType: string): boolean {
  return LEGACY_WIDGET_TYPES.has(widgetType);
}

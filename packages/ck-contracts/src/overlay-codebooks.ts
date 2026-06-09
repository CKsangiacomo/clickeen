const WIDGET_CODE_RE = /^[0-9A-Z]{3}$/;

export const WIDGET_OVERLAY_CODES = Object.freeze({
  'big-bang': 'BBG',
  calltoaction: 'CTA',
  cards: 'CRD',
  faq: 'FAQ',
  countdown: 'CTD',
  logoshowcase: 'LGS',
  split: 'SPL',
  'split-carousel-media': 'SCM',
  'split-media': 'SPM',
} as const);

export type WidgetOverlayType = keyof typeof WIDGET_OVERLAY_CODES;
export type WidgetOverlayCode = (typeof WIDGET_OVERLAY_CODES)[WidgetOverlayType];

const WIDGET_TYPES_BY_CODE = new Map<string, string>(
  Object.entries(WIDGET_OVERLAY_CODES).map(([widgetType, code]) => [code, widgetType]),
);

export function resolveWidgetOverlayCode(widgetType: string): WidgetOverlayCode | null {
  const code = WIDGET_OVERLAY_CODES[widgetType as WidgetOverlayType];
  return code && WIDGET_CODE_RE.test(code) ? code : null;
}

export function resolveWidgetTypeForOverlayCode(code: string): WidgetOverlayType | null {
  const widgetType = WIDGET_TYPES_BY_CODE.get(code);
  return widgetType && widgetType in WIDGET_OVERLAY_CODES ? (widgetType as WidgetOverlayType) : null;
}

export function listWidgetOverlayCodebook(): Array<{ widgetType: WidgetOverlayType; code: WidgetOverlayCode }> {
  return Object.entries(WIDGET_OVERLAY_CODES).map(([widgetType, code]) => ({
    widgetType: widgetType as WidgetOverlayType,
    code,
  }));
}

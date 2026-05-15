const WIDGET_CODE_RE = /^[0-9A-Z]{3}$/;
const LANGUAGE_CODE_RE = /^[0-9A-Z]{4}$/;

export const WIDGET_OVERLAY_CODES = Object.freeze({
  faq: 'FAQ',
  countdown: 'CTD',
  logoshowcase: 'LGS',
} as const);

export const LANGUAGE_OVERLAY_CODES = Object.freeze({
  en: 'EN00',
  es: 'ES00',
  pt: 'PT00',
  de: 'DE00',
  fr: 'FR00',
  it: 'IT00',
  nl: 'NL00',
  ja: 'JA00',
  'zh-hans': 'ZHHS',
  'zh-tw': 'ZHTW',
  hi: 'HI00',
  ko: 'KO00',
  pl: 'PL00',
  tr: 'TR00',
  ar: 'AR00',
  vi: 'VI00',
  id: 'ID00',
  th: 'TH00',
  he: 'HE00',
  uk: 'UK00',
  cs: 'CS00',
  ro: 'RO00',
  hu: 'HU00',
  sv: 'SV00',
  da: 'DA00',
  nb: 'NB00',
  fi: 'FI00',
  fil: 'FIL0',
  bn: 'BN00',
} as const);

export type WidgetOverlayType = keyof typeof WIDGET_OVERLAY_CODES;
export type WidgetOverlayCode = (typeof WIDGET_OVERLAY_CODES)[WidgetOverlayType];
export type LocaleOverlayCode = (typeof LANGUAGE_OVERLAY_CODES)[keyof typeof LANGUAGE_OVERLAY_CODES];

const WIDGET_TYPES_BY_CODE = new Map<string, string>(
  Object.entries(WIDGET_OVERLAY_CODES).map(([widgetType, code]) => [code, widgetType]),
);

const LOCALES_BY_CODE = new Map<string, string>(
  Object.entries(LANGUAGE_OVERLAY_CODES).map(([locale, code]) => [code, locale]),
);

export function resolveWidgetOverlayCode(widgetType: string): WidgetOverlayCode | null {
  const code = WIDGET_OVERLAY_CODES[widgetType as WidgetOverlayType];
  return code && WIDGET_CODE_RE.test(code) ? code : null;
}

export function resolveWidgetTypeForOverlayCode(code: string): WidgetOverlayType | null {
  const widgetType = WIDGET_TYPES_BY_CODE.get(code);
  return widgetType && widgetType in WIDGET_OVERLAY_CODES ? (widgetType as WidgetOverlayType) : null;
}

export function resolveLanguageOverlayCode(locale: string): LocaleOverlayCode | null {
  const code = LANGUAGE_OVERLAY_CODES[locale as keyof typeof LANGUAGE_OVERLAY_CODES];
  return code && LANGUAGE_CODE_RE.test(code) ? code : null;
}

export function resolveLocaleForLanguageOverlayCode(code: string): keyof typeof LANGUAGE_OVERLAY_CODES | null {
  const locale = LOCALES_BY_CODE.get(code);
  return locale && locale in LANGUAGE_OVERLAY_CODES ? (locale as keyof typeof LANGUAGE_OVERLAY_CODES) : null;
}

export function listWidgetOverlayCodebook(): Array<{ widgetType: WidgetOverlayType; code: WidgetOverlayCode }> {
  return Object.entries(WIDGET_OVERLAY_CODES).map(([widgetType, code]) => ({
    widgetType: widgetType as WidgetOverlayType,
    code,
  }));
}

export function listLanguageOverlayCodebook(): Array<{ locale: keyof typeof LANGUAGE_OVERLAY_CODES; code: LocaleOverlayCode }> {
  return Object.entries(LANGUAGE_OVERLAY_CODES).map(([locale, code]) => ({
    locale: locale as keyof typeof LANGUAGE_OVERLAY_CODES,
    code,
  }));
}

import { faqSchemaJsonLd } from './faq';

export function generateSchemaJsonLd(args: {
  widgetType: string;
  state: Record<string, unknown>;
  locale: string;
}): string {
  const widgetType = args.widgetType.trim().toLowerCase();
  if (widgetType === 'faq') {
    return faqSchemaJsonLd({ state: args.state, locale: args.locale });
  }
  return '';
}


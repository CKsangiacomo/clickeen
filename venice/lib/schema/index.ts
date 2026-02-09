import { faqExcerptHtml, faqSchemaJsonLd } from './faq';
import { countdownExcerptHtml } from './countdown';

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

export function generateExcerptHtml(args: {
  widgetType: string;
  state: Record<string, unknown>;
  locale: string;
}): string {
  const widgetType = args.widgetType.trim().toLowerCase();
  if (widgetType === 'faq') {
    return faqExcerptHtml({ state: args.state, locale: args.locale });
  }
  if (widgetType === 'countdown') {
    return countdownExcerptHtml({ state: args.state, locale: args.locale });
  }
  return '';
}

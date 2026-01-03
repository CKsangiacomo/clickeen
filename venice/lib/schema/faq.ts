import { stripHtmlToText } from './text';

type FaqState = {
  title?: string;
  sections?: Array<{
    id?: string;
    title?: string;
    faqs?: Array<{
      id?: string;
      question?: string;
      answer?: string;
    }>;
  }>;
  seoGeo?: { enabled?: boolean };
  seo?: {
    enableSchema?: boolean;
    canonicalUrl?: string;
  };
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function faqSchemaJsonLd(args: { state: Record<string, unknown>; locale: string }): string {
  const state = (asRecord(args.state) as unknown) as FaqState;
  const locale = args.locale.trim() || 'en';

  const enabled = state?.seoGeo?.enabled === true;
  const schemaEnabled = state?.seo?.enableSchema !== false;
  if (!enabled || !schemaEnabled) return '';

  const canonicalUrl = asString(state?.seo?.canonicalUrl).trim();
  const graph: Array<Record<string, unknown>> = [];

  const entities: Array<Record<string, unknown>> = [];
  (state?.sections || []).forEach((section) => {
    (section?.faqs || []).forEach((faq) => {
      const q = stripHtmlToText(asString(faq?.question));
      const a = stripHtmlToText(asString(faq?.answer));
      if (!q || !a) return;
      entities.push({
        '@type': 'Question',
        name: q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: a,
        },
      });
    });
  });

  const faqPage: Record<string, unknown> = {
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: entities,
  };
  if (canonicalUrl) {
    faqPage['@id'] = canonicalUrl;
    faqPage.url = canonicalUrl;
  }

  graph.push(faqPage);

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
    null,
    0,
  );
}


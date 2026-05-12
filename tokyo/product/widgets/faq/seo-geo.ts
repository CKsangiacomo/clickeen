import {
  asRecord,
  asString,
  escapeHtml,
  stripHtmlToText,
  type SeoGeoMetaPackGenerator,
} from "../shared/seo-geo";

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

function faqExcerptHtml(args: {
  state: Record<string, unknown>;
  locale: string;
}): string {
  const state = asRecord(args.state) as FaqState | null;
  const enabled = state?.seoGeo?.enabled === true;
  if (!enabled) return "";

  const locale = args.locale.trim() || "en";
  const title =
    stripHtmlToText(asString(state?.title)) || "Frequently Asked Questions";

  const items: Array<{ q: string; a: string }> = [];
  (state?.sections || []).forEach((section) => {
    (section?.faqs || []).forEach((faq) => {
      if (items.length >= 12) return;
      const q = stripHtmlToText(asString(faq?.question));
      const a = stripHtmlToText(asString(faq?.answer));
      if (!q || !a) return;
      items.push({ q, a });
    });
  });

  if (!items.length) return "";

  const rows = items
    .map(
      ({ q, a }) => `
      <div class="ck-excerpt__item">
        <dt class="ck-excerpt__q">${escapeHtml(q)}</dt>
        <dd class="ck-excerpt__a">${escapeHtml(a)}</dd>
      </div>`,
    )
    .join("");

  return `
  <section class="ck-excerpt ck-excerpt--faq" data-ck-excerpt="faq" data-ck-locale="${escapeHtml(
    locale,
  )}">
    <h2 class="ck-excerpt__title">${escapeHtml(title)}</h2>
    <dl class="ck-excerpt__list">
      ${rows}
    </dl>
  </section>
  `.trim();
}

function faqSchemaJsonLd(args: {
  state: Record<string, unknown>;
  locale: string;
}): string {
  const state = asRecord(args.state) as FaqState | null;
  const locale = args.locale.trim() || "en";
  const enabled = state?.seoGeo?.enabled === true;
  const schemaEnabled = state?.seo?.enableSchema !== false;
  if (!enabled || !schemaEnabled) return "";

  const canonicalUrl = asString(state?.seo?.canonicalUrl).trim();
  const entities: Array<Record<string, unknown>> = [];
  (state?.sections || []).forEach((section) => {
    (section?.faqs || []).forEach((faq) => {
      const q = stripHtmlToText(asString(faq?.question));
      const a = stripHtmlToText(asString(faq?.answer));
      if (!q || !a) return;
      entities.push({
        "@type": "Question",
        name: q,
        acceptedAnswer: {
          "@type": "Answer",
          text: a,
        },
      });
    });
  });

  const faqPage: Record<string, unknown> = {
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: entities,
  };
  if (canonicalUrl) {
    faqPage["@id"] = canonicalUrl;
    faqPage.url = canonicalUrl;
  }

  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [faqPage],
    },
    null,
    0,
  );
}

export const generateSeoGeoMetaPack: SeoGeoMetaPackGenerator = ({
  state,
  locale,
}) => ({
  schemaJsonLd: faqSchemaJsonLd({ state, locale }),
  excerptHtml: faqExcerptHtml({ state, locale }),
});

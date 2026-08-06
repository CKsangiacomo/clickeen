import { escapeHtml } from './html';
import { sanitizeInlineRichText } from './richtext';
import type {
  GenerateInstanceInput,
  SavedInstanceStructuredSource,
  WebCodeModuleSource,
} from './types';

const PUBLIC_ACCOUNT_ID = '__CK_PUBLIC_ACCOUNT_ID__';
const PUBLIC_INSTANCE_ID = '__CK_PUBLIC_INSTANCE_ID__';
const CLICKEEN_ORGANIZATION_ID = 'https://clickeen.com/#organization';
const CLICKEEN_APPLICATION_ID = 'https://clickeen.com/#webapplication';

const ATTRIBUTION_STYLES = `.ck-clickeen-attribution {
  box-sizing: border-box;
  display: flex;
  justify-content: flex-end;
  width: 100%;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
}

.ck-clickeen-attribution__link {
  display: inline-flex;
  align-items: center;
  border-radius: var(--control-radius-sm, 0.25rem);
  color: var(--color-text, currentColor);
  font: 500 var(--fs-12, 12px) / var(--lh-tight, 1.2) "Inter", sans-serif;
  text-decoration: none;
}

.ck-clickeen-attribution__link:hover {
  text-decoration: underline;
}
`;

export type SemanticJsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sourceText(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new Error(`ck.web_code.instance_semantic_source_invalid:${path}`);
  return value;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, key: string) => {
    if (key[0] !== '#') return named[key.toLowerCase()] ?? entity;
    const hexadecimal = key[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
    return String.fromCodePoint(codePoint);
  });
}

export function semanticPlainText(value: string): string {
  return decodeEntities(
    sanitizeInlineRichText(value)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  ).replace(/\s+/g, ' ').trim();
}

export function inlineSemanticJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function injectBeforeClosingTag(html: string, tag: 'head' | 'body', markup: string): string {
  const closingTag = `</${tag}>`;
  const index = html.toLowerCase().lastIndexOf(closingTag);
  if (index < 0) throw new Error(`ck.web_code.document_${tag}_missing`);
  return `${html.slice(0, index)}${markup}\n  ${html.slice(index)}`;
}

function replaceDocumentTitle(html: string, title: string): string {
  const titlePattern = /<title\b[^>]*>[\s\S]*?<\/title>/i;
  if (!titlePattern.test(html)) throw new Error('ck.web_code.document_title_missing');
  return html.replace(titlePattern, `<title>${escapeHtml(title)}</title>`);
}

function sourceHeader(source: SavedInstanceStructuredSource): { title: string; description: string } {
  const header = source.header;
  if (!isRecord(header)) throw new Error('ck.web_code.instance_semantic_source_invalid:header');
  return {
    title: semanticPlainText(sourceText(header.title, 'header.title')),
    description: semanticPlainText(sourceText(header.subtitleHtml, 'header.subtitleHtml')),
  };
}

function publicInstanceUrl(): string {
  return `https://clk.live/${PUBLIC_ACCOUNT_ID}/${PUBLIC_INSTANCE_ID}`;
}

function publicProductUrl(): string {
  return 'https://clickeen.com/';
}

function webPageSchema(args: {
  title: string;
  description: string;
  productId?: string;
  creditText?: string;
}): SemanticJsonObject {
  const url = publicInstanceUrl();
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    ...(args.title ? { name: args.title } : {}),
    ...(args.description ? { description: args.description } : {}),
    ...(args.productId ? { isBasedOn: { '@id': args.productId } } : {}),
    ...(args.creditText ? { creditText: args.creditText } : {}),
  };
}

export function visibleFaqMainEntity(source: SavedInstanceStructuredSource): SemanticJsonObject[] {
  const faq = source.faq;
  if (!isRecord(faq) || !Array.isArray(faq.sections)) {
    throw new Error('ck.web_code.instance_semantic_source_invalid:faq.sections');
  }
  const mainEntity: SemanticJsonObject[] = [];
  faq.sections.forEach((section, sectionIndex) => {
    if (!isRecord(section) || !Array.isArray(section.faqs)) {
      throw new Error(`ck.web_code.instance_semantic_source_invalid:faq.sections.${sectionIndex}.faqs`);
    }
    section.faqs.forEach((item, itemIndex) => {
      if (!isRecord(item)) {
        throw new Error(`ck.web_code.instance_semantic_source_invalid:faq.sections.${sectionIndex}.faqs.${itemIndex}`);
      }
      const path = `faq.sections.${sectionIndex}.faqs.${itemIndex}`;
      const question = semanticPlainText(sourceText(item.question, `${path}.question`));
      const answer = semanticPlainText(sourceText(item.answer, `${path}.answer`));
      if (!question || !answer) return;
      mainEntity.push({
        '@type': 'Question',
        name: question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answer,
        },
      });
    });
  });
  return mainEntity;
}

function faqSchema(source: SavedInstanceStructuredSource): SemanticJsonObject | null {
  const mainEntity = visibleFaqMainEntity(source);
  return mainEntity.length
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity }
    : null;
}

function schemaScript(name: string, schema: SemanticJsonObject): string {
  return `    <script type="application/ld+json" data-ck-schema="${name}">${inlineSemanticJson(schema)}</script>`;
}

export function applyInstanceSemantics(args: {
  html: string;
  definition: GenerateInstanceInput['definition'];
  source: SavedInstanceStructuredSource;
  settings: GenerateInstanceInput['settings'];
}): { html: string; styleModules: WebCodeModuleSource[] } {
  const productName = args.definition.displayName;
  if (typeof productName !== 'string' || !productName.trim()) {
    throw new Error('ck.web_code.widget_product_name_invalid');
  }

  const wantsCustomerSemantics = args.settings.seoGeoAeoEnabled;
  const wantsAttribution = args.settings.includeClickeenAttribution;
  const headMarkup: string[] = ['    <meta name="generator" content="Clickeen" />'];
  let html = args.html;

  let header: { title: string; description: string } | null = null;
  if (wantsCustomerSemantics || wantsAttribution) header = sourceHeader(args.source);

  if (wantsCustomerSemantics && header) {
    html = replaceDocumentTitle(html, header.title);
    if (header.description) {
      headMarkup.push(`    <meta name="description" content="${escapeHtml(header.description)}" />`);
    }
  }

  const instancePage = header ? webPageSchema({ title: header.title, description: header.description }) : null;
  if (wantsAttribution && header && instancePage) {
    const productUrl = publicProductUrl();
    const productId = CLICKEEN_APPLICATION_ID;
    const creditText = `Made with Clickeen — ${productName}`;
    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': CLICKEEN_ORGANIZATION_ID,
          name: 'Clickeen',
          url: 'https://clickeen.com/',
        },
        {
          '@type': 'WebApplication',
          '@id': productId,
          name: 'Clickeen',
          description: 'Create and publish customizable website widgets in multiple languages.',
          url: productUrl,
          provider: { '@id': CLICKEEN_ORGANIZATION_ID },
        },
        webPageSchema({
          title: header.title,
          description: header.description,
          productId,
          creditText,
        }),
      ],
    };
    headMarkup.push(schemaScript('clickeen-attribution', graph));
    html = injectBeforeClosingTag(
      html,
      'body',
      `    <aside class="ck-clickeen-attribution" aria-label="Clickeen attribution">\n      <a class="ck-clickeen-attribution__link" href="${productUrl}" target="_blank" rel="nofollow noreferrer">${escapeHtml(creditText)}</a>\n    </aside>`,
    );
  } else if (wantsCustomerSemantics && instancePage) {
    headMarkup.push(schemaScript('instance-webpage', {
      '@context': 'https://schema.org',
      ...instancePage,
    }));
  }

  if (wantsCustomerSemantics && args.definition.widgetType === 'faq') {
    const schema = faqSchema(args.source);
    if (schema) headMarkup.push(schemaScript('faq-page', schema));
  }

  html = injectBeforeClosingTag(html, 'head', headMarkup.join('\n'));
  return {
    html,
    styleModules: wantsAttribution
      ? [{ id: 'generated/clickeen-attribution.css', source: ATTRIBUTION_STYLES }]
      : [],
  };
}

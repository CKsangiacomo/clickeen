import { completeLocalizedPageFields } from '../account-translations/localized-html';

export type PageServingOverlay = {
  page: Record<string, string>;
  placements: Record<string, Record<string, string>>;
};

function replaceCoordinateAttribute(
  html: string,
  coordinate: string,
  attribute: string,
  value: string,
): string {
  const marker = `data-ck-page-public-coordinate="${coordinate}"`;
  const tagPattern = new RegExp(`<[^>]+${marker}[^>]*>`, 'g');
  const matches = Array.from(html.matchAll(tagPattern));
  if (matches.length !== 1) throw new Error(`tokyo.page_html.coordinate_invalid:${coordinate}`);
  const tag = matches[0]![0];
  const attributePattern = new RegExp(`(${attribute}=")[^"]*(")`);
  if (!attributePattern.test(tag)) throw new Error(`tokyo.page_html.coordinate_invalid:${coordinate}`);
  return html.replace(tag, tag.replace(attributePattern, `$1${value}$2`));
}

function replaceWebPageSchema(args: {
  html: string;
  locale: string;
  exactUrl: string;
  pageValues?: Record<string, string>;
}): string {
  const pattern = /(<script\b[^>]*data-ck-page-schema="webpage"[^>]*>)([\s\S]*?)(<\/script>)/;
  const match = args.html.match(pattern);
  if (!match) throw new Error('tokyo.page_html.webpage_schema_missing');
  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(match[2]!) as Record<string, unknown>;
  } catch {
    throw new Error('tokyo.page_html.webpage_schema_invalid');
  }
  schema['@id'] = `${args.exactUrl}#webpage`;
  schema.url = args.exactUrl;
  schema.inLanguage = args.locale;
  if (args.pageValues) {
    schema.name = args.pageValues.title;
    if (typeof args.pageValues.description === 'string') schema.description = args.pageValues.description;
    else delete schema.description;
  }
  const json = JSON.stringify(schema).replace(/</g, '\\u003c');
  return args.html.replace(pattern, `$1${json}$3`);
}

function semanticText(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, key: string) => {
      if (!key.startsWith('#')) return named[key.toLowerCase()] ?? entity;
      const hexadecimal = key[1]?.toLowerCase() === 'x';
      const point = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function replaceFaqSchema(html: string, placements: Record<string, Record<string, string>>): string {
  const pattern = /(<script\b[^>]*data-ck-page-schema="faq-page"[^>]*>)([\s\S]*?)(<\/script>)/;
  if (!pattern.test(html)) return html;
  const pairs = Object.values(placements).flatMap((values) =>
    Object.keys(values)
      .filter((path) => path.endsWith('.question'))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      .map((questionPath) => {
        const question = semanticText(values[questionPath] ?? '');
        const answer = semanticText(values[questionPath.replace(/\.question$/, '.answer')] ?? '');
        return question && answer ? { question, answer } : null;
      })
      .filter((entry): entry is { question: string; answer: string } => Boolean(entry)),
  );
  if (!pairs.length) return html.replace(pattern, '');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map((pair) => ({
      '@type': 'Question',
      name: pair.question,
      acceptedAnswer: { '@type': 'Answer', text: pair.answer },
    })),
  };
  const json = JSON.stringify(schema).replace(/</g, '\\u003c');
  return html.replace(pattern, `$1${json}$3`);
}

export function completePagePublicHtml(args: {
  html: string;
  baseLocale: string;
  locale: string;
  pageUrl: string;
  overlay?: PageServingOverlay;
}): string {
  const exactUrl = `${args.pageUrl}/${encodeURIComponent(args.locale)}`;
  let html = args.locale === args.baseLocale
    ? args.html
    : completeLocalizedPageFields({
        html: args.html,
        locale: args.locale,
        pageValues: args.overlay?.page ?? {},
        placementValues: args.overlay?.placements ?? {},
      });
  html = html.replaceAll('__CK_PUBLIC_PAGE_URL__', args.pageUrl);
  html = replaceCoordinateAttribute(html, 'canonical', 'href', exactUrl);
  html = replaceCoordinateAttribute(html, 'social-url', 'content', exactUrl);
  html = replaceWebPageSchema({
    html,
    locale: args.locale,
    exactUrl,
    pageValues: args.overlay?.page,
  });
  if (args.overlay) html = replaceFaqSchema(html, args.overlay.placements);
  if (/__CK_PUBLIC_[A-Z0-9_]+__/.test(html)) {
    throw new Error('tokyo.page_html.placeholder_unresolved');
  }
  return html;
}

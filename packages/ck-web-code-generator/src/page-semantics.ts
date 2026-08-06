import { escapeHtml } from './html';
import {
  inlineSemanticJson,
  visibleFaqMainEntity,
  type SemanticJsonObject,
} from './instance-semantics';
import type { GeneratePageInput, PagePlacementInput } from './types';

const PUBLIC_PAGE_URL = '__CK_PUBLIC_PAGE_URL__';

function optionalSourceText(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`ck.web_code.page_field_invalid:${path}`);
  return value.trim() ? value : null;
}

function socialImageUrl(input: GeneratePageInput): string | null {
  const assetRef = optionalSourceText(input.source.values.socialImageAssetRef, 'values.socialImageAssetRef');
  if (!assetRef) return null;
  const asset = input.context.assetsByRef[assetRef];
  if (
    !asset ||
    asset.assetRef !== assetRef ||
    asset.assetType !== 'image' ||
    !asset.contentType.startsWith('image/') ||
    !asset.url
  ) {
    throw new Error(`ck.web_code.page_social_image_unresolved:${assetRef}`);
  }
  return asset.url;
}

function schemaScript(name: string, schema: SemanticJsonObject, coordinate?: string): string {
  const coordinateAttribute = coordinate
    ? ` data-ck-page-public-coordinate="${coordinate}"`
    : '';
  return `    <script type="application/ld+json" data-ck-page-schema="${name}"${coordinateAttribute}>${inlineSemanticJson(schema)}</script>`;
}

function faqPageSchema(placements: PagePlacementInput[]): SemanticJsonObject | null {
  const mainEntity = placements.flatMap((placement) =>
    placement.source.widgetType === 'faq' ? visibleFaqMainEntity(placement.source) : [],
  );
  return mainEntity.length
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity }
    : null;
}

export function renderPageSemanticHead(
  input: GeneratePageInput,
  placements: PagePlacementInput[],
  publicLocales: string[],
): string {
  const title = input.source.values.title;
  const description = optionalSourceText(input.source.values.description, 'values.description');
  const socialTitle =
    optionalSourceText(input.source.values.socialTitle, 'values.socialTitle') ?? title;
  const socialDescription =
    optionalSourceText(input.source.values.socialDescription, 'values.socialDescription') ??
    description;
  const socialImage = socialImageUrl(input);
  const socialTitlePath = input.source.values.socialTitle ? 'values.socialTitle' : 'values.title';
  const socialDescriptionPath = input.source.values.socialDescription
    ? 'values.socialDescription'
    : 'values.description';
  const robots = input.source.robots === 'index-follow' ? 'index,follow' : 'noindex,follow';
  const lines = [
    '    <meta name="generator" content="Clickeen" />',
    `    <meta name="robots" content="${robots}" />`,
    `    <title data-ck-field-path="values.title" data-ck-field-target="text">${escapeHtml(title)}</title>`,
    ...(description
      ? [
          `    <meta name="description" content="${escapeHtml(description)}" data-ck-field-path="values.description" data-ck-field-target="attribute:content" />`,
        ]
      : []),
    `    <meta property="og:title" content="${escapeHtml(socialTitle)}" data-ck-field-path="${socialTitlePath}" data-ck-field-target="attribute:content" />`,
    ...(socialDescription
      ? [
          `    <meta property="og:description" content="${escapeHtml(socialDescription)}" data-ck-field-path="${socialDescriptionPath}" data-ck-field-target="attribute:content" />`,
        ]
      : []),
    '    <meta property="og:type" content="website" />',
    `    <meta name="twitter:card" content="${socialImage ? 'summary_large_image' : 'summary'}" />`,
    `    <meta name="twitter:title" content="${escapeHtml(socialTitle)}" data-ck-field-path="${socialTitlePath}" data-ck-field-target="attribute:content" />`,
    ...(socialDescription
      ? [
          `    <meta name="twitter:description" content="${escapeHtml(socialDescription)}" data-ck-field-path="${socialDescriptionPath}" data-ck-field-target="attribute:content" />`,
        ]
      : []),
  ];

  if (socialImage) {
    lines.push(
      `    <meta property="og:image" content="${escapeHtml(socialImage)}" />`,
      `    <meta name="twitter:image" content="${escapeHtml(socialImage)}" />`,
    );
  }

  if (input.source.isTemplate) return lines.join('\n');

  const exactUrl = `${PUBLIC_PAGE_URL}/${encodeURIComponent(input.source.baseLocale)}`;
  lines.push(
    `    <link rel="canonical" href="${exactUrl}" data-ck-page-public-coordinate="canonical" />`,
    `    <meta property="og:url" content="${exactUrl}" data-ck-page-public-coordinate="social-url" />`,
  );
  publicLocales.forEach((locale) => {
    lines.push(
      `    <link rel="alternate" hreflang="${escapeHtml(locale)}" href="${PUBLIC_PAGE_URL}/${encodeURIComponent(locale)}" data-ck-page-public-coordinate="alternate" />`,
    );
  });

  const webPage: SemanticJsonObject = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${exactUrl}#webpage`,
    url: exactUrl,
    name: title,
    ...(description ? { description } : {}),
    inLanguage: input.source.baseLocale,
    ...(socialImage
      ? { primaryImageOfPage: { '@type': 'ImageObject', contentUrl: socialImage } }
      : {}),
  };
  lines.push(schemaScript('webpage', webPage, 'webpage-jsonld'));

  const faqPage = faqPageSchema(placements);
  if (faqPage) lines.push(schemaScript('faq-page', faqPage));
  return lines.join('\n');
}

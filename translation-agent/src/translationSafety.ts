import { TranslationAgentError } from './errors';

export type TranslationSafetyItem = {
  path: string;
  type: 'string' | 'richtext';
  value: string;
};

type RichtextAnchorSignature = {
  href: string | null;
  hasVisibleText: boolean;
};

export const BRACE_PLACEHOLDER_PATTERN = /\{\{[^{}]+\}\}|\{[^{}]+\}/g;
const COLON_PLACEHOLDER_PATTERN = /(^|[^a-zA-Z0-9_])(:[a-zA-Z_][a-zA-Z0-9_]*)/g;
export const HTML_TAG_PATTERN = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?>/g;

function buildCountMap(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  values.forEach((value) => {
    const count = map.get(value) ?? 0;
    map.set(value, count + 1);
  });
  return map;
}

function countMapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a.entries()) {
    if ((b.get(key) ?? 0) !== value) return false;
  }
  return true;
}

function extractPlaceholders(value: string): string[] {
  const out: string[] = [];
  out.push(...(value.match(BRACE_PLACEHOLDER_PATTERN) ?? []));

  let match: RegExpExecArray | null;
  COLON_PLACEHOLDER_PATTERN.lastIndex = 0;
  while ((match = COLON_PLACEHOLDER_PATTERN.exec(value)) !== null) {
    if (match[2]) out.push(match[2]);
  }
  return out;
}

function assertPlaceholderParity(args: {
  source: string;
  translated: string;
  path: string;
  provider: string;
}) {
  const sourceMap = buildCountMap(extractPlaceholders(args.source));
  const translatedMap = buildCountMap(extractPlaceholders(args.translated));
  if (!countMapsEqual(sourceMap, translatedMap)) {
    throw new TranslationAgentError(502, { code: 'PROVIDER_ERROR', provider: args.provider, message: `Placeholder mismatch at path: ${args.path}` });
  }
}

function normalizeTagToken(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  const tagMatch = trimmed.match(/^<\s*(\/)?\s*([a-z][a-z0-9-]*)(?:\s[^>]*)?(\/)?\s*>$/i);
  if (!tagMatch) return null;
  const isClosing = Boolean(tagMatch[1]);
  const tag = tagMatch[2];
  const isSelfClosing = Boolean(tagMatch[3]) || trimmed.endsWith('/>');
  if (isClosing) return `</${tag}>`;
  if (isSelfClosing) return `<${tag}/>`;
  return `<${tag}>`;
}

function extractTagTokens(value: string): string[] {
  return (value.match(HTML_TAG_PATTERN) ?? [])
    .map((tag) => normalizeTagToken(tag))
    .filter((token): token is string => Boolean(token));
}

function assertRichtextTagParity(args: {
  source: string;
  translated: string;
  path: string;
  provider: string;
}) {
  const sourceTags = extractTagTokens(args.source);
  const translatedTags = extractTagTokens(args.translated);
  if (sourceTags.length !== translatedTags.length) {
    throw new TranslationAgentError(502, { code: 'PROVIDER_ERROR', provider: args.provider, message: `Richtext tag mismatch at path: ${args.path}` });
  }
  for (let i = 0; i < sourceTags.length; i += 1) {
    if (sourceTags[i] !== translatedTags[i]) {
      throw new TranslationAgentError(502, { code: 'PROVIDER_ERROR', provider: args.provider, message: `Richtext tag mismatch at path: ${args.path}` });
    }
  }
}

function extractAnchorHref(attrs: string): string | null {
  const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  const href = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
  return href || null;
}

function stripHtmlToVisibleText(value: string): string {
  return value.replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?>/g, '').replace(/&nbsp;/gi, ' ').trim();
}

function extractRichtextAnchors(value: string): RichtextAnchorSignature[] {
  const anchors: RichtextAnchorSignature[] = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    const attrs = match[1] ?? '';
    const innerHtml = match[2] ?? '';
    anchors.push({
      href: extractAnchorHref(attrs),
      hasVisibleText: stripHtmlToVisibleText(innerHtml).length > 0,
    });
  }
  return anchors;
}

function assertRichtextAnchorParity(args: {
  source: string;
  translated: string;
  path: string;
  provider: string;
}) {
  const sourceAnchors = extractRichtextAnchors(args.source);
  if (sourceAnchors.length === 0) return;
  const translatedAnchors = extractRichtextAnchors(args.translated);
  if (sourceAnchors.length !== translatedAnchors.length) {
    throw new TranslationAgentError(502, { code: 'PROVIDER_ERROR', provider: args.provider, message: `Richtext anchor count mismatch at path: ${args.path}` });
  }
  for (let i = 0; i < sourceAnchors.length; i += 1) {
    if (sourceAnchors[i].hasVisibleText !== translatedAnchors[i].hasVisibleText) {
      throw new TranslationAgentError(502, { code: 'PROVIDER_ERROR', provider: args.provider, message: `Richtext anchor text mismatch at path: ${args.path}` });
    }
    if (sourceAnchors[i].href !== translatedAnchors[i].href) {
      throw new TranslationAgentError(502, { code: 'PROVIDER_ERROR', provider: args.provider, message: `Richtext anchor href mismatch at path: ${args.path}` });
    }
  }
}

export function assertTranslationSafety(
  expected: TranslationSafetyItem,
  translatedValue: string,
  provider: string,
) {
  assertPlaceholderParity({
    source: expected.value,
    translated: translatedValue,
    path: expected.path,
    provider,
  });
  if (expected.type === 'richtext') {
    assertRichtextTagParity({
      source: expected.value,
      translated: translatedValue,
      path: expected.path,
      provider,
    });
    assertRichtextAnchorParity({
      source: expected.value,
      translated: translatedValue,
      path: expected.path,
      provider,
    });
  }
}

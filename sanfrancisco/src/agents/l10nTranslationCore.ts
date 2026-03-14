import { collectAllowlistedEntries } from '@clickeen/l10n';
import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import { callChatCompletion } from '../ai/chat';

export type AllowlistEntry = { path: string; type: 'string' | 'richtext' };
export type TranslationItem = { path: string; type: AllowlistEntry['type']; value: string };

type RichtextTagPlaceholder = { placeholder: string; tag: string };
export type RichtextMaskPlan = {
  path: string;
  source: string;
  masked: string;
  tags: RichtextTagPlaceholder[];
};
type RichtextSegmentPart =
  | { kind: 'tag'; value: string }
  | { kind: 'text'; value: string; segmentPath: string | null };
type RichtextSegmentPlan = {
  parts: RichtextSegmentPart[];
  segments: TranslationItem[];
};
type RichtextAnchorSignature = {
  href: string | null;
  hasVisibleText: boolean;
};

export const PROMPT_VERSION = 'l10n.instance.v1@2026-02-13.2';
export const POLICY_VERSION = 'l10n.ops.v1';

const MAX_BATCH_ITEMS = 80;
const MAX_BATCH_INPUT_CHARS = 4000;
export const MAX_TOTAL_ITEMS = 800;
export const MAX_TOTAL_INPUT_CHARS = 60000;
const MAX_TOKENS = 900;
const TIMEOUT_MS = 35_000;

const BRACE_PLACEHOLDER_PATTERN = /\{\{[^{}]+\}\}|\{[^{}]+\}/g;
const COLON_PLACEHOLDER_PATTERN = /(^|[^a-zA-Z0-9_])(:[a-zA-Z_][a-zA-Z0-9_]*)/g;
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?>/g;
const URL_PATTERN = /^https?:\/\/\S+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function collectTranslatableEntries(
  config: Record<string, unknown>,
  allowlist: AllowlistEntry[],
  includeEmpty = false,
): TranslationItem[] {
  const entries = collectAllowlistedEntries(config, allowlist, { includeEmpty: true });
  return entries
    .filter((entry) => includeEmpty || entry.value.trim())
    .map((entry) => ({ path: entry.path, type: entry.type, value: entry.value }));
}

export function buildSystemPrompt(locale: string): string {
  return [
    'You are a localization engine for Clickeen widgets.',
    `Translate into locale: ${locale}.`,
    '',
    'Rules:',
    '- Return ONLY JSON. No markdown, no extra text.',
    '- Keep the same item count and order as input.',
    '- Preserve paths exactly.',
    '- Preserve URLs, emails, brand names, and placeholders (e.g. {token}, {{token}}, :token).',
    '- For richtext values, preserve existing HTML tags and attributes; do not add new tags.',
    '- For richtext links, keep every meaningful linked phrase as linked text in output (do not move link text outside <a> tags).',
    '- Write in natural, native product/UI copy for the target locale (not literal translation).',
    '- If literal wording sounds awkward, rewrite idiomatically while preserving intent.',
    '- Prefer concise, fluent phrasing that reads as originally written in the locale.',
    '- Preserve acronym style from source; do not add parenthetical expansions that are not present in source text.',
    '- Especially for heading/title strings: keep standalone acronyms standalone (e.g. keep "B&B", do not expand to "B&B (...)").',
    '- Keep output length reasonably close to source unless natural phrasing requires otherwise.',
    '- Silently self-check fluency before final output.',
  ].join('\n');
}

export function buildUserPrompt(items: TranslationItem[]): string {
  const payload = items.map((item) => ({ path: item.path, type: item.type, value: item.value }));
  return [
    'Translate the following items.',
    'Return JSON array: [{"path":"...","value":"..."},...]',
    '',
    JSON.stringify(payload),
  ].join('\n');
}

export async function deepseekTranslate(args: {
  env: Env;
  grant: AIGrant;
  agentId: string;
  system: string;
  user: string;
}): Promise<{ content: string; usage: Usage }> {
  return callChatCompletion({
    env: args.env,
    grant: args.grant,
    agentId: args.agentId,
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
    temperature: 0.2,
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
  });
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  const objStart = trimmed.indexOf('{');
  const objEnd = trimmed.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    return trimmed.slice(objStart, objEnd + 1);
  }

  return trimmed;
}

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
  const braceMatches = value.match(BRACE_PLACEHOLDER_PATTERN) ?? [];
  out.push(...braceMatches);

  let match: RegExpExecArray | null;
  COLON_PLACEHOLDER_PATTERN.lastIndex = 0;
  while ((match = COLON_PLACEHOLDER_PATTERN.exec(value)) !== null) {
    if (match[2]) out.push(match[2]);
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeBracePlaceholderSpacing(source: string, translated: string): string {
  const sourceTokens = Array.from(new Set(source.match(BRACE_PLACEHOLDER_PATTERN) ?? []));
  if (!sourceTokens.length) return translated;
  let normalized = translated;
  sourceTokens.forEach((token) => {
    const isDouble = token.startsWith('{{') && token.endsWith('}}');
    const inner = token.slice(isDouble ? 2 : 1, isDouble ? -2 : -1).trim();
    if (!inner) return;
    const pattern = isDouble
      ? new RegExp(`\\{\\{\\s*${escapeRegExp(inner)}\\s*\\}\\}`, 'g')
      : new RegExp(`\\{\\s*${escapeRegExp(inner)}\\s*\\}`, 'g');
    normalized = normalized.replace(pattern, token);
  });
  return normalized;
}

function splitPathSegments(pathStr: string): string[] {
  return String(pathStr || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isNumericSegment(seg: string): boolean {
  return /^\d+$/.test(seg);
}

function pathMatchesPattern(pathStr: string, pattern: string): boolean {
  const pathSegs = splitPathSegments(pathStr);
  const patternSegs = splitPathSegments(pattern);
  if (pathSegs.length !== patternSegs.length) return false;
  for (let i = 0; i < patternSegs.length; i += 1) {
    const pat = patternSegs[i] ?? '';
    const actual = pathSegs[i] ?? '';
    if (pat === '*') {
      if (!isNumericSegment(actual)) return false;
      continue;
    }
    if (pat !== actual) return false;
  }
  return true;
}

export function expandPathPatterns(patterns: string[], candidates: string[]): string[] {
  const out = new Set<string>();
  for (const raw of patterns) {
    const pattern = String(raw || '').trim();
    if (!pattern) continue;
    if (!pattern.includes('*')) {
      out.add(pattern);
      continue;
    }
    for (const candidate of candidates) {
      if (pathMatchesPattern(candidate, pattern)) out.add(candidate);
    }
  }
  return Array.from(out);
}

export function deleteMergedByPathOrPattern(merged: Map<string, string>, pathOrPattern: string): void {
  if (!pathOrPattern.includes('*')) {
    merged.delete(pathOrPattern);
    return;
  }
  for (const key of Array.from(merged.keys())) {
    if (pathMatchesPattern(key, pathOrPattern)) merged.delete(key);
  }
}

export function isLikelyNonTranslatableLiteral(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (URL_PATTERN.test(trimmed)) return true;
  if (EMAIL_PATTERN.test(trimmed)) return true;
  if (!/[a-zA-Z]/.test(trimmed)) return true;
  return false;
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
  const matches = value.match(HTML_TAG_PATTERN) ?? [];
  return matches
    .map((tag) => normalizeTagToken(tag))
    .filter((token): token is string => Boolean(token));
}

export function buildRichtextMaskPlan(entry: TranslationItem): RichtextMaskPlan | null {
  if (entry.type !== 'richtext') return null;
  let index = 0;
  const tags: RichtextTagPlaceholder[] = [];
  const masked = entry.value.replace(HTML_TAG_PATTERN, (tag) => {
    const placeholder = `{{__CK_L10N_TAG_${index}__}}`;
    index += 1;
    tags.push({ placeholder, tag });
    return placeholder;
  });
  if (!tags.length) return null;
  return {
    path: entry.path,
    source: entry.value,
    masked,
    tags,
  };
}

export function normalizeMaskedTagPlaceholders(value: string, tags: RichtextTagPlaceholder[]): string {
  let normalized = value;
  tags.forEach(({ placeholder }) => {
    const inner = placeholder.slice(2, -2);
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(inner)}\\s*\\}\\}`, 'g');
    normalized = normalized.replace(pattern, placeholder);
  });
  return normalized;
}

export function restoreMaskedRichtextTags(value: string, tags: RichtextTagPlaceholder[]): string {
  let restored = value;
  tags.forEach(({ placeholder, tag }) => {
    restored = restored.split(placeholder).join(tag);
  });
  return restored;
}

function buildRichtextSegmentPlan(entry: TranslationItem): RichtextSegmentPlan {
  const parts: RichtextSegmentPart[] = [];
  const segments: TranslationItem[] = [];
  let lastIndex = 0;
  let segmentIndex = 0;
  HTML_TAG_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = HTML_TAG_PATTERN.exec(entry.value)) !== null) {
    if (match.index > lastIndex) {
      const text = entry.value.slice(lastIndex, match.index);
      if (text) {
        const translatable = text.trim() && !isLikelyNonTranslatableLiteral(text);
        const segmentPath = translatable ? `${entry.path}::__segment__:${segmentIndex}` : null;
        parts.push({ kind: 'text', value: text, segmentPath });
        if (segmentPath) {
          segments.push({ path: segmentPath, type: 'string', value: text });
          segmentIndex += 1;
        }
      }
    }
    parts.push({ kind: 'tag', value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < entry.value.length) {
    const text = entry.value.slice(lastIndex);
    const translatable = text.trim() && !isLikelyNonTranslatableLiteral(text);
    const segmentPath = translatable ? `${entry.path}::__segment__:${segmentIndex}` : null;
    parts.push({ kind: 'text', value: text, segmentPath });
    if (segmentPath) {
      segments.push({ path: segmentPath, type: 'string', value: text });
    }
  } else if (parts.length === 0) {
    const text = entry.value;
    const translatable = text.trim() && !isLikelyNonTranslatableLiteral(text);
    const segmentPath = translatable ? `${entry.path}::__segment__:0` : null;
    parts.push({ kind: 'text', value: text, segmentPath });
    if (segmentPath) {
      segments.push({ path: segmentPath, type: 'string', value: text });
    }
  }

  return { parts, segments };
}

function rebuildRichtextFromSegments(
  plan: RichtextSegmentPlan,
  translatedSegments: Map<string, string>,
): string {
  return plan.parts
    .map((part) => {
      if (part.kind === 'tag') return part.value;
      if (!part.segmentPath) return part.value;
      const translated = translatedSegments.get(part.segmentPath);
      if (typeof translated !== 'string') {
        throw new HttpError(502, {
          code: 'PROVIDER_ERROR',
          provider: 'deepseek',
          message: `Missing translated richtext segment: ${part.segmentPath}`,
        });
      }
      return translated;
    })
    .join('');
}

function assertPlaceholderParity(args: {
  source: string;
  translated: string;
  path: string;
  provider: string;
}) {
  const sourceTokens = extractPlaceholders(args.source);
  const translatedTokens = extractPlaceholders(args.translated);
  const sourceMap = buildCountMap(sourceTokens);
  const translatedMap = buildCountMap(translatedTokens);
  if (!countMapsEqual(sourceMap, translatedMap)) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: args.provider,
      message: `Placeholder mismatch at path: ${args.path}`,
    });
  }
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
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: args.provider,
      message: `Richtext tag mismatch at path: ${args.path}`,
    });
  }
  for (let i = 0; i < sourceTags.length; i += 1) {
    if (sourceTags[i] !== translatedTags[i]) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider: args.provider,
        message: `Richtext tag mismatch at path: ${args.path}`,
      });
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
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: args.provider,
      message: `Richtext anchor count mismatch at path: ${args.path}`,
    });
  }
  for (let i = 0; i < sourceAnchors.length; i += 1) {
    if (sourceAnchors[i].hasVisibleText !== translatedAnchors[i].hasVisibleText) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider: args.provider,
        message: `Richtext anchor text mismatch at path: ${args.path}`,
      });
    }
    if (sourceAnchors[i].href !== translatedAnchors[i].href) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider: args.provider,
        message: `Richtext anchor href mismatch at path: ${args.path}`,
      });
    }
  }
}

export function assertTranslationSafety(
  expected: TranslationItem,
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

export function chunkTranslationEntries(entries: TranslationItem[]): TranslationItem[][] {
  const batches: TranslationItem[][] = [];
  let current: TranslationItem[] = [];
  let currentChars = 0;

  for (const entry of entries) {
    const nextChars = entry.value.length;
    if (nextChars > MAX_BATCH_INPUT_CHARS) {
      throw new HttpError(400, {
        code: 'BAD_REQUEST',
        message: `Item too large for translation batch (${entry.path})`,
      });
    }
    const exceedItems = current.length >= MAX_BATCH_ITEMS;
    const exceedChars = currentChars + nextChars > MAX_BATCH_INPUT_CHARS;
    if (current.length > 0 && (exceedItems || exceedChars)) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(entry);
    currentChars += nextChars;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

export function mergeUsage(base: Usage | undefined, next: Usage): Usage {
  if (!base) return { ...next };
  const out: Usage = {
    provider: base.provider || next.provider,
    model: base.model || next.model,
    promptTokens: (base.promptTokens ?? 0) + (next.promptTokens ?? 0),
    completionTokens: (base.completionTokens ?? 0) + (next.completionTokens ?? 0),
    latencyMs: (base.latencyMs ?? 0) + (next.latencyMs ?? 0),
  };
  if (base.costUsd != null || next.costUsd != null) {
    out.costUsd = (base.costUsd ?? 0) + (next.costUsd ?? 0);
  }
  return out;
}

export function parseTranslationResult(
  raw: string,
  expected: TranslationItem[],
  provider = 'deepseek',
): Array<{ path: string; value: string }> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    const candidate = extractJsonPayload(raw);
    try {
      json = JSON.parse(candidate);
    } catch {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider,
        message: 'Invalid JSON response',
      });
    }
  }

  const items = Array.isArray(json)
    ? json
    : isRecord(json) && Array.isArray((json as any).items)
      ? (json as any).items
      : null;
  if (!items) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider,
      message: 'Expected JSON array response',
    });
  }

  const expectedPaths = new Set(expected.map((item) => item.path));
  const seen = new Set<string>();
  const mapped = new Map<string, string>();

  items.forEach((entry: unknown, index: number) => {
    if (!isRecord(entry)) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider,
        message: `Item ${index} is not an object`,
      });
    }
    const path = asString(entry.path);
    const value = asString(entry.value);
    if (!path || value == null) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider,
        message: `Item ${index} missing path/value`,
      });
    }
    if (!expectedPaths.has(path)) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider,
        message: `Unexpected path: ${path}`,
      });
    }
    if (seen.has(path)) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider,
        message: `Duplicate path: ${path}`,
      });
    }
    seen.add(path);
    mapped.set(path, value);
  });

  if (mapped.size !== expected.length) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider,
      message: 'Translation output size mismatch',
    });
  }

  return expected.map((item) => {
    const value = mapped.get(item.path);
    if (typeof value !== 'string') {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider,
        message: `Missing translated value for path: ${item.path}`,
      });
    }
    const normalizedValue = normalizeBracePlaceholderSpacing(item.value, value);
    assertTranslationSafety(item, normalizedValue, provider);
    return { path: item.path, value: normalizedValue };
  });
}

export async function translateRichtextWithSegmentFallback(args: {
  env: Env;
  grant: AIGrant;
  agentId: string;
  locale: string;
  expected: TranslationItem;
}): Promise<{ value: string; usage?: Usage }> {
  const plan = buildRichtextSegmentPlan(args.expected);
  if (plan.segments.length === 0) {
    return { value: args.expected.value };
  }
  const system = buildSystemPrompt(args.locale);
  const batches = chunkTranslationEntries(plan.segments);
  const translatedSegments = new Map<string, string>();
  let usage: Usage | undefined;

  for (const batch of batches) {
    const user = buildUserPrompt(batch);
    const result = await deepseekTranslate({
      env: args.env,
      grant: args.grant,
      agentId: args.agentId,
      system,
      user,
    });
    usage = mergeUsage(usage, result.usage);
    const translated = parseTranslationResult(
      result.content,
      batch,
      result.usage.provider || 'deepseek',
    );
    translated.forEach((item) => translatedSegments.set(item.path, item.value));
  }

  const restored = rebuildRichtextFromSegments(plan, translatedSegments);
  assertTranslationSafety(
    args.expected,
    restored,
    usage?.provider || 'deepseek',
  );
  return { value: restored, usage };
}

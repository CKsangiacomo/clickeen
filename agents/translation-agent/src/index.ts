import {
  BRACE_PLACEHOLDER_PATTERN,
  HTML_TAG_PATTERN,
  TranslationSafetyError,
  assertTranslationSafety,
} from '@clickeen/l10n';
import { TranslationAgentError } from './errors';
export { TranslationAgentError } from './errors';

function providerError(provider: string, message: string): TranslationAgentError {
  return new TranslationAgentError(502, { code: 'PROVIDER_ERROR', provider, message });
}

function badRequest(message: string): TranslationAgentError {
  return new TranslationAgentError(400, { code: 'BAD_REQUEST', message });
}

function assertAgentTranslationSafety(
  expected: TranslationItem,
  translatedValue: string,
  provider: string,
): void {
  try {
    assertTranslationSafety(expected, translatedValue, provider);
  } catch (error) {
    if (error instanceof TranslationSafetyError) {
      throw providerError(error.provider, error.message);
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export type TranslationItem = {
  path: string;
  type: 'string' | 'richtext';
  label?: string;
  role?: string;
  value: string;
  promptType?: 'string' | 'richtext';
};

type RichtextSegmentPart =
  | { kind: 'tag'; value: string }
  | { kind: 'text'; value: string; segmentPath: string | null };
export type RichtextSegmentPlan = {
  parts: RichtextSegmentPart[];
  segments: TranslationItem[];
};
export type StructuredTranslationPlan = {
  modelEntries: TranslationItem[];
  richtextPlansByPath: Map<string, RichtextSegmentPlan>;
};

export const PROMPT_ID = 'widget.instance.translator@2026-05-06.1';
export const POLICY_ID = 'instance.translation.values';

const MAX_BATCH_ITEMS = 80;
const MAX_BATCH_INPUT_CHARS = 4000;
export const MAX_TOTAL_ITEMS = 800;
export const MAX_TOTAL_INPUT_CHARS = 60000;
const URL_PATTERN = /^https?:\/\/\S+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PURE_BRACE_PLACEHOLDERS_PATTERN =
  /^(?:\{\{[^{}]+\}\}|\{[^{}]+\})(?:\s+(?:\{\{[^{}]+\}\}|\{[^{}]+\}))*$/;
const PURE_COLON_PLACEHOLDERS_PATTERN =
  /^:[a-zA-Z_][a-zA-Z0-9_]*(?:\s+:[a-zA-Z_][a-zA-Z0-9_]*)*$/;
const UNICODE_LETTER_PATTERN = /[\p{L}\p{M}]/u;

export function buildSystemPrompt(args: {
  locale: string;
  widgetType?: string | null;
  items: TranslationItem[];
}): string {
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  const promptTypes = new Set(args.items.map((item) => item.promptType ?? item.type));
  const hasStringItems = promptTypes.has('string');
  const hasRichtextItems = promptTypes.has('richtext');
  return [
    'You are a localization engine for Clickeen widgets.',
    `Translate into locale: ${args.locale}.`,
    widgetType ? `Context: widgetType=${widgetType}.` : null,
    '',
    'Rules:',
    '- Return ONLY JSON. No markdown, no extra text.',
    '- Keep the same item count and order as input.',
    '- Preserve paths exactly.',
    '- Preserve URLs, emails, brand names, and placeholders (e.g. {token}, {{token}}, :token).',
    '- For richtext values, translate only the provided visible text. Do not add HTML tags.',
    '- Write in natural, native product/UI copy for the requested locale (not literal translation).',
    '- If literal wording sounds awkward, rewrite idiomatically while preserving intent.',
    '- Prefer concise, fluent phrasing that reads as originally written in the locale.',
    '- Preserve acronym style from source; do not add parenthetical expansions that are not present in source text.',
    '- Especially for heading/title strings: keep standalone acronyms standalone (e.g. keep "B&B", do not expand to "B&B (...)").',
    '- Keep output length reasonably close to source unless natural phrasing requires otherwise.',
    hasStringItems
      ? '- For string fields, write concise UI/product copy suitable for labels, headings, questions, and CTAs.'
      : null,
    hasRichtextItems
      ? '- For richtext fields, write fluent longer-form copy for the provided text segments.'
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

export function buildUserPrompt(items: TranslationItem[]): string {
  const payload = items.map((item) => ({
    path: item.path,
    type: item.promptType ?? item.type,
    ...(item.label ? { label: item.label } : {}),
    ...(item.role ? { role: item.role } : {}),
    value: item.value,
  }));
  return [
    'Translate the following items.',
    'Return JSON array: [{"path":"...","value":"..."},...]',
    '',
    JSON.stringify(payload),
  ].join('\n');
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

export function isLikelyNonTranslatableLiteral(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (URL_PATTERN.test(trimmed)) return true;
  if (EMAIL_PATTERN.test(trimmed)) return true;
  if (PURE_BRACE_PLACEHOLDERS_PATTERN.test(trimmed)) return true;
  if (PURE_COLON_PLACEHOLDERS_PATTERN.test(trimmed)) return true;
  if (!UNICODE_LETTER_PATTERN.test(trimmed)) return true;
  return false;
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
          segments.push({ path: segmentPath, type: 'string', promptType: 'richtext', value: text });
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
      segments.push({ path: segmentPath, type: 'string', promptType: 'richtext', value: text });
    }
  } else if (parts.length === 0) {
    const text = entry.value;
    const translatable = text.trim() && !isLikelyNonTranslatableLiteral(text);
    const segmentPath = translatable ? `${entry.path}::__segment__:0` : null;
    parts.push({ kind: 'text', value: text, segmentPath });
    if (segmentPath) {
      segments.push({ path: segmentPath, type: 'string', promptType: 'richtext', value: text });
    }
  }

  return { parts, segments };
}

function rebuildRichtextFromSegments(
  plan: RichtextSegmentPlan,
  translatedSegments: Map<string, string>,
  provider: string,
): string {
  return plan.parts
    .map((part) => {
      if (part.kind === 'tag') return part.value;
      if (!part.segmentPath) return part.value;
      const translated = translatedSegments.get(part.segmentPath);
      if (typeof translated !== 'string') {
        throw providerError(provider, `Missing translated richtext segment: ${part.segmentPath}`);
      }
      return translated;
    })
    .join('');
}

export function buildStructuredTranslationPlan(entries: TranslationItem[]): StructuredTranslationPlan {
  const modelEntries: TranslationItem[] = [];
  const richtextPlansByPath = new Map<string, RichtextSegmentPlan>();

  entries.forEach((entry) => {
    if (entry.type !== 'richtext') {
      modelEntries.push(entry);
      return;
    }

    const plan = buildRichtextSegmentPlan(entry);
    if (!plan.segments.length) return;
    richtextPlansByPath.set(entry.path, plan);
    modelEntries.push(...plan.segments);
  });

  return { modelEntries, richtextPlansByPath };
}

export function restoreStructuredTranslationResults(args: {
  entries: TranslationItem[];
  plan: StructuredTranslationPlan;
  translatedItems: Array<{ path: string; value: string }>;
  provider: string;
}): Array<{ path: string; value: string }> {
  const provider = args.provider;
  const translatedByPath = new Map(args.translatedItems.map((item) => [item.path, item.value]));

  return args.entries
    .map((entry) => {
      if (entry.type !== 'richtext') {
        const translated = translatedByPath.get(entry.path);
        if (typeof translated !== 'string') {
          throw providerError(provider, `Missing translated value for path: ${entry.path}`);
        }
        const normalized = normalizeBracePlaceholderSpacing(entry.value, translated);
        assertAgentTranslationSafety(entry, normalized, provider);
        return { path: entry.path, value: normalized };
      }

      const richtextPlan = args.plan.richtextPlansByPath.get(entry.path);
      if (!richtextPlan) return null;
      const restored = rebuildRichtextFromSegments(richtextPlan, translatedByPath, provider);
      assertAgentTranslationSafety(entry, restored, provider);
      return { path: entry.path, value: restored };
    })
    .filter((item): item is { path: string; value: string } => Boolean(item));
}

export function chunkTranslationEntries(entries: TranslationItem[]): TranslationItem[][] {
  const batches: TranslationItem[][] = [];
  let current: TranslationItem[] = [];
  let currentChars = 0;

  for (const entry of entries) {
    const nextChars = entry.value.length;
    if (nextChars > MAX_BATCH_INPUT_CHARS) {
      throw badRequest(`Item too large for translation batch (${entry.path})`);
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

export function parseTranslationResult(
  raw: string,
  expected: TranslationItem[],
  provider: string,
): Array<{ path: string; value: string }> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw providerError(provider, 'Invalid JSON response');
  }

  const items = Array.isArray(json) ? json : null;
  if (!items) {
    throw providerError(provider, 'Expected JSON array response');
  }

  const expectedPaths = new Set(expected.map((item) => item.path));
  const seen = new Set<string>();
  const mapped = new Map<string, string>();

  items.forEach((entry: unknown, index: number) => {
    if (!isRecord(entry)) {
      throw providerError(provider, `Item ${index} is not an object`);
    }
    const path = asString(entry.path);
    const value = asString(entry.value);
    if (!path || value == null) {
      throw providerError(provider, `Item ${index} missing path/value`);
    }
    if (!expectedPaths.has(path)) {
      throw providerError(provider, `Unexpected path: ${path}`);
    }
    if (seen.has(path)) {
      throw providerError(provider, `Duplicate path: ${path}`);
    }
    seen.add(path);
    mapped.set(path, value);
  });

  if (mapped.size !== expected.length) {
    throw providerError(provider, 'Translation output size mismatch');
  }

  return expected.map((item) => {
    const value = mapped.get(item.path);
    if (typeof value !== 'string') {
      throw providerError(provider, `Missing translated value for path: ${item.path}`);
    }
    const normalizedValue = normalizeBracePlaceholderSpacing(item.value, value);
    assertAgentTranslationSafety(item, normalizedValue, provider);
    return { path: item.path, value: normalizedValue };
  });
}

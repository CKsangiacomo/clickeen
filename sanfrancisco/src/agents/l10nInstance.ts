import {
  collectAllowlistedEntries,
  computeBaseFingerprint,
  normalizeLocaleToken,
} from '@clickeen/l10n';
import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import { callChatCompletion } from '../ai/chat';

type L10nJobV1 = {
  v: 1;
  agentId: string;
  grant: string;
  publicId: string;
  widgetType: string;
  locale: string;
  baseUpdatedAt: string;
  kind: 'curated' | 'user';
  workspaceId?: string | null;
  envStage?: string;
};

type L10nJobV2 = {
  v: 2;
  agentId: string;
  grant: string;
  publicId: string;
  widgetType: string;
  locale: string;
  baseFingerprint: string;
  baseUpdatedAt?: string | null;
  changedPaths?: string[];
  removedPaths?: string[];
  kind: 'curated' | 'user';
  workspaceId?: string | null;
  envStage?: string;
};

export type L10nJob = L10nJobV1 | L10nJobV2;

export type L10nPlanningSnapshot = {
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  snapshot: Record<string, string>;
};

type InstanceResponse = {
  publicId: string;
  status: 'published' | 'unpublished';
  widgetType?: string | null;
  config: Record<string, unknown>;
  updatedAt?: string | null;
};

type AllowlistEntry = { path: string; type: 'string' | 'richtext' };
type AllowlistFile = { v: 1; paths: AllowlistEntry[] };

type TranslationItem = { path: string; type: AllowlistEntry['type']; value: string };
type RichtextTagPlaceholder = { placeholder: string; tag: string };
type RichtextMaskPlan = {
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

type L10nGenerateStatus = 'running' | 'succeeded' | 'failed' | 'superseded';

const PROMPT_VERSION = 'l10n.instance.v1@2026-02-13.2';
const POLICY_VERSION = 'l10n.ops.v1';

const MAX_BATCH_ITEMS = 80;
const MAX_BATCH_INPUT_CHARS = 4000;
const MAX_TOTAL_ITEMS = 800;
const MAX_TOTAL_INPUT_CHARS = 60000;
const MAX_TOKENS = 900;
const TIMEOUT_MS = 35_000;

const BRACE_PLACEHOLDER_PATTERN = /\{\{[^{}]+\}\}|\{[^{}]+\}/g;
const COLON_PLACEHOLDER_PATTERN = /(^|[^a-zA-Z0-9_])(:[a-zA-Z_][a-zA-Z0-9_]*)/g;
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?>/g;
const URL_PATTERN = /^https?:\/\/\S+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isL10nJob(value: unknown): value is L10nJob {
  if (!isRecord(value)) return false;
  if (value.v !== 1 && value.v !== 2) return false;
  const agentId = asString(value.agentId);
  const grant = asString(value.grant);
  const publicId = asString(value.publicId);
  const widgetType = asString(value.widgetType);
  const locale = asString(value.locale);
  const kind = value.kind;
  if (!agentId || !grant || !publicId || !widgetType || !locale) return false;
  if (kind !== 'curated' && kind !== 'user') return false;
  if (value.v === 1) {
    const baseUpdatedAt = asString(value.baseUpdatedAt);
    if (!baseUpdatedAt) return false;
  }
  if (value.v === 2) {
    const baseFingerprint = asString(value.baseFingerprint);
    if (!baseFingerprint) return false;
    if (value.changedPaths != null && !Array.isArray(value.changedPaths)) return false;
    if (value.removedPaths != null && !Array.isArray(value.removedPaths)) return false;
  }
  return true;
}

function requireEnvVar(value: unknown, name: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed)
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: `Missing ${name}`,
    });
  return trimmed;
}

function getTokyoReadBase(env: Env): string {
  return requireEnvVar((env as any).TOKYO_BASE_URL, 'TOKYO_BASE_URL');
}

function collectTranslatableEntries(
  config: Record<string, unknown>,
  allowlist: AllowlistEntry[],
  includeEmpty = false,
): TranslationItem[] {
  const entries = collectAllowlistedEntries(config, allowlist, { includeEmpty: true });
  return entries
    .filter((entry) => includeEmpty || entry.value.trim())
    .map((entry) => ({ path: entry.path, type: entry.type, value: entry.value }));
}

function buildSystemPrompt(locale: string): string {
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

function buildUserPrompt(items: TranslationItem[]): string {
  const payload = items.map((item) => ({ path: item.path, type: item.type, value: item.value }));
  return [
    'Translate the following items.',
    'Return JSON array: [{"path":"...","value":"..."},...]',
    '',
    JSON.stringify(payload),
  ].join('\n');
}

async function deepseekTranslate(args: {
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

function expandPathPatterns(patterns: string[], candidates: string[]): string[] {
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

function deleteMergedByPathOrPattern(merged: Map<string, string>, pathOrPattern: string): void {
  if (!pathOrPattern.includes('*')) {
    merged.delete(pathOrPattern);
    return;
  }
  for (const key of Array.from(merged.keys())) {
    if (pathMatchesPattern(key, pathOrPattern)) merged.delete(key);
  }
}

function isLikelyNonTranslatableLiteral(value: string): boolean {
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

function buildRichtextMaskPlan(entry: TranslationItem): RichtextMaskPlan | null {
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

function normalizeMaskedTagPlaceholders(value: string, tags: RichtextTagPlaceholder[]): string {
  let normalized = value;
  tags.forEach(({ placeholder }) => {
    const inner = placeholder.slice(2, -2);
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(inner)}\\s*\\}\\}`, 'g');
    normalized = normalized.replace(pattern, placeholder);
  });
  return normalized;
}

function restoreMaskedRichtextTags(value: string, tags: RichtextTagPlaceholder[]): string {
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

function assertTranslationSafety(
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

function chunkTranslationEntries(entries: TranslationItem[]): TranslationItem[][] {
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

function mergeUsage(base: Usage | undefined, next: Usage): Usage {
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

function parseTranslationResult(
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

async function translateRichtextWithSegmentFallback(args: {
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

async function fetchInstanceByContext(args: { workspaceId: string; publicId: string }, env: Env): Promise<InstanceResponse> {
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/workspaces/${encodeURIComponent(args.workspaceId)}/instance/${encodeURIComponent(args.publicId)}?subject=devstudio`,
    baseUrl,
  ).toString();

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'cache-control': 'no-store',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'paris',
      message: `Failed to load instance (${res.status}) ${text}`.trim(),
    });
  }
  const body = (await res.json().catch(() => null)) as InstanceResponse | null;
  if (!body || typeof body !== 'object' || !body.config) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'paris',
      message: 'Invalid instance response',
    });
  }
  return body;
}

async function fetchInstance(job: L10nJob, env: Env): Promise<InstanceResponse> {
  const workspaceId = asString(job.workspaceId);
  if (!workspaceId) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing workspaceId' });
  }
  return fetchInstanceByContext({ workspaceId, publicId: job.publicId }, env);
}

async function fetchAllowlist(widgetType: string, env: Env): Promise<AllowlistEntry[]> {
  const cacheKey = `l10n:allowlist:${widgetType}`;
  const cached = await env.SF_KV.get(cacheKey, { type: 'json' }).catch(() => null);
  if (cached && isRecord(cached) && cached.v === 1 && Array.isArray(cached.paths)) {
    return cached.paths as AllowlistEntry[];
  }

  const baseUrl = getTokyoReadBase(env);
  const url = new URL(
    `/widgets/${encodeURIComponent(widgetType)}/localization.json`,
    baseUrl,
  ).toString();
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: `Failed to load allowlist (${res.status}) ${text}`.trim(),
    });
  }
  const json = (await res.json().catch(() => null)) as AllowlistFile | null;
  if (!json || json.v !== 1 || !Array.isArray(json.paths)) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: 'Invalid localization.json',
    });
  }

  const entries: AllowlistEntry[] = json.paths
    .map((entry) => ({
      path: typeof entry?.path === 'string' ? entry.path.trim() : '',
      type: entry?.type === 'richtext' ? ('richtext' as const) : ('string' as const),
    }))
    .filter((entry) => entry.path);

  await env.SF_KV.put(cacheKey, JSON.stringify({ v: 1, paths: entries }), { expirationTtl: 3600 });
  return entries;
}

export async function resolveL10nPlanningSnapshot(args: {
  env: Env;
  widgetType: string;
  config?: Record<string, unknown> | null;
  baseUpdatedAt?: string | null;
  workspaceId?: string | null;
  publicId?: string | null;
}): Promise<L10nPlanningSnapshot> {
  const widgetTypeHint = asString(args.widgetType);
  if (!widgetTypeHint) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing widgetType' });
  }

  let config: Record<string, unknown>;
  let resolvedWidgetType = widgetTypeHint;
  let resolvedBaseUpdatedAt: string | null =
    typeof args.baseUpdatedAt === 'string' && args.baseUpdatedAt.trim()
      ? args.baseUpdatedAt.trim()
      : null;

  if (args.config && isRecord(args.config)) {
    config = args.config;
  } else {
    const workspaceId = asString(args.workspaceId);
    if (!workspaceId) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing workspaceId' });
    }
    const publicId = asString(args.publicId);
    if (!publicId) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing publicId' });
    }
    const instance = await fetchInstanceByContext({ workspaceId, publicId }, args.env);
    resolvedWidgetType = instance.widgetType ? String(instance.widgetType) : widgetTypeHint;
    config = instance.config;
    resolvedBaseUpdatedAt = instance.updatedAt ?? resolvedBaseUpdatedAt;
  }

  const allowlist = await fetchAllowlist(resolvedWidgetType, args.env);
  const entries = collectTranslatableEntries(config, allowlist, true);
  const snapshot: Record<string, string> = {};
  entries.forEach((entry) => {
    snapshot[entry.path] = entry.value;
  });

  return {
    widgetType: resolvedWidgetType,
    baseFingerprint: await computeBaseFingerprint(snapshot),
    baseUpdatedAt: resolvedBaseUpdatedAt,
    snapshot,
  };
}

type ExistingLocale = {
  locale: string;
  source?: string | null;
  baseFingerprint?: string | null;
  baseUpdatedAt?: string | null;
  hasUserOps?: boolean | null;
  ops?: Array<{ op: 'set'; path: string; value: string }>;
};

async function fetchExistingLocale(
  job: L10nJob,
  locale: string,
  env: Env,
): Promise<ExistingLocale | null> {
  const workspaceId = asString(job.workspaceId);
  if (!workspaceId) return null;
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      job.publicId,
    )}/layers/locale/${encodeURIComponent(locale)}`,
    baseUrl,
  );
  url.searchParams.set('subject', 'devstudio');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'cache-control': 'no-store',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as any;
  const ops = Array.isArray(body?.ops)
    ? body.ops
        .filter(
          (op: any) =>
            op && op.op === 'set' && typeof op.path === 'string' && typeof op.value === 'string',
        )
        .map((op: any) => ({ op: 'set' as const, path: op.path, value: op.value }))
    : [];
  return {
    locale,
    source: typeof body?.source === 'string' ? body.source : null,
    baseFingerprint: typeof body?.baseFingerprint === 'string' ? body.baseFingerprint : null,
    baseUpdatedAt: typeof body?.baseUpdatedAt === 'string' ? body.baseUpdatedAt : null,
    hasUserOps: Array.isArray(body?.userOps) ? body.userOps.length > 0 : null,
    ops,
  };
}

type OverlayWriteResult = { ok: true } | { ok: false; reason: 'stale_instance' };

async function writeOverlay(
  job: L10nJob,
  locale: string,
  overlay: {
    v: 1;
    baseUpdatedAt?: string | null;
    baseFingerprint?: string | null;
    ops: Array<{ op: 'set'; path: string; value: string }>;
  },
  env: Env,
): Promise<OverlayWriteResult> {
  const workspaceId = asString(job.workspaceId);
  if (!workspaceId) return { ok: false, reason: 'stale_instance' };
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      job.publicId,
    )}/layers/locale/${encodeURIComponent(locale)}`,
    baseUrl,
  );
  url.searchParams.set('subject', 'devstudio');
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ops: overlay.ops,
      baseUpdatedAt: overlay.baseUpdatedAt ?? null,
      baseFingerprint: overlay.baseFingerprint ?? null,
      source: 'agent',
      widgetType: job.widgetType,
    }),
  });
  if (!res.ok) {
    const details = (await res.json().catch(() => null)) as any;
    const code = details?.error?.code;
    if (code === 'FINGERPRINT_MISMATCH') return { ok: false, reason: 'stale_instance' };
    const text = await res.text().catch(() => '');
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'paris',
      message: `Overlay write failed (${res.status}) ${text}`.trim(),
    });
  }
  return { ok: true };
}

async function writeLog(
  env: Env,
  job: L10nJob,
  baseFingerprint: string | null,
  payload: Record<string, unknown>,
) {
  const fallback = job.v === 2 ? job.baseFingerprint : job.baseUpdatedAt;
  const fingerprint = baseFingerprint || fallback || 'unknown';
  const key = `l10n/${job.publicId}/${job.locale}/${fingerprint}.${Date.now()}.json`;
  await env.SF_R2.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json' },
  });
}

async function reportL10nGenerateStatus(args: {
  env: Env;
  job: L10nJob;
  status: L10nGenerateStatus;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  locale: string;
  error?: string | null;
  occurredAtMs?: number;
  widgetType?: string | null;
  workspaceId?: string | null;
}) {
  const baseUrl = requireEnvVar((args.env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((args.env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL('/api/l10n/jobs/report', baseUrl).toString();
  const payload = {
    v: 1,
    publicId: args.job.publicId,
    layer: 'locale',
    layerKey: args.locale,
    baseFingerprint: args.baseFingerprint,
    status: args.status,
    widgetType: args.widgetType ?? args.job.widgetType,
    workspaceId: args.workspaceId ?? args.job.workspaceId ?? null,
    baseUpdatedAt: args.baseUpdatedAt ?? null,
    error: args.error ?? null,
    occurredAt: new Date(args.occurredAtMs ?? Date.now()).toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[sanfrancisco] l10n report failed', res.status, text);
    }
  } catch (err) {
    console.error('[sanfrancisco] l10n report error', err);
  }
}

export async function executeL10nJob(job: L10nJob, env: Env, grant: AIGrant): Promise<void> {
  const startedAt = Date.now();
  const workspaceId = asString(job.workspaceId);
  const locale = normalizeLocaleToken(job.locale);
  const jobBaseUpdatedAt = job.v === 2 ? (job.baseUpdatedAt ?? null) : job.baseUpdatedAt;
  const jobBaseFingerprint = job.v === 2 ? job.baseFingerprint : null;
  if (!workspaceId) {
    await writeLog(env, job, jobBaseFingerprint, {
      status: 'skipped',
      reason: 'missing_workspace',
      job,
      occurredAtMs: startedAt,
    });
    if (jobBaseFingerprint) {
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'superseded',
        baseFingerprint: jobBaseFingerprint,
        baseUpdatedAt: jobBaseUpdatedAt,
        locale: job.locale,
        error: 'missing_workspace',
        occurredAtMs: startedAt,
      });
    }
    return;
  }

  let instance: InstanceResponse;
  try {
    instance = await fetchInstance(job, env);
  } catch (err) {
    const reason =
      err instanceof HttpError
        ? (err.error?.message ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    await writeLog(env, job, jobBaseFingerprint, {
      status: 'failed',
      reason,
      job,
      occurredAtMs: startedAt,
    });
    if (jobBaseFingerprint) {
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'failed',
        baseFingerprint: jobBaseFingerprint,
        baseUpdatedAt: jobBaseUpdatedAt,
        locale: job.locale,
        error: reason,
        occurredAtMs: startedAt,
      });
    }
    return;
  }

  const resolvedWidgetType = instance.widgetType ? String(instance.widgetType) : job.widgetType;
  let allowlist: AllowlistEntry[];
  try {
    allowlist = await fetchAllowlist(resolvedWidgetType, env);
  } catch (err) {
    const reason =
      err instanceof HttpError
        ? (err.error?.message ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    await writeLog(env, job, jobBaseFingerprint, {
      status: 'failed',
      reason,
      job,
      occurredAtMs: startedAt,
    });
    if (jobBaseFingerprint) {
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'failed',
        baseFingerprint: jobBaseFingerprint,
        baseUpdatedAt: jobBaseUpdatedAt,
        locale: job.locale,
        error: reason,
        occurredAtMs: startedAt,
      });
    }
    return;
  }

  const entries = collectTranslatableEntries(instance.config, allowlist, true);
  const snapshot: Record<string, string> = {};
  entries.forEach((entry) => {
    snapshot[entry.path] = entry.value;
  });
  const baseFingerprint = await computeBaseFingerprint(snapshot);
  const baseUpdatedAt = instance.updatedAt ?? jobBaseUpdatedAt ?? null;

  if (!locale) {
    await writeLog(env, job, baseFingerprint, {
      status: 'skipped',
      reason: 'invalid_locale',
      job,
      baseFingerprint,
      occurredAtMs: startedAt,
    });
    await reportL10nGenerateStatus({
      env,
      job,
      status: 'superseded',
      baseFingerprint,
      baseUpdatedAt,
      locale: job.locale,
      error: 'invalid_locale',
      occurredAtMs: startedAt,
    });
    return;
  }

  if (job.v === 2 && job.baseFingerprint !== baseFingerprint) {
    await writeLog(env, job, baseFingerprint, {
      status: 'skipped',
      reason: 'stale_instance',
      job,
      baseFingerprint,
      occurredAtMs: startedAt,
    });
    await reportL10nGenerateStatus({
      env,
      job,
      status: 'superseded',
      baseFingerprint,
      baseUpdatedAt,
      locale,
      error: 'stale_instance',
      occurredAtMs: startedAt,
    });
    return;
  }

  await reportL10nGenerateStatus({
    env,
    job,
    status: 'running',
    baseFingerprint,
    baseUpdatedAt,
    locale,
    occurredAtMs: startedAt,
  });

  try {
    const entryMap = new Map(entries.map((entry) => [entry.path, entry]));
    const existing = await fetchExistingLocale({ ...job, locale }, locale, env);
    const jobChangedPaths =
      job.v === 2 && Array.isArray(job.changedPaths)
        ? job.changedPaths.filter((path) => typeof path === 'string' && path.trim())
        : null;
    const jobRemovedPaths =
      job.v === 2 && Array.isArray(job.removedPaths)
        ? job.removedPaths.filter((path) => typeof path === 'string' && path.trim())
        : [];
    const candidatePaths = Array.from(
      new Set([
        ...entries.map((entry) => entry.path),
        ...(existing?.ops ?? [])
          .map((op) => (op && op.op === 'set' && typeof op.path === 'string' ? op.path : ''))
          .filter(Boolean),
      ]),
    );
    const expandedChangedPaths =
      jobChangedPaths == null ? null : expandPathPatterns(jobChangedPaths, candidatePaths);
    const expandedRemovedPaths = expandPathPatterns(jobRemovedPaths, candidatePaths);
    const removedSet = new Set(expandedRemovedPaths);
    const translateAll = expandedChangedPaths == null;
    const targetPaths = translateAll ? entries.map((entry) => entry.path) : expandedChangedPaths;

    const fingerprintMatch =
      existing?.baseFingerprint && existing.baseFingerprint === baseFingerprint;
    if (translateAll && fingerprintMatch && removedSet.size === 0) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: 'already_localized',
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'succeeded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        occurredAtMs: startedAt,
      });
      return;
    }

    if (!translateAll && targetPaths.length === 0 && removedSet.size === 0) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: 'no_changes',
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'succeeded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        occurredAtMs: startedAt,
      });
      return;
    }

    const translateEntries: TranslationItem[] = [];
    const richtextMaskPlans = new Map<string, RichtextMaskPlan>();
    const directOps: Array<{ op: 'set'; path: string; value: string }> = [];
    targetPaths.forEach((path) => {
      const entry = entryMap.get(path);
      if (!entry) {
        removedSet.add(path);
        return;
      }
      if (!entry.value.trim()) {
        directOps.push({ op: 'set', path: entry.path, value: '' });
        return;
      }
      if (isLikelyNonTranslatableLiteral(entry.value)) {
        directOps.push({ op: 'set', path: entry.path, value: entry.value });
        return;
      }
      if (entry.type === 'richtext') {
        const maskPlan = buildRichtextMaskPlan(entry);
        if (maskPlan) {
          richtextMaskPlans.set(entry.path, maskPlan);
          translateEntries.push({ path: entry.path, type: 'string', value: maskPlan.masked });
          return;
        }
      }
      translateEntries.push(entry);
    });

    if (entries.length === 0) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: 'no_translatables',
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'succeeded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        occurredAtMs: startedAt,
      });
      return;
    }

    if (translateEntries.length > MAX_TOTAL_ITEMS) {
      throw new HttpError(400, {
        code: 'BAD_REQUEST',
        message: `Too many translatable items (${translateEntries.length})`,
      });
    }

    const totalChars = translateEntries.reduce((sum, item) => sum + item.value.length, 0);
    if (totalChars > MAX_TOTAL_INPUT_CHARS) {
      throw new HttpError(400, {
        code: 'BAD_REQUEST',
        message: `Input too large (${totalChars} chars)`,
      });
    }

    const translatedOps: Array<{ op: 'set'; path: string; value: string }> = [];
    const richtextFallbackPaths: string[] = [];
    let usage: Usage | undefined;
    if (translateEntries.length > 0) {
      const system = buildSystemPrompt(locale);
      const batches = chunkTranslationEntries(translateEntries);
      for (const batch of batches) {
        const user = buildUserPrompt(batch);
        const result = await deepseekTranslate({ env, grant, agentId: job.agentId, system, user });
        usage = mergeUsage(usage, result.usage);
        const translated = parseTranslationResult(
          result.content,
          batch,
          result.usage.provider || 'deepseek',
        );
        for (const item of translated) {
          const maskPlan = richtextMaskPlans.get(item.path);
          if (!maskPlan) {
            translatedOps.push({ op: 'set', path: item.path, value: item.value });
            continue;
          }

          const normalizedMasked = normalizeMaskedTagPlaceholders(item.value, maskPlan.tags);
          const restored = restoreMaskedRichtextTags(normalizedMasked, maskPlan.tags);
          const expected = entryMap.get(item.path);
          if (!expected) {
            throw new HttpError(502, {
              code: 'PROVIDER_ERROR',
              provider: result.usage.provider || 'deepseek',
              message: `Missing expected richtext source for path: ${item.path}`,
            });
          }
          try {
            assertTranslationSafety(expected, restored, result.usage.provider || 'deepseek');
            translatedOps.push({ op: 'set', path: item.path, value: restored });
          } catch {
            const fallback = await translateRichtextWithSegmentFallback({
              env,
              grant,
              agentId: job.agentId,
              locale,
              expected,
            });
            if (fallback.usage) usage = mergeUsage(usage, fallback.usage);
            richtextFallbackPaths.push(item.path);
            translatedOps.push({ op: 'set', path: item.path, value: fallback.value });
          }
        }
      }
    }

    const baseOps = existing?.ops ?? [];
    const merged = new Map<string, string>();
    baseOps.forEach((op) => {
      if (op && op.op === 'set' && entryMap.has(op.path)) {
        merged.set(op.path, op.value);
      }
    });
    removedSet.forEach((pathOrPattern) => deleteMergedByPathOrPattern(merged, pathOrPattern));
    [...directOps, ...translatedOps].forEach((op) => {
      merged.set(op.path, op.value);
    });

    if (!translateAll && merged.size === 0 && removedSet.size === 0) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: 'no_effective_changes',
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'succeeded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        occurredAtMs: startedAt,
      });
      return;
    }

    const ops = Array.from(merged.entries()).map(([path, value]) => ({
      op: 'set' as const,
      path,
      value,
    }));
    const overlay = { v: 1 as const, baseUpdatedAt, baseFingerprint, ops };

    const writeResult = await writeOverlay({ ...job, locale }, locale, overlay, env);
    if (writeResult.ok === false) {
      const reason = writeResult.reason;
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason,
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'superseded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        error: reason,
        occurredAtMs: startedAt,
      });
      return;
    }

    await writeLog(env, job, baseFingerprint, {
      status: 'ok',
      job,
      baseFingerprint,
      baseUpdatedAt,
      opsCount: ops.length,
      usage,
      richtextFallbackPaths: richtextFallbackPaths.length ? richtextFallbackPaths : undefined,
      promptVersion: PROMPT_VERSION,
      policyVersion: POLICY_VERSION,
      occurredAtMs: startedAt,
    });
    await reportL10nGenerateStatus({
      env,
      job,
      status: 'succeeded',
      baseFingerprint,
      baseUpdatedAt,
      locale,
      occurredAtMs: startedAt,
    });
  } catch (err) {
    const reason =
      err instanceof HttpError
        ? (err.error?.message ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    await writeLog(env, job, baseFingerprint, {
      status: 'failed',
      reason,
      job,
      baseFingerprint,
      occurredAtMs: startedAt,
    });
    await reportL10nGenerateStatus({
      env,
      job,
      status: 'failed',
      baseFingerprint,
      baseUpdatedAt,
      locale,
      error: reason,
      occurredAtMs: startedAt,
    });
  }
}

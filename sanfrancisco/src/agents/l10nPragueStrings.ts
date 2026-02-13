import { normalizeLocaleToken } from '@clickeen/l10n';
import type { Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';

export type PragueStringsJob = {
  v: 1;
  surface: 'prague';
  kind: 'system';
  chunkKey: string;
  blockKind: string;
  locale: string;
  baseFingerprint: string;
  baseUpdatedAt: string;
  allowlistVersion: number;
  allowlistHash?: string;
  items: Array<{ path: string; type: 'string' | 'richtext'; value: string }>;
};

type TranslationItem = { path: string; value: string };
type RichtextAnchorSignature = {
  href: string | null;
  hasVisibleText: boolean;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
};

const PROMPT_VERSION = 'l10n.prague.strings.v1@2026-02-13.2';
const POLICY_VERSION = 'l10n.ops.v1';

const MAX_ITEMS = 250;
const MAX_INPUT_CHARS = 12000;
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 90_000;
const BRACE_PLACEHOLDER_PATTERN = /\{\{[^{}]+\}\}|\{[^{}]+\}/g;
const COLON_PLACEHOLDER_PATTERN = /(^|[^a-zA-Z0-9_])(:[a-zA-Z_][a-zA-Z0-9_]*)/g;
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?>/g;

export function isPragueStringsJob(value: unknown): value is PragueStringsJob {
  if (!isRecord(value)) return false;
  if (value.v !== 1) return false;
  if (value.surface !== 'prague') return false;
  if (value.kind !== 'system') return false;
  const chunkKey = asString((value as any).chunkKey);
  const blockKind = asString((value as any).blockKind);
  const locale = asString((value as any).locale);
  const baseFingerprint = asString((value as any).baseFingerprint);
  const baseUpdatedAt = asString((value as any).baseUpdatedAt);
  const allowlistVersion = (value as any).allowlistVersion;
  const items = (value as any).items;
  if (!chunkKey || !blockKind || !locale || !baseFingerprint || !baseUpdatedAt) return false;
  if (typeof allowlistVersion !== 'number' || !Number.isFinite(allowlistVersion)) return false;
  if (!Array.isArray(items)) return false;
  for (const item of items) {
    if (!isRecord(item)) return false;
    const path = asString(item.path);
    const type = asString(item.type);
    const value = asString(item.value);
    if (!path || (type !== 'string' && type !== 'richtext') || value == null) return false;
  }
  return true;
}

function requireEnvVar(value: unknown, name: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: `Missing ${name}` });
  return trimmed;
}

function buildSystemPrompt(locale: string, chunkKey: string, blockKind: string): string {
  return [
    'You are a localization engine for Clickeen Prague website strings.',
    `Translate into locale: ${locale}.`,
    `Context: chunkKey=${chunkKey}, blockKind=${blockKind}.`,
    '',
    'Rules:',
    '- Return ONLY JSON. No markdown, no extra text.',
    '- Keep the same item count and order as input.',
    '- Preserve paths exactly.',
    '- Preserve URLs, emails, brand names, and placeholders (e.g. {token}, {{token}}, :token).',
    '- For richtext values, preserve existing HTML tags and attributes; do not add new tags.',
    '- For richtext links, keep every meaningful linked phrase as linked text in output (do not move link text outside <a> tags).',
    '- Write in natural, native marketing copy for the target locale (not literal translation).',
    '- If literal wording sounds awkward, rewrite idiomatically while preserving intent.',
    '- Prefer concise, fluent, modern phrasing suitable for a product website.',
    '- Preserve acronym style from source; do not add parenthetical expansions that are not present in source text.',
    '- Especially for heading/title strings: keep standalone acronyms standalone (e.g. keep "B&B", do not expand to "B&B (...)").',
    '- Keep output length reasonably close to source unless natural phrasing requires otherwise.',
    '- Silently self-check fluency before final output.',
  ].join('\n');
}

function extractPlaceholders(value: string): string[] {
  const placeholders: string[] = [];
  const braceMatches = value.match(BRACE_PLACEHOLDER_PATTERN) ?? [];
  placeholders.push(...braceMatches);
  COLON_PLACEHOLDER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COLON_PLACEHOLDER_PATTERN.exec(value)) !== null) {
    placeholders.push(match[2]);
  }
  return placeholders;
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
    if (b.get(key) !== value) return false;
  }
  return true;
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
  expected: PragueStringsJob['items'][number],
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

function buildUserPrompt(items: PragueStringsJob['items']): string {
  return [
    'Translate the following items.',
    'Return JSON: {"items":[{"path":"...","value":"..."}, ...]}',
    '',
    JSON.stringify(
      items.map((item) => ({ path: item.path, type: item.type, value: item.value })),
      null,
      2,
    ),
  ].join('\n');
}

function extractOutputText(data: OpenAIResponse): string | null {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap((o) => (Array.isArray(o?.content) ? o.content : []))
      .filter((c) => c && c.type === 'output_text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('');
  }
  return null;
}

async function openaiTranslate(args: { env: Env; system: string; user: string }): Promise<{ items: TranslationItem[]; usage: Usage }> {
  const apiKey = requireEnvVar(args.env.OPENAI_API_KEY, 'OPENAI_API_KEY');
  const model = args.env.OPENAI_MODEL ?? 'gpt-5.2';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const startedAt = Date.now();
  let responseJson: OpenAIResponse;
  try {
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          input: [
            { role: 'system', content: [{ type: 'input_text', text: args.system }] },
            { role: 'user', content: [{ type: 'input_text', text: args.user }] },
          ],
          max_output_tokens: MAX_TOKENS,
          text: {
            format: {
              type: 'json_schema',
              name: 'translations',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        path: { type: 'string' },
                        value: { type: 'string' },
                      },
                      required: ['path', 'value'],
                    },
                  },
                },
                required: ['items'],
              },
            },
          },
        }),
      });
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Upstream request failed' });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: `Upstream error (${res.status}) ${text}`.trim() });
    }
    responseJson = (await res.json()) as OpenAIResponse;
  } finally {
    clearTimeout(timeout);
  }

  const latencyMs = Date.now() - startedAt;
  const text = extractOutputText(responseJson);
  if (!text) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Empty model response' });
  }

  let parsed: { items?: TranslationItem[] };
  try {
    parsed = JSON.parse(text) as { items?: TranslationItem[] };
  } catch {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Invalid JSON response' });
  }
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Expected JSON items array' });
  }

  const usage: Usage = {
    provider: 'openai',
    model: responseJson.model ?? model,
    promptTokens: responseJson.usage?.input_tokens ?? 0,
    completionTokens: responseJson.usage?.output_tokens ?? 0,
    latencyMs,
  };

  return { items: parsed.items, usage };
}

async function writeLog(env: Env, job: PragueStringsJob, payload: Record<string, unknown>) {
  const key = `l10n/prague/${job.chunkKey}/${job.locale}/${job.baseUpdatedAt}.${Date.now()}.json`;
  await env.SF_R2.put(key, JSON.stringify(payload), { httpMetadata: { contentType: 'application/json' } });
}

export async function executePragueStringsTranslate(job: PragueStringsJob, env: Env): Promise<{ v: 1; locale: string; items: TranslationItem[] }> {
  const startedAt = Date.now();
  const locale = normalizeLocaleToken(job.locale);
  if (!locale) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid locale' });
  }

  if (job.items.length > MAX_ITEMS) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: `Too many items (${job.items.length})` });
  }

  if (job.items.length === 0) {
    await writeLog(env, job, {
      status: 'skipped',
      reason: 'no_translatables',
      occurredAtMs: startedAt,
      locale,
      chunkKey: job.chunkKey,
      blockKind: job.blockKind,
    });
    return { v: 1, locale, items: [] };
  }

  const totalChars = job.items.reduce((sum, item) => sum + item.value.length, 0);
  if (totalChars > MAX_INPUT_CHARS) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: `Input too large (${totalChars} chars)` });
  }

  const system = buildSystemPrompt(locale, job.chunkKey, job.blockKind);
  const user = buildUserPrompt(job.items);

  const { items, usage } = await openaiTranslate({ env, system, user });

  if (items.length !== job.items.length) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Translation output size mismatch' });
  }

  for (let i = 0; i < items.length; i += 1) {
    const expected = job.items[i];
    const actual = items[i];
    if (!actual || actual.path !== expected.path || typeof actual.value !== 'string') {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: `Unexpected path at index ${i}` });
    }
    assertTranslationSafety(expected, actual.value, 'openai');
  }

  await writeLog(env, job, {
    status: 'ok',
    occurredAtMs: startedAt,
    locale,
    chunkKey: job.chunkKey,
    blockKind: job.blockKind,
    baseFingerprint: job.baseFingerprint,
    baseUpdatedAt: job.baseUpdatedAt,
    allowlistVersion: job.allowlistVersion,
    allowlistHash: job.allowlistHash ?? null,
    promptVersion: PROMPT_VERSION,
    policyVersion: POLICY_VERSION,
    usage,
  });

  return { v: 1, locale, items };
}

import { normalizeLocaleToken } from '@clickeen/l10n';
import { TranslationAgentError, assertTranslationSafety } from '@clickeen/translation-agent';
import type { Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';

export type PragueStringsTranslationRequest = {
  v: 1;
  surface: 'prague';
  kind: 'system';
  chunkKey: string;
  blockKind: string;
  locale: string;
  sourceRevision: string;
  baseUpdatedAt: string;
  allowlistVersion: number;
  allowlistHash?: string;
  items: Array<{ path: string; type: 'string' | 'richtext'; value: string }>;
};

type TranslationItem = { path: string; value: string };

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
};

function assertPragueTranslationSafety(
  expected: { path: string; type: 'string' | 'richtext'; value: string },
  translatedValue: string,
): void {
  try {
    assertTranslationSafety(expected, translatedValue, 'openai');
  } catch (error) {
    if (error instanceof TranslationAgentError) {
      throw new HttpError(error.status, {
        code: 'PROVIDER_ERROR',
        provider: error.provider ?? 'openai',
        message: error.message,
      });
    }
    throw error;
  }
}

const PROMPT_VERSION = 'prague.strings.l10n@2026-05-06.1';
const POLICY_VERSION = 'l10n.ops.v1';

const MAX_ITEMS = 250;
const MAX_INPUT_CHARS = 12000;
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 90_000;

export function isPragueStringsTranslationRequest(value: unknown): value is PragueStringsTranslationRequest {
  if (!isRecord(value)) return false;
  if (value.v !== 1) return false;
  if (value.surface !== 'prague') return false;
  if (value.kind !== 'system') return false;
  const chunkKey = asString((value as any).chunkKey);
  const blockKind = asString((value as any).blockKind);
  const locale = asString((value as any).locale);
  const sourceRevision = asString((value as any).sourceRevision);
  const baseUpdatedAt = asString((value as any).baseUpdatedAt);
  const allowlistVersion = (value as any).allowlistVersion;
  const items = (value as any).items;
  if (!chunkKey || !blockKind || !locale || !sourceRevision || !baseUpdatedAt) return false;
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
  ].join('\n');
}

function buildUserPrompt(items: PragueStringsTranslationRequest['items']): string {
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
  const model = requireEnvVar(args.env.OPENAI_MODEL, 'OPENAI_MODEL');

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

  const { input_tokens: promptTokens, output_tokens: completionTokens } = responseJson.usage ?? {}; if (!responseJson.model?.trim() || typeof promptTokens !== 'number' || !Number.isInteger(promptTokens) || promptTokens < 0 || typeof completionTokens !== 'number' || !Number.isInteger(completionTokens) || completionTokens < 0) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Missing upstream usage' });

  return { items: parsed.items, usage: { provider: 'openai', model: responseJson.model.trim(), promptTokens, completionTokens, latencyMs } };
}

async function writeLog(env: Env, requestPayload: PragueStringsTranslationRequest, payload: Record<string, unknown>) {
  const key = `l10n/prague/${requestPayload.chunkKey}/${requestPayload.locale}/${requestPayload.baseUpdatedAt}.${Date.now()}.json`;
  await env.SF_R2.put(key, JSON.stringify(payload), { httpMetadata: { contentType: 'application/json' } });
}

export async function executePragueStringsTranslate(requestPayload: PragueStringsTranslationRequest, env: Env): Promise<{ v: 1; locale: string; items: TranslationItem[] }> {
  const startedAt = Date.now();
  const locale = normalizeLocaleToken(requestPayload.locale);
  if (!locale) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid locale' });
  }

  if (requestPayload.items.length > MAX_ITEMS) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: `Too many items (${requestPayload.items.length})` });
  }

  if (requestPayload.items.length === 0) {
    await writeLog(env, requestPayload, {
      status: 'skipped',
      reason: 'no_translatables',
      occurredAtMs: startedAt,
      locale,
      chunkKey: requestPayload.chunkKey,
      blockKind: requestPayload.blockKind,
    });
    return { v: 1, locale, items: [] };
  }

  const totalChars = requestPayload.items.reduce((sum, item) => sum + item.value.length, 0);
  if (totalChars > MAX_INPUT_CHARS) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: `Input too large (${totalChars} chars)` });
  }

  const system = buildSystemPrompt(locale, requestPayload.chunkKey, requestPayload.blockKind);
  const user = buildUserPrompt(requestPayload.items);

  const { items, usage } = await openaiTranslate({ env, system, user });

  if (items.length !== requestPayload.items.length) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Translation output size mismatch' });
  }

  for (let i = 0; i < items.length; i += 1) {
    const expected = requestPayload.items[i];
    const actual = items[i];
    if (!actual || actual.path !== expected.path || typeof actual.value !== 'string') {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: `Unexpected path at index ${i}` });
    }
    assertPragueTranslationSafety(expected, actual.value);
  }

  await writeLog(env, requestPayload, {
    status: 'ok',
    occurredAtMs: startedAt,
    locale,
    chunkKey: requestPayload.chunkKey,
    blockKind: requestPayload.blockKind,
    sourceRevision: requestPayload.sourceRevision,
    baseUpdatedAt: requestPayload.baseUpdatedAt,
    allowlistVersion: requestPayload.allowlistVersion,
    allowlistHash: requestPayload.allowlistHash ?? null,
    promptVersion: PROMPT_VERSION,
    policyVersion: POLICY_VERSION,
    usage,
  });

  return { v: 1, locale, items };
}

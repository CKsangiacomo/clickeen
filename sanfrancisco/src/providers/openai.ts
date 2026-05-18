import { HttpError, asString, isRecord } from '../http';
import type { Env, Usage } from '../types';
import type { ChatMessage } from '../ai/chat';

type OpenAIChatMessage = {
  content?: unknown;
  refusal?: unknown;
};

type OpenAIChatResponse = {
  choices?: Array<{ finish_reason?: string | null; message?: OpenAIChatMessage }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
  model?: string;
  output_text?: unknown;
};

function extractText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const parts = value
      .map((part) => extractText(part))
      .filter((part) => part.length > 0);
    return parts.join('\n').trim();
  }
  if (!isRecord(value)) return '';

  const direct =
    asString((value as any).text) ??
    asString((value as any).value) ??
    asString((value as any).content) ??
    null;
  if (direct && direct.trim()) return direct.trim();

  if (isRecord((value as any).text)) {
    const nestedText = (value as any).text;
    const nested =
      asString((nestedText as any).value) ??
      asString((nestedText as any).text) ??
      asString((nestedText as any).content) ??
      null;
    if (nested && nested.trim()) return nested.trim();
  }

  const nestedContent = (value as any).content;
  if (nestedContent !== undefined) {
    const nested = extractText(nestedContent);
    if (nested) return nested;
  }
  return '';
}

function usesMaxCompletionTokens(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith('gpt-5');
}

function supportsCustomTemperature(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return !normalized.startsWith('gpt-5');
}

function reasoningEffortForModel(model: string): 'minimal' | null {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith('gpt-5') ? 'minimal' : null;
}

const TRANSLATION_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'translation_items',
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
};

function describeEmptyResponse(args: { model: string; response: OpenAIChatResponse }): string {
  const choice = args.response.choices?.[0];
  const finishReason = choice?.finish_reason || 'unknown';
  const completionTokens = args.response.usage?.completion_tokens ?? 0;
  const reasoningTokens = args.response.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  const refusal = extractText(choice?.message?.refusal);
  return [
    `Empty model response for ${args.response.model || args.model}`,
    `finish_reason=${finishReason}`,
    `completion_tokens=${completionTokens}`,
    `reasoning_tokens=${reasoningTokens}`,
    refusal ? `refusal=${refusal}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

export async function callOpenAiChat(args: {
  env: Env;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ content: string; usage: Usage }> {
  if (!args.env.OPENAI_API_KEY) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Missing OPENAI_API_KEY' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = Date.now();

  try {
    let res: Response;
    try {
      const reasoningEffort = reasoningEffortForModel(args.model);
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${args.env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: args.model,
          messages: args.messages,
          ...(supportsCustomTemperature(args.model) ? { temperature: args.temperature } : {}),
          ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          ...(usesMaxCompletionTokens(args.model)
            ? { max_completion_tokens: args.maxTokens }
            : { max_tokens: args.maxTokens }),
          response_format: TRANSLATION_RESPONSE_FORMAT,
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

    let responseJson: OpenAIChatResponse;
    try {
      responseJson = (await res.json()) as OpenAIChatResponse;
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Invalid upstream JSON' });
    }

    const latencyMs = Date.now() - startedAt;
    const firstMessage = responseJson.choices?.[0]?.message;
    const content =
      extractText(firstMessage?.content) ||
      extractText(firstMessage?.refusal) ||
      extractText(responseJson.output_text);
    if (!content) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider: 'openai',
        message: describeEmptyResponse({ model: args.model, response: responseJson }),
      });
    }

    const usage: Usage = {
      provider: 'openai',
      model: responseJson.model || args.model,
      promptTokens: responseJson.usage?.prompt_tokens ?? 0,
      completionTokens: responseJson.usage?.completion_tokens ?? 0,
      latencyMs,
    };

    return { content, usage };
  } finally {
    clearTimeout(timeout);
  }
}

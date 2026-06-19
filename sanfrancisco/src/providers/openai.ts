import { resolveAiModelCapability } from '@clickeen/ck-contracts/ai';
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

function providerFailure(args: {
  status: number;
  provider: 'openai';
  message: string;
  upstreamStatus?: number;
}): HttpError {
  return new HttpError(args.status, {
    code: 'PROVIDER_ERROR',
    provider: args.provider,
    message: args.message,
    ...(typeof args.upstreamStatus === 'number' ? { upstreamStatus: args.upstreamStatus } : {}),
  });
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
    throw providerFailure({ status: 500, provider: 'openai', message: 'AI provider is unavailable.' });
  }
  const capability = resolveAiModelCapability('openai', args.model);
  if (!capability) {
    throw providerFailure({
      status: 403,
      provider: 'openai',
      message: 'OpenAI model is not configured for this AI surface.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = Date.now();

  try {
    let res: Response;
    try {
      const tokenBudget = capability.tokenParam === 'max_completion_tokens'
        ? { max_completion_tokens: args.maxTokens }
        : { max_tokens: args.maxTokens };
      const baseUrl = args.env.OPENAI_BASE_URL ?? 'https://api.openai.com';
      res = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${args.env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: args.model,
          messages: args.messages,
          ...(capability.supportsTemperature ? { temperature: args.temperature } : {}),
          ...(capability.reasoningEffort ? { reasoning_effort: capability.reasoningEffort } : {}),
          ...tokenBudget,
        }),
      });
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw providerFailure({ status: 502, provider: 'openai', message: 'OpenAI request failed.' });
    }

    if (!res.ok) {
      await res.text().catch(() => '');
      throw providerFailure({
        status: 502,
        provider: 'openai',
        message: 'OpenAI returned an upstream error.',
        upstreamStatus: res.status,
      });
    }

    let responseJson: OpenAIChatResponse;
    try {
      responseJson = (await res.json()) as OpenAIChatResponse;
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw providerFailure({ status: 502, provider: 'openai', message: 'OpenAI returned invalid JSON.' });
    }

    const latencyMs = Date.now() - startedAt;
    const firstMessage = responseJson.choices?.[0]?.message;
    const content =
      extractText(firstMessage?.content) ||
      extractText(firstMessage?.refusal) ||
      extractText(responseJson.output_text);
    if (!content) {
      throw providerFailure({ status: 502, provider: 'openai', message: 'OpenAI returned an empty response.' });
    }
    const { prompt_tokens: promptTokens, completion_tokens: completionTokens } = responseJson.usage ?? {}; if (!responseJson.model?.trim() || typeof promptTokens !== 'number' || !Number.isInteger(promptTokens) || promptTokens < 0 || typeof completionTokens !== 'number' || !Number.isInteger(completionTokens) || completionTokens < 0) throw providerFailure({ status: 502, provider: 'openai', message: 'OpenAI returned an incomplete response.' });

    return { content, usage: { provider: 'openai', model: responseJson.model.trim(), promptTokens, completionTokens, latencyMs } };
  } finally {
    clearTimeout(timeout);
  }
}

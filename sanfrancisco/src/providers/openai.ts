import { HttpError, asString, isRecord } from '../http';
import type { Env, Usage } from '../types';
import type { ChatMessage } from '../ai/chat';

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
};

function usesMaxCompletionTokens(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith('gpt-5');
}

function supportsCustomTemperature(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return !normalized.startsWith('gpt-5');
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
          ...(usesMaxCompletionTokens(args.model)
            ? { max_completion_tokens: args.maxTokens }
            : { max_tokens: args.maxTokens }),
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
    const content = responseJson.choices?.[0]?.message?.content ?? '';
    if (!content) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Empty model response' });

    const usage: Usage = {
      provider: 'openai',
      model: responseJson.model ?? args.model,
      promptTokens: responseJson.usage?.prompt_tokens ?? 0,
      completionTokens: responseJson.usage?.completion_tokens ?? 0,
      latencyMs,
    };

    return { content, usage };
  } finally {
    clearTimeout(timeout);
  }
}

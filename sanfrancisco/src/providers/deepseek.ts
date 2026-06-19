import { resolveAiModelCapability } from '@clickeen/ck-contracts/ai';
import { HttpError, asString, isRecord } from '../http';
import type { Env, Usage } from '../types';
import type { ChatMessage } from '../ai/chat';

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
};

function providerFailure(args: { status: number; message: string; upstreamStatus?: number }): HttpError {
  return new HttpError(args.status, {
    code: 'PROVIDER_ERROR',
    provider: 'deepseek',
    message: args.message,
    ...(typeof args.upstreamStatus === 'number' ? { upstreamStatus: args.upstreamStatus } : {}),
  });
}

export async function callDeepseekChat(args: {
  env: Env;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ content: string; usage: Usage }> {
  if (!args.env.DEEPSEEK_API_KEY) {
    throw providerFailure({ status: 500, message: 'AI provider is unavailable.' });
  }
  const capability = resolveAiModelCapability('deepseek', args.model);
  if (!capability) {
    throw providerFailure({
      status: 403,
      message: 'DeepSeek model is not configured for this AI surface.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = Date.now();

  try {
    let res: Response;
    try {
      const baseUrl = args.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
      const tokenBudget = capability.tokenParam === 'max_completion_tokens'
        ? { max_completion_tokens: args.maxTokens }
        : { max_tokens: args.maxTokens };
      res = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${args.env.DEEPSEEK_API_KEY}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: args.model,
          messages: args.messages,
          ...(capability.supportsTemperature ? { temperature: args.temperature } : {}),
          ...tokenBudget,
        }),
      });
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw providerFailure({ status: 502, message: 'DeepSeek request failed.' });
    }

    if (!res.ok) {
      await res.text().catch(() => '');
      throw providerFailure({ status: 502, message: 'DeepSeek returned an upstream error.', upstreamStatus: res.status });
    }

    let responseJson: OpenAIChatResponse;
    try {
      responseJson = (await res.json()) as OpenAIChatResponse;
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw providerFailure({ status: 502, message: 'DeepSeek returned invalid JSON.' });
    }

    const latencyMs = Date.now() - startedAt;
    const content = responseJson.choices?.[0]?.message?.content ?? '';
    if (!content) throw providerFailure({ status: 502, message: 'DeepSeek returned an empty response.' });
    const { prompt_tokens: promptTokens, completion_tokens: completionTokens } = responseJson.usage ?? {}; if (!responseJson.model?.trim() || typeof promptTokens !== 'number' || !Number.isInteger(promptTokens) || promptTokens < 0 || typeof completionTokens !== 'number' || !Number.isInteger(completionTokens) || completionTokens < 0) throw providerFailure({ status: 502, message: 'DeepSeek returned an incomplete response.' });

    return { content, usage: { provider: 'deepseek', model: responseJson.model.trim(), promptTokens, completionTokens, latencyMs } };
  } finally {
    clearTimeout(timeout);
  }
}

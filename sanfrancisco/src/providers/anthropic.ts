import { HttpError, asString, isRecord } from '../http';
import type { Env, Usage } from '../types';
import type { ChatMessage } from '../ai/chat';

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
};

function toAnthropicMessages(messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    out.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
  }
  return out;
}

function extractSystemPrompt(messages: ChatMessage[]): string | null {
  const system = messages.find((m) => m.role === 'system');
  return system ? system.content : null;
}

export async function callAnthropicChat(args: {
  env: Env;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ content: string; usage: Usage }> {
  if (!args.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'anthropic', message: 'Missing ANTHROPIC_API_KEY' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = Date.now();

  try {
    let res: Response;
    try {
      const system = extractSystemPrompt(args.messages);
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': args.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: args.model,
          max_tokens: args.maxTokens,
          temperature: args.temperature,
          system: system ?? undefined,
          messages: toAnthropicMessages(args.messages),
        }),
      });
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'anthropic', message: 'Upstream request failed' });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'anthropic', message: `Upstream error (${res.status}) ${text}`.trim() });
    }

    let responseJson: AnthropicResponse;
    try {
      responseJson = (await res.json()) as AnthropicResponse;
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'anthropic', message: 'Invalid upstream JSON' });
    }

    const latencyMs = Date.now() - startedAt;
    const content = responseJson.content?.find((c) => c.type === 'text')?.text ?? '';
    if (!content) {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'anthropic', message: 'Empty model response' });
    }

    const usage: Usage = {
      provider: 'anthropic',
      model: responseJson.model ?? args.model,
      promptTokens: responseJson.usage?.input_tokens ?? 0,
      completionTokens: responseJson.usage?.output_tokens ?? 0,
      latencyMs,
    };

    return { content, usage };
  } finally {
    clearTimeout(timeout);
  }
}

import { HttpError } from '../http';
import {
  getGrantMaxTokens,
  getGrantTimeoutMs,
} from '../grants';
import type { AIGrant, Env, Usage } from '../types';
import { resolveModelSelection, type ModelSelection } from './modelRouter';
import { callDeepseekChat } from '../providers/deepseek';
import { callOpenAiChat } from '../providers/openai';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function callProviderForSelection(args: {
  env: Env;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  selection: ModelSelection;
}): Promise<{ content: string; usage: Usage }> {
  if (args.selection.provider === 'deepseek') {
    return callDeepseekChat({
      env: args.env,
      model: args.selection.model,
      messages: args.messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      timeoutMs: args.timeoutMs,
    });
  }
  if (args.selection.provider === 'openai') {
    return callOpenAiChat({
      env: args.env,
      model: args.selection.model,
      messages: args.messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      timeoutMs: args.timeoutMs,
    });
  }
  throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unsupported provider: ${args.selection.provider}` });
}

function isRetryableProviderFailure(err: unknown): boolean {
  if (!(err instanceof HttpError)) return false;
  if (err.status !== 502) return false;
  if (err.error.code !== 'PROVIDER_ERROR') return false;
  const message = String(err.error.message || '').toLowerCase();
  if (!message) return false;
  const statusMatch = message.match(/upstream error\s*\((\d{3})\)/);
  const upstreamStatus = statusMatch ? Number(statusMatch[1]) : null;
  if (upstreamStatus != null && Number.isFinite(upstreamStatus)) {
    if (upstreamStatus >= 500) return true;
    if (upstreamStatus === 408 || upstreamStatus === 409 || upstreamStatus === 425 || upstreamStatus === 429) return true;
  }
  return (
    message.includes('empty model response') ||
    message.includes('upstream request failed') ||
    message.includes('invalid upstream json') ||
    message.includes('rate limit') ||
    message.includes('temporarily unavailable') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callChatCompletion(args: {
  env: Env;
  grant: AIGrant;
  agentId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: string; usage: Usage }> {
  const selection = resolveModelSelection({ grant: args.grant, agentId: args.agentId });

  const grantMaxTokens = getGrantMaxTokens(args.grant);
  const grantTimeoutMs = getGrantTimeoutMs(args.grant);
  const maxTokens = args.maxTokens ? Math.min(args.maxTokens, grantMaxTokens) : grantMaxTokens;
  const timeoutMs = args.timeoutMs ? Math.min(args.timeoutMs, grantTimeoutMs) : grantTimeoutMs;
  const temperature = typeof args.temperature === 'number' ? args.temperature : 0.2;

  let result: { content: string; usage: Usage } | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      result = await callProviderForSelection({
        env: args.env,
        messages: args.messages,
        temperature,
        maxTokens,
        timeoutMs,
        selection,
      });
      break;
    } catch (err) {
      lastError = err;
      if (isRetryableProviderFailure(err) && attempt < 2) {
        await sleep(120);
        continue;
      }
      throw err;
    }
  }
  if (!result && lastError) throw lastError;
  if (!result) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: selection.provider, message: 'Empty model response' });

  return {
    content: result.content,
    usage: result.usage,
  };
}

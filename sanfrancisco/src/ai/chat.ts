import { assertProviderAllowed, getGrantMaxTokens, getGrantTimeoutMs } from '../grants';
import type { AIGrant, Env, Usage } from '../types';
import { resolveModelSelection } from './modelRouter';
import { callDeepseekChat } from '../providers/deepseek';
import { callOpenAiChat } from '../providers/openai';
import { callAnthropicChat } from '../providers/anthropic';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function callChatCompletion(args: {
  env: Env;
  grant: AIGrant;
  agentId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: string; usage: Usage }> {
  const selection = resolveModelSelection({ env: args.env, grant: args.grant, agentId: args.agentId });
  assertProviderAllowed(args.grant, selection.provider);

  const grantMaxTokens = getGrantMaxTokens(args.grant);
  const grantTimeoutMs = getGrantTimeoutMs(args.grant);
  const maxTokens = args.maxTokens ? Math.min(args.maxTokens, grantMaxTokens) : grantMaxTokens;
  const timeoutMs = args.timeoutMs ? Math.min(args.timeoutMs, grantTimeoutMs) : grantTimeoutMs;
  const temperature = typeof args.temperature === 'number' ? args.temperature : 0.2;

  if (selection.provider === 'deepseek') {
    return callDeepseekChat({
      env: args.env,
      model: selection.model,
      messages: args.messages,
      temperature,
      maxTokens,
      timeoutMs,
    });
  }

  if (selection.provider === 'openai') {
    return callOpenAiChat({
      env: args.env,
      model: selection.model,
      messages: args.messages,
      temperature,
      maxTokens,
      timeoutMs,
    });
  }

  return callAnthropicChat({
    env: args.env,
    model: selection.model,
    messages: args.messages,
    temperature,
    maxTokens,
    timeoutMs,
  });
}

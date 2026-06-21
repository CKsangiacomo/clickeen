import { HttpError } from '../http';
import { resolveGrantBudgets } from '../grants';
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

export async function callChatCompletion(args: {
  env: Env;
  grant: AIGrant;
  agentId: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<{ content: string; usage: Usage }> {
  const selection = resolveModelSelection({ env: args.env, grant: args.grant, agentId: args.agentId });

  const budget = resolveGrantBudgets(args.grant);
  const temperature = typeof args.temperature === 'number' ? args.temperature : 0.2;

  const result = await callProviderForSelection({
    env: args.env,
    messages: args.messages,
    temperature,
    maxTokens: budget.maxTokens,
    timeoutMs: budget.timeoutMs,
    selection,
  });

  return {
    content: result.content,
    usage: result.usage,
  };
}

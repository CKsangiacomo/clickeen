import { resolveAiAgent } from '@clickeen/ck-policy';
import { HttpError } from '../http';
import type { AIGrant, Env } from '../types';

export type AiProvider = 'deepseek' | 'openai' | 'anthropic';

export type ModelSelection = {
  provider: AiProvider;
  model: string;
  canonicalAgentId: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveProvider(args: { allowedProviders: AiProvider[]; defaultProvider: AiProvider; selectedProvider?: string }): AiProvider {
  const allowed = args.allowedProviders;
  if (!allowed.length) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'No providers available' });
  }

  const selected = asTrimmedString(args.selectedProvider);
  if (selected) {
    if (!allowed.includes(selected as AiProvider)) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Provider not allowed: ${selected}` });
    }
    return selected as AiProvider;
  }

  if (allowed.includes(args.defaultProvider)) return args.defaultProvider;
  return allowed[0]!;
}

function resolveModelForProvider(env: Env, provider: AiProvider, selectedModel?: string): string {
  const modelOverride = asTrimmedString(selectedModel);
  if (modelOverride) return modelOverride;

  if (provider === 'deepseek') return env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  if (provider === 'openai') return env.OPENAI_MODEL ?? 'gpt-5.2';
  return env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20240620';
}

export function resolveModelSelection(args: { env: Env; grant: AIGrant; agentId: string }): ModelSelection {
  const resolved = resolveAiAgent(args.agentId);
  if (!resolved) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${args.agentId}` });
  }

  const entry = resolved.entry;
  const allowedProviders = (args.grant.ai?.allowedProviders ?? []) as AiProvider[];
  const selectedProvider = args.grant.ai?.selectedProvider;

  const provider = resolveProvider({
    allowedProviders,
    defaultProvider: entry.defaultProvider as AiProvider,
    selectedProvider,
  });

  const model = resolveModelForProvider(args.env, provider, args.grant.ai?.selectedModel);

  return { provider, model, canonicalAgentId: resolved.canonicalId };
}

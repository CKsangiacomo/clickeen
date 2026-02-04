import { resolveAiAgent } from '@clickeen/ck-policy';
import { HttpError } from '../http';
import type { AIGrant, Env } from '../types';

export type AiProvider = 'deepseek' | 'openai' | 'anthropic' | 'groq' | 'amazon';

export type ModelSelection = {
  provider: AiProvider;
  model: string;
  canonicalAgentId: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveProvider(args: {
  allowedProviders: AiProvider[];
  defaultProvider: AiProvider;
  selectedProvider?: string;
}): AiProvider {
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

function resolveModelForProvider(args: {
  env: Env;
  provider: AiProvider;
  selectedModel?: string;
  grantModelPolicy?: { defaultModel: string; allowed: string[] } | null;
}): string {
  const modelOverride = asTrimmedString(args.selectedModel);
  if (modelOverride) {
    if (args.grantModelPolicy && !args.grantModelPolicy.allowed.includes(modelOverride)) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Model not allowed: ${modelOverride}` });
    }
    return modelOverride;
  }

  if (args.grantModelPolicy) return args.grantModelPolicy.defaultModel;

  if (args.provider === 'deepseek') return args.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  if (args.provider === 'openai') return args.env.OPENAI_MODEL ?? 'gpt-5.2';
  if (args.provider === 'groq') return args.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  if (args.provider === 'amazon') return args.env.AMAZON_BEDROCK_MODEL_ID ?? 'amazon.nova-lite-v1:0';
  return args.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20240620';
}

export function resolveModelSelection(args: { env: Env; grant: AIGrant; agentId: string }): ModelSelection {
  const resolved = resolveAiAgent(args.agentId);
  if (!resolved) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${args.agentId}` });
  }

  const entry = resolved.entry;
  const allowedProviders = (args.grant.ai?.allowedProviders ?? []) as AiProvider[];
  const selectedProvider = args.grant.ai?.selectedProvider;
  const defaultProvider = (args.grant.ai?.defaultProvider ?? entry.defaultProvider) as AiProvider;

  const provider = resolveProvider({
    allowedProviders,
    defaultProvider,
    selectedProvider,
  });

  const modelPolicy = args.grant.ai?.models?.[provider] ?? null;
  const model = resolveModelForProvider({
    env: args.env,
    provider,
    selectedModel: args.grant.ai?.selectedModel,
    grantModelPolicy: modelPolicy ? { defaultModel: modelPolicy.defaultModel, allowed: modelPolicy.allowed } : null,
  });

  return { provider, model, canonicalAgentId: resolved.canonicalId };
}

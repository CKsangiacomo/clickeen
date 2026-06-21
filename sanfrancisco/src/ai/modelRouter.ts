import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import { HttpError } from '../http';
import type { AIGrant, Env } from '../types';
import { assertModelRuntimeAvailable } from './modelAvailability';

export type AiProvider = 'deepseek' | 'openai';

export type ModelSelection = {
  provider: AiProvider;
  model: string;
  canonicalAgentId: string;
};

function resolveProvider(grant: AIGrant): AiProvider {
  const policy = grant.ai;
  if (!policy) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'Missing AI runtime policy' });
  }
  const selectedProvider = policy.selectedModel?.provider;
  if (selectedProvider) return selectedProvider;

  const allowed = Object.keys(policy.modelsByProvider) as AiProvider[];
  if (!allowed.length) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'No providers available' });
  }

  const defaultProvider = policy.defaultModel.provider;
  if (!allowed.includes(defaultProvider)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Provider not allowed: ${defaultProvider}` });
  }
  return defaultProvider;
}

function resolveModelForProvider(args: {
  provider: AiProvider;
  grant: AIGrant;
  grantModelPolicy?: { defaultModel: string; allowed: string[] } | null;
}): string {
  const selectedModel = args.grant.ai?.selectedModel;
  if (selectedModel) {
    if (selectedModel.provider !== args.provider) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Model provider mismatch: ${selectedModel.provider}` });
    }
    if (!args.grantModelPolicy?.allowed.includes(selectedModel.model)) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Model not allowed: ${selectedModel.model}` });
    }
    return selectedModel.model;
  }

  if (args.grantModelPolicy) return args.grantModelPolicy.defaultModel;
  throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Model policy missing for provider: ${args.provider}` });
}

export function resolveModelSelection(args: { env: Env; grant: AIGrant; agentId: string }): ModelSelection {
  const resolved = resolveAiAgent(args.agentId);
  if (!resolved) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${args.agentId}` });
  }
  const provider = resolveProvider(args.grant);

  const modelPolicy = args.grant.ai?.modelsByProvider?.[provider] ?? null;
  const model = resolveModelForProvider({
    provider,
    grant: args.grant,
    grantModelPolicy: modelPolicy ? { defaultModel: modelPolicy.defaultModel, allowed: modelPolicy.allowed } : null,
  });

  assertModelRuntimeAvailable({ env: args.env, provider, model });

  return { provider, model, canonicalAgentId: resolved.canonicalId };
}

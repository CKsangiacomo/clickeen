import { getAiModelManagementConfig } from '@clickeen/ck-contracts/ai-model-management';
import type { AiModelRef, AiProvider } from '@clickeen/ck-contracts/ai';
import latestConformance from '../../../documentation/ai/model-conformance/latest.json';
import { HttpError } from '../http';
import type { Env } from '../types';

type ConformanceResult = {
  status: 'passed' | 'failed' | 'blocked';
  provider: AiProvider;
  model: string;
};

function modelKey(model: AiModelRef): string {
  return `${model.provider}:${model.model}`;
}

function configuredModelKeys(): Set<string> {
  const config = getAiModelManagementConfig();
  const keys = new Set<string>();
  const add = (model: AiModelRef): void => {
    keys.add(modelKey(model));
  };
  config.productCopilot.enabledModels.forEach(add);
  config.sdrCopilot.enabledModels.forEach(add);
  Object.values(config.internalAgents).forEach((agent) => {
    agent.routes.forEach((route) => add(route.model));
  });
  return keys;
}

function passedConformanceKeys(): Set<string> {
  const results = (latestConformance as { results?: unknown }).results;
  if (!Array.isArray(results)) return new Set();
  const keys = new Set<string>();
  for (const result of results) {
    const entry = result as Partial<ConformanceResult>;
    if (
      entry.status === 'passed' &&
      (entry.provider === 'deepseek' || entry.provider === 'openai') &&
      typeof entry.model === 'string' &&
      entry.model.trim()
    ) {
      keys.add(`${entry.provider}:${entry.model.trim()}`);
    }
  }
  return keys;
}

function providerConfigured(env: Env, provider: AiProvider): boolean {
  if (provider === 'deepseek') return Boolean(env.DEEPSEEK_API_KEY?.trim());
  if (provider === 'openai') return Boolean(env.OPENAI_API_KEY?.trim());
  return false;
}

export function assertModelRuntimeAvailable(args: {
  env: Env;
  provider: AiProvider;
  model: string;
}): void {
  const model = { provider: args.provider, model: args.model };
  const key = modelKey(model);
  if (!configuredModelKeys().has(key)) {
    throw new HttpError(403, {
      code: 'CAPABILITY_DENIED',
      message: `Model is not in managed config: ${args.provider}:${args.model}`,
    });
  }
  if (!passedConformanceKeys().has(key)) {
    throw new HttpError(403, {
      code: 'CAPABILITY_DENIED',
      message: `Model has no passing conformance evidence: ${args.provider}:${args.model}`,
    });
  }
  if (!providerConfigured(args.env, args.provider)) {
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: args.provider,
      message: 'AI provider is unavailable.',
    });
  }
}

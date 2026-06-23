import type { AiProvider } from '@clickeen/ck-contracts/ai';
import { HttpError } from '../http';
import type { Env } from '../types';

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
  if (!providerConfigured(args.env, args.provider)) {
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: args.provider,
      message: 'AI provider is unavailable.',
    });
  }
}

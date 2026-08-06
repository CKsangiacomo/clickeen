import type { AiGrantPolicy } from '@clickeen/ck-contracts/ai';
import type { TranslationTarget } from '@clickeen/ck-contracts/translations';
import { mintRomaAiGrant } from '@clickeen/ck-policy';
import { getOptionalCloudflareRequestContext } from '../cloudflare-request-context';

export type RomaAIGrant = {
  iss: 'roma';
  jti?: string;
  sub: { kind: 'user'; userId: string; accountId: string };
  exp: number;
  caps: string[];
  budgets: {
    maxTokens: number;
    timeoutMs: number;
  };
  mode: 'editor' | 'ops';
  ai?: AiGrantPolicy;
  trace?: {
    sessionId?: string;
    accountPublicId?: string;
    instanceId?: string;
    translationTarget?: TranslationTarget;
    activeLocales?: string[];
    surfaceId?: string;
    envStage?: string;
  };
};

function readTrimmedKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveRomaAiGrantPrivateKeyPem(): string {
  const fromRequestContext = getOptionalCloudflareRequestContext<{ env?: { ROMA_AI_GRANT_PRIVATE_KEY_PEM?: string } }>()
    ?.env?.ROMA_AI_GRANT_PRIVATE_KEY_PEM;
  const requestKey = readTrimmedKey(fromRequestContext);
  if (requestKey) return requestKey;

  const processKey = readTrimmedKey(
    typeof process !== 'undefined' ? process.env.ROMA_AI_GRANT_PRIVATE_KEY_PEM : undefined,
  );
  if (processKey) return processKey;

  throw new Error('[Roma] Missing ROMA_AI_GRANT_PRIVATE_KEY_PEM');
}

export function resolveEnvStage(): string {
  const stage = String(process.env.ENV_STAGE || process.env.CF_PAGES_BRANCH || '').trim().toLowerCase();
  if (stage) return stage;
  return process.env.NODE_ENV === 'development' ? 'local' : 'cloud-dev';
}

export async function mintRomaAIGrant(grant: RomaAIGrant, privateKeyPem: string): Promise<string> {
  return await mintRomaAiGrant(grant, privateKeyPem);
}

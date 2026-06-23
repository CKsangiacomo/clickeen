import type { AiGrantPolicy } from '@clickeen/ck-contracts/ai';
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
    activeLocales?: string[];
    surfaceId?: string;
    envStage?: string;
  };
};

function readTrimmedSecret(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveAiGrantSecret(): string {
  const fromRequestContext = getOptionalCloudflareRequestContext<{ env?: { AI_GRANT_HMAC_SECRET?: string } }>()
    ?.env?.AI_GRANT_HMAC_SECRET;
  const requestSecret = readTrimmedSecret(fromRequestContext);
  if (requestSecret) return requestSecret;

  const processSecret = readTrimmedSecret(typeof process !== 'undefined' ? process.env.AI_GRANT_HMAC_SECRET : undefined);
  if (processSecret) return processSecret;

  throw new Error('[Roma] Missing AI_GRANT_HMAC_SECRET');
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

export async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  return base64UrlEncodeBytes(await hmacSha256(secret, message));
}

export function resolveEnvStage(): string {
  const stage = String(process.env.ENV_STAGE || process.env.CF_PAGES_BRANCH || '').trim().toLowerCase();
  if (stage) return stage;
  return process.env.NODE_ENV === 'development' ? 'local' : 'cloud-dev';
}

export async function mintRomaAIGrant(grant: RomaAIGrant, secret: string): Promise<string> {
  const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(grant)));
  const sigBytes = await hmacSha256(secret, `ckgrant.${payloadB64}`);
  const sigB64 = base64UrlEncodeBytes(sigBytes);
  return `ckgrant.${payloadB64}.${sigB64}`;
}

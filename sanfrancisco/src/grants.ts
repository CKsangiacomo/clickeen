import type { AiGrantPolicy, AiProfile, AiProvider } from '@clickeen/ck-policy';
import type { AIGrant } from './types';
import { HttpError, asNumber, asString, isRecord } from './http';

const AI_PROVIDER_SET = new Set<AiProvider>(['deepseek', 'openai', 'anthropic', 'groq', 'amazon']);
const AI_PROFILE_SET = new Set<AiProfile>(['free_low', 'paid_standard', 'paid_premium', 'curated_premium']);

function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDER_SET.has(value as AiProvider);
}

function isAiProfile(value: string): value is AiProfile {
  return AI_PROFILE_SET.has(value as AiProfile);
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

export async function verifyGrant(grant: string, secret: string): Promise<AIGrant> {
  const parts = grant.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Invalid grant format' });
  }

  const payloadB64 = parts[1];
  const sigB64 = parts[2];

  let payload: unknown;
  try {
    const jsonText = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    payload = JSON.parse(jsonText);
  } catch {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Invalid grant payload' });
  }

  if (!isRecord(payload)) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Invalid grant payload' });

  const v = asNumber(payload.v);
  const iss = asString(payload.iss);
  const exp = asNumber(payload.exp);
  const jtiRaw = (payload as any).jti;
  const jti = asString(jtiRaw);
  const caps = Array.isArray(payload.caps) && payload.caps.every((c) => typeof c === 'string') ? payload.caps : null;
  const budgets = isRecord(payload.budgets) ? payload.budgets : null;
  const mode = asString(payload.mode);
  const sub = isRecord(payload.sub) ? payload.sub : null;

  if (v !== 1 || iss !== 'paris' || exp === null || !caps || !budgets || !sub || (mode !== 'editor' && mode !== 'ops')) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant missing required fields' });
  }
  if (jtiRaw !== undefined && !jti) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant jti is invalid' });
  }
  if (jti) (payload as any).jti = jti;

  const subKind = asString(sub.kind);
  if (subKind === 'anon') {
    if (!asString(sub.sessionId)) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject missing sessionId' });
  } else if (subKind === 'user') {
    if (!asString(sub.userId) || !asString(sub.workspaceId)) {
      throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject missing userId/workspaceId' });
    }
  } else if (subKind === 'service') {
    if (!asString(sub.serviceId)) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject missing serviceId' });
  } else {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject kind is invalid' });
  }

  const expectedSig = await hmacSha256(secret, `v1.${payloadB64}`);
  const providedSig = base64UrlToBytes(sigB64);
  if (!timingSafeEqual(expectedSig, providedSig)) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant signature mismatch' });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (exp <= nowSec) throw new HttpError(401, { code: 'GRANT_EXPIRED', message: 'Grant expired' });

  const ai = normalizeAiPolicy((payload as any).ai);
  if (ai) {
    (payload as any).ai = ai;
  }

  return payload as AIGrant;
}

function normalizeAiPolicy(value: unknown): AiGrantPolicy | undefined {
  if (!isRecord(value)) return undefined;
  const profileRaw = asString(value.profile);
  const profile = profileRaw && isAiProfile(profileRaw) ? profileRaw : null;
  const allowedProvidersRaw = (value as any).allowedProviders;
  const allowedProviders =
    Array.isArray(allowedProvidersRaw) &&
    allowedProvidersRaw.every((p) => typeof p === 'string' && p.trim() && isAiProvider(String(p).trim()))
      ? (allowedProvidersRaw.map((p) => String(p).trim()) as AiProvider[])
      : null;
  const defaultProviderRaw = asString((value as any).defaultProvider);
  const defaultProvider = defaultProviderRaw && isAiProvider(defaultProviderRaw) ? defaultProviderRaw : null;
  if (!profile || !allowedProviders || allowedProviders.length === 0 || !defaultProvider) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy missing required fields' });
  }
  if (!allowedProviders.includes(defaultProvider)) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy defaultProvider is not allowed' });
  }
  const allowProviderChoice = (value as any).allowProviderChoice === true;
  const allowModelChoice = (value as any).allowModelChoice === true;
  const selectedProviderRaw = asString((value as any).selectedProvider);
  const selectedProvider = selectedProviderRaw ? (isAiProvider(selectedProviderRaw) ? selectedProviderRaw : null) : undefined;
  if (selectedProviderRaw && !selectedProvider) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy selectedProvider is invalid' });
  }
  if (selectedProvider && !allowedProviders.includes(selectedProvider)) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy selectedProvider is not allowed' });
  }
  const selectedModel = asString((value as any).selectedModel);
  const modelsRaw = (value as any).models;
  const models: NonNullable<AiGrantPolicy['models']> = {};
  if (modelsRaw !== undefined) {
    if (!isRecord(modelsRaw)) {
      throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy models must be an object' });
    }
    for (const [providerRaw, config] of Object.entries(modelsRaw)) {
      if (!isAiProvider(providerRaw)) continue;
      const provider = providerRaw;
      if (!allowedProviders.includes(provider)) continue;
      if (!isRecord(config)) continue;
      const defaultModel = asString((config as any).defaultModel);
      const allowedRaw = (config as any).allowed;
      const allowed =
        Array.isArray(allowedRaw) && allowedRaw.every((m) => typeof m === 'string' && m.trim())
          ? allowedRaw.map((m) => m.trim())
          : [];
      if (!defaultModel || allowed.length === 0) continue;
      if (!allowed.includes(defaultModel)) continue;
      models[provider] = { defaultModel, allowed };
    }
  }
  const tokenBudgetDay = asNumber((value as any).tokenBudgetDay);
  const tokenBudgetMonth = asNumber((value as any).tokenBudgetMonth);

  const policy: AiGrantPolicy = {
    profile,
    allowedProviders,
    defaultProvider,
    ...(Object.keys(models).length ? { models } : {}),
    ...(allowProviderChoice ? { allowProviderChoice: true } : {}),
    ...(allowModelChoice ? { allowModelChoice: true } : {}),
    ...(selectedProvider ? { selectedProvider } : {}),
    ...(selectedModel ? { selectedModel } : {}),
    ...(tokenBudgetDay != null ? { tokenBudgetDay } : {}),
    ...(tokenBudgetMonth != null ? { tokenBudgetMonth } : {}),
  };

  return policy;
}

export function assertCap(grant: AIGrant, capability: string): void {
  if (!grant.caps.includes(capability)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Capability denied: ${capability}` });
  }
}

export function assertProviderAllowed(grant: AIGrant, provider: string): void {
  const allowed = grant.ai?.allowedProviders;
  if (!allowed) return;
  if (!isAiProvider(provider)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Provider not allowed: ${provider}` });
  }
  const selected = grant.ai?.selectedProvider;
  if (selected && selected !== provider) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Provider mismatch: ${provider} != ${selected}` });
  }
  if (!allowed.includes(provider)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Provider not allowed: ${provider}` });
  }
}

export function getGrantMaxTokens(grant: AIGrant): number {
  const maxTokens = (grant.budgets as any).maxTokens;
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new HttpError(400, { code: 'GRANT_INVALID', message: 'Grant budgets.maxTokens must be a positive number' });
  }
  return maxTokens;
}

export function getGrantTimeoutMs(grant: AIGrant): number {
  const timeoutMs = (grant.budgets as any).timeoutMs;
  if (timeoutMs === undefined) return 20_000;
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new HttpError(400, { code: 'GRANT_INVALID', message: 'Grant budgets.timeoutMs must be a positive number' });
  }
  return timeoutMs;
}

export function getGrantMaxRequests(grant: AIGrant): number {
  const maxRequests = (grant.budgets as any).maxRequests;
  if (maxRequests === undefined) return 1;
  if (typeof maxRequests !== 'number' || !Number.isFinite(maxRequests) || maxRequests <= 0) {
    throw new HttpError(400, { code: 'GRANT_INVALID', message: 'Grant budgets.maxRequests must be a positive number' });
  }
  return Math.max(1, Math.floor(maxRequests));
}

export function getGrantMaxCostUsd(grant: AIGrant): number | null {
  const maxCostUsd = (grant.budgets as any).maxCostUsd;
  if (maxCostUsd === undefined) return null;
  if (typeof maxCostUsd !== 'number' || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0) {
    throw new HttpError(400, { code: 'GRANT_INVALID', message: 'Grant budgets.maxCostUsd must be a positive number' });
  }
  return maxCostUsd;
}

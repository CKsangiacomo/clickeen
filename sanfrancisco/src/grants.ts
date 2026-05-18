import type { AiGrantPolicy, AiModelRef, AiPolicyProfile, AiProvider } from '@clickeen/ck-contracts/ai';
import { timingSafeEqualBytes } from '@clickeen/ck-contracts/security';
import type { AIGrant } from './types';
import { HttpError, asNumber, asString, isRecord } from './http';

const AI_GRANT_ISSUER_SET = new Set<AIGrant['iss']>(['roma', 'sanfrancisco']);
const AI_PROVIDER_SET = new Set<AiProvider>(['deepseek', 'openai']);
const AI_POLICY_PROFILE_SET = new Set<AiPolicyProfile>(['free', 'tier1', 'tier2', 'tier3']);

function isAiGrantIssuer(value: string): value is AIGrant['iss'] {
  return AI_GRANT_ISSUER_SET.has(value as AIGrant['iss']);
}

function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDER_SET.has(value as AiProvider);
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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

  if (
    v !== 1 ||
    !iss ||
    !isAiGrantIssuer(iss) ||
    exp === null ||
    !caps ||
    !budgets ||
    !sub ||
    (mode !== 'editor' && mode !== 'ops')
  ) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant missing required fields' });
  }
  if (jtiRaw !== undefined && !jti) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant jti is invalid' });
  }
  if (jti) (payload as any).jti = jti;

  const subKind = asString(sub.kind);
  if (subKind === 'user') {
    if (!asString(sub.userId) || !asString(sub.accountId)) {
      throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject missing userId/accountId' });
    }
  } else if (subKind === 'service') {
    if (!asString(sub.serviceId)) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject missing serviceId' });
  } else {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject kind is invalid' });
  }

  const expectedSig = await hmacSha256(secret, `v1.${payloadB64}`);
  const providedSig = base64UrlToBytes(sigB64);
  if (!timingSafeEqualBytes(expectedSig, providedSig)) {
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
  const agentId = asString(value.agentId);
  const policyProfileRaw = asString((value as any).policyProfile);
  const policyProfile = AI_POLICY_PROFILE_SET.has(policyProfileRaw as AiPolicyProfile)
    ? (policyProfileRaw as AiPolicyProfile)
    : null;
  const enabled = (value as any).enabled === true;
  const defaultModel = normalizeAiModelRef((value as any).defaultModel);
  const modelsByProviderRaw = (value as any).modelsByProvider;
  const modelsByProvider: AiGrantPolicy['modelsByProvider'] = {};
  if (!agentId || !policyProfile || !enabled || !defaultModel || !isRecord(modelsByProviderRaw)) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy missing required fields' });
  }

  for (const [providerRaw, config] of Object.entries(modelsByProviderRaw)) {
    if (!isAiProvider(providerRaw)) continue;
    if (!isRecord(config)) continue;
    const defaultModelId = asString((config as any).defaultModel);
    const allowedRaw = (config as any).allowed;
    const allowed =
      Array.isArray(allowedRaw) && allowedRaw.every((m) => typeof m === 'string' && m.trim())
        ? allowedRaw.map((m) => m.trim())
        : [];
    if (!defaultModelId || allowed.length === 0) continue;
    if (!allowed.includes(defaultModelId)) continue;
    modelsByProvider[providerRaw] = { defaultModel: defaultModelId, allowed };
  }

  if (!Object.keys(modelsByProvider).length) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy has no provider model policy' });
  }
  const defaultProviderPolicy = modelsByProvider[defaultModel.provider];
  if (!defaultProviderPolicy || !defaultProviderPolicy.allowed.includes(defaultModel.model)) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy default model is not allowed' });
  }

  const allowModelPicker = (value as any).allowModelPicker === true;
  const selectedModel = normalizeAiModelRef((value as any).selectedModel);
  if (selectedModel) {
    if (!allowModelPicker) {
      throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy selectedModel is not allowed' });
    }
    const selectedProviderPolicy = modelsByProvider[selectedModel.provider];
    if (!selectedProviderPolicy || !selectedProviderPolicy.allowed.includes(selectedModel.model)) {
      throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy selectedModel is outside policy' });
    }
  }

  const maxTokensPerCall = asPositiveInteger((value as any).maxTokensPerCall);
  const maxTurnsPerThread = asPositiveInteger((value as any).maxTurnsPerThread);
  const maxMonthlyTurnsRaw = (value as any).maxMonthlyTurns;
  const maxMonthlyTurns = maxMonthlyTurnsRaw === null ? null : asPositiveInteger(maxMonthlyTurnsRaw);
  const timeoutMs = asPositiveInteger((value as any).timeoutMs);
  const learningCapture = normalizeLearningCapturePolicy((value as any).learningCapture);
  const policyVersion = asString((value as any).policyVersion);
  if (!maxTokensPerCall || !maxTurnsPerThread || maxMonthlyTurns === undefined || !timeoutMs || !learningCapture || !policyVersion) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant ai policy has invalid limits' });
  }

  return {
    agentId,
    policyProfile,
    enabled,
    defaultModel,
    modelsByProvider,
    allowModelPicker,
    ...(selectedModel ? { selectedModel } : {}),
    maxTokensPerCall,
    maxTurnsPerThread,
    maxMonthlyTurns,
    timeoutMs,
    learningCapture,
    policyVersion,
  };
}

function asPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

function normalizeAiModelRef(value: unknown): AiModelRef | undefined {
  if (!isRecord(value)) return undefined;
  const provider = asString((value as any).provider);
  const model = asString((value as any).model);
  if (!provider || !isAiProvider(provider) || !model) return undefined;
  return { provider, model };
}

function normalizeLearningCapturePolicy(value: unknown): AiGrantPolicy['learningCapture'] | undefined {
  if (!isRecord(value)) return undefined;
  const rawSamplePercent = (value as any).rawSamplePercent;
  if (typeof rawSamplePercent !== 'number' || !Number.isFinite(rawSamplePercent) || rawSamplePercent < 0 || rawSamplePercent > 100) {
    return undefined;
  }
  return {
    rawSamplePercent,
  };
}

export function assertCap(grant: AIGrant, capability: string): void {
  if (!grant.caps.includes(capability)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Capability denied: ${capability}` });
  }
}

export function assertProviderAllowed(grant: AIGrant, provider: string): void {
  if (!isAiProvider(provider)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Provider not allowed: ${provider}` });
  }
  const policy = grant.ai;
  if (!policy) return;
  const selected = policy.selectedModel?.provider;
  if (selected && selected !== provider) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Provider mismatch: ${provider} != ${selected}` });
  }
  if (!policy.modelsByProvider[provider]) {
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

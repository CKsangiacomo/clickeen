import type { AiGrantPolicy, AiModelRef, AiPolicyProfile, AiProvider } from '@clickeen/ck-contracts/ai';
import { readRomaAiGrantEnvelope, verifyRomaAiGrantSignature } from '@clickeen/ck-policy';
import type { AIGrant } from './types';
import { HttpError, asNumber, asString, isRecord } from './http';

const AI_PROVIDER_SET = new Set<AiProvider>(['deepseek', 'openai']);
const AI_POLICY_PROFILE_SET = new Set<AiPolicyProfile>(['free', 'tier1', 'tier2', 'tier3', 'tier4', 'tier99']);

function isAiGrantIssuer(value: string): value is AIGrant['iss'] {
  return value === 'roma';
}

function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDER_SET.has(value as AiProvider);
}

export async function verifyGrant(grant: string, publicKeyPem: string): Promise<AIGrant> {
  const envelope = readRomaAiGrantEnvelope(grant);
  if (!envelope) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Invalid grant format or payload' });
  const key = String(publicKeyPem || '').trim();
  if (!key) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Missing ROMA_AI_GRANT_PUBLIC_KEY_PEM' });
  }
  try {
    if (!(await verifyRomaAiGrantSignature(envelope, key))) {
      throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant signature mismatch' });
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Invalid ROMA_AI_GRANT_PUBLIC_KEY_PEM' });
  }
  const payload = envelope.payload;

  if (!isRecord(payload)) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Invalid grant payload' });

  const iss = asString(payload.iss);
  const exp = asNumber(payload.exp);
  const jtiRaw = (payload as any).jti;
  const jti = asString(jtiRaw);
  const caps = Array.isArray(payload.caps) && payload.caps.every((c) => typeof c === 'string') ? payload.caps : null;
  const budgets = isRecord(payload.budgets) ? payload.budgets : null;
  const mode = asString(payload.mode);
  const sub = isRecord(payload.sub) ? payload.sub : null;

  if (
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
  } else {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject kind is invalid' });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (exp <= nowSec) throw new HttpError(401, { code: 'GRANT_EXPIRED', message: 'Grant expired' });

  const ai = normalizeAiPolicy((payload as any).ai);
  if (ai) {
    (payload as any).ai = ai;
  }
  resolveGrantBudgets(payload as AIGrant);

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
  const policyId = asString((value as any).policyId);
  if (!maxTokensPerCall || !maxTurnsPerThread || maxMonthlyTurns === undefined || !timeoutMs || !policyId) {
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
    policyId,
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

export function resolveGrantBudgets(grant: AIGrant): { maxTokens: number; timeoutMs: number } {
  const maxTokens = (grant.budgets as any).maxTokens;
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new HttpError(400, { code: 'GRANT_INVALID', message: 'Grant budgets.maxTokens must be a positive number' });
  }
  const timeoutMs = (grant.budgets as any).timeoutMs;
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new HttpError(400, { code: 'GRANT_INVALID', message: 'Grant budgets.timeoutMs must be a positive number' });
  }
  return { maxTokens, timeoutMs };
}

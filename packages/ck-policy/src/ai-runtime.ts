import {
  deriveAiModelOptionsForUi,
  listAiModelCatalog,
  resolveAiAgent,
  type AgentRuntimePolicy,
  type AiBudget,
  type AiModelPolicy,
  type AiModelRef,
  type AiProvider,
  type AiRegistryEntry,
} from '@clickeen/ck-contracts/ai';
import { isRecord } from '@clickeen/ck-contracts';
import rawRuntimeMatrix from '../ai-runtime.matrix.json';
import { getEntitlementsMatrix } from './matrix';
import type { PolicyProfile } from './types';

export type AgentTierRuntimeConfig = {
  defaultModel: AiModelRef;
  modelsByProvider: Partial<Record<AiProvider, AiModelPolicy>>;
  allowModelPicker: boolean;
  budget: AiBudget;
  maxTurnsPerThread: number;
  learningCapture: AgentRuntimePolicy['learningCapture'];
};

export type AiRuntimeMatrix = {
  agents: Record<string, Record<PolicyProfile, AgentTierRuntimeConfig>>;
};

export type AiRuntimeScalarField =
  | 'allowModelPicker'
  | 'maxTokens'
  | 'timeoutMs'
  | 'maxTurnsPerThread'
  | 'rawSamplePercent'
  | 'defaultModel'
  | 'allowedModel';

export type AiRuntimeMatrixCellUpdate = {
  agentId: string;
  tier: PolicyProfile;
  field: AiRuntimeScalarField;
  value: unknown;
  provider?: AiProvider;
  model?: string;
};

export type AiModelOption = AiModelRef & {
  label: string;
};

export type AgentRuntimePolicyUi = {
  allowModelPicker: boolean;
  defaultModel: AiModelRef;
  selectedModel?: AiModelRef;
  modelOptions: AiModelOption[];
};

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[ck-policy] ${label} must be a finite number`);
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  assertFiniteNumber(value, label);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`[ck-policy] ${label} must be a positive integer`);
  }
}

function assertAiModelRef(value: unknown, label: string): asserts value is AiModelRef {
  if (!isRecord(value)) throw new Error(`[ck-policy] ${label} must be an object`);
  if (typeof value.provider !== 'string' || !value.provider.trim()) {
    throw new Error(`[ck-policy] ${label}.provider must be a string`);
  }
  if (typeof value.model !== 'string' || !value.model.trim()) {
    throw new Error(`[ck-policy] ${label}.model must be a string`);
  }
}

function assertAiModelPolicy(value: unknown, label: string): asserts value is AiModelPolicy {
  if (!isRecord(value)) throw new Error(`[ck-policy] ${label} must be an object`);
  if (typeof value.defaultModel !== 'string' || !value.defaultModel.trim()) {
    throw new Error(`[ck-policy] ${label}.defaultModel must be a string`);
  }
  if (!Array.isArray(value.allowed) || value.allowed.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`[ck-policy] ${label}.allowed must be non-empty model strings`);
  }
  if (!value.allowed.includes(value.defaultModel)) {
    throw new Error(`[ck-policy] ${label}.defaultModel must be in allowed`);
  }
}

function assertAgentTierRuntimeConfig(value: unknown, label: string): asserts value is AgentTierRuntimeConfig {
  if (!isRecord(value)) throw new Error(`[ck-policy] ${label} must be an object`);
  assertAiModelRef(value.defaultModel, `${label}.defaultModel`);
  if (!isRecord(value.modelsByProvider)) {
    throw new Error(`[ck-policy] ${label}.modelsByProvider must be an object`);
  }
  Object.entries(value.modelsByProvider).forEach(([provider, policy]) => {
    assertAiModelPolicy(policy, `${label}.modelsByProvider.${provider}`);
  });
  if (typeof value.allowModelPicker !== 'boolean') {
    throw new Error(`[ck-policy] ${label}.allowModelPicker must be a boolean`);
  }
  if (!isRecord(value.budget)) throw new Error(`[ck-policy] ${label}.budget must be an object`);
  assertPositiveInteger(value.budget.maxTokens, `${label}.budget.maxTokens`);
  assertPositiveInteger(value.budget.timeoutMs, `${label}.budget.timeoutMs`);
  assertPositiveInteger(value.maxTurnsPerThread, `${label}.maxTurnsPerThread`);
  if (!isRecord(value.learningCapture)) {
    throw new Error(`[ck-policy] ${label}.learningCapture must be an object`);
  }
  assertFiniteNumber(value.learningCapture.rawSamplePercent, `${label}.learningCapture.rawSamplePercent`);
  if (value.learningCapture.rawSamplePercent < 0 || value.learningCapture.rawSamplePercent > 100) {
    throw new Error(`[ck-policy] ${label}.learningCapture.rawSamplePercent must be between 0 and 100`);
  }
}

export function assertAiRuntimeMatrix(input: unknown = rawRuntimeMatrix): AiRuntimeMatrix {
  if (!isRecord(input)) throw new Error('[ck-policy] AI runtime matrix must be an object');
  if (!isRecord(input.agents)) throw new Error('[ck-policy] AI runtime matrix missing agents');
  const catalogKeys = new Set(listAiModelCatalog().map((model) => `${model.provider}:${model.model}`));
  for (const [agentId, byTier] of Object.entries(input.agents)) {
    if (!isRecord(byTier)) throw new Error(`[ck-policy] AI runtime matrix entry must be an object: ${agentId}`);
    const resolved = resolveAiAgent(agentId);
    if (!resolved) throw new Error(`[ck-policy] AI runtime matrix references unknown agent: ${agentId}`);
    for (const tier of getEntitlementsMatrix().tiers) {
      const config = byTier[tier];
      assertAgentTierRuntimeConfig(config, `AI runtime ${agentId}/${tier}`);
      if (!config) throw new Error(`[ck-policy] AI runtime matrix missing ${agentId}/${tier}`);
      const defaultProviderPolicy = config.modelsByProvider[config.defaultModel.provider];
      if (!defaultProviderPolicy) throw new Error(`[ck-policy] AI runtime default provider missing from modelsByProvider: ${agentId}/${tier}`);
      if (!defaultProviderPolicy.allowed.includes(config.defaultModel.model)) {
        throw new Error(`[ck-policy] AI runtime default model not allowed: ${agentId}/${tier}`);
      }
      for (const provider of Object.keys(config.modelsByProvider) as AiProvider[]) {
        if (!resolved.entry.supportedProviders.includes(provider)) {
          throw new Error(`[ck-policy] AI runtime provider not supported by agent: ${agentId}/${provider}`);
        }
        const modelPolicy = config.modelsByProvider[provider];
        for (const model of modelPolicy?.allowed ?? []) {
          if (!catalogKeys.has(`${provider}:${model}`)) {
            throw new Error(`[ck-policy] AI runtime model not in catalog: ${agentId}/${provider}/${model}`);
          }
        }
      }
    }
    for (const tier of Object.keys(byTier)) {
      if (!getEntitlementsMatrix().tiers.includes(tier as PolicyProfile)) {
        throw new Error(`[ck-policy] AI runtime matrix has unknown tier ${agentId}/${tier}`);
      }
    }
  }
  return input as AiRuntimeMatrix;
}

export const AI_RUNTIME_MATRIX = assertAiRuntimeMatrix(rawRuntimeMatrix);
const AGENT_RUNTIME_MATRIX = AI_RUNTIME_MATRIX.agents;

function cloneRuntimeMatrix(matrix: AiRuntimeMatrix): AiRuntimeMatrix {
  return JSON.parse(JSON.stringify(matrix)) as AiRuntimeMatrix;
}

function assertKnownTier(tier: unknown): asserts tier is PolicyProfile {
  if (typeof tier !== 'string' || !getEntitlementsMatrix().tiers.includes(tier as PolicyProfile)) {
    throw new Error('[ck-policy] AI runtime update tier is unknown');
  }
}

function assertKnownProvider(provider: unknown): asserts provider is AiProvider {
  const value = typeof provider === 'string' ? provider.trim() : '';
  if (!value || !['deepseek', 'openai'].includes(value)) {
    throw new Error('[ck-policy] AI runtime update provider is unknown');
  }
}

function assertModelInCatalog(provider: AiProvider, model: unknown): asserts model is string {
  const value = typeof model === 'string' ? model.trim() : '';
  if (!value) throw new Error('[ck-policy] AI runtime update model is required');
  const exists = listAiModelCatalog().some((entry) => entry.provider === provider && entry.model === value);
  if (!exists) throw new Error(`[ck-policy] AI runtime update model is not in catalog: ${provider}/${value}`);
}

function assertRuntimeNumber(value: unknown, field: string): number {
  assertFiniteNumber(value, `AI runtime update ${field}`);
  if (value < 0) throw new Error(`[ck-policy] AI runtime update ${field} must be >= 0`);
  return value;
}

function assertRuntimePositiveInteger(value: unknown, field: string): number {
  assertPositiveInteger(value, `AI runtime update ${field}`);
  return value;
}

export function applyAiRuntimeMatrixCellUpdate(input: unknown, update: AiRuntimeMatrixCellUpdate): AiRuntimeMatrix {
  const current = assertAiRuntimeMatrix(input);
  const agentId = typeof update.agentId === 'string' ? update.agentId.trim() : '';
  const resolved = resolveAiAgent(agentId);
  if (!resolved) throw new Error(`[ck-policy] AI runtime update references unknown agent: ${agentId}`);
  assertKnownTier(update.tier);

  const next = cloneRuntimeMatrix(current);
  const config = next.agents[resolved.entry.agentId]?.[update.tier];
  if (!config) throw new Error(`[ck-policy] AI runtime update missing config: ${resolved.entry.agentId}/${update.tier}`);

  switch (update.field) {
    case 'allowModelPicker':
      if (typeof update.value !== 'boolean') throw new Error('[ck-policy] allowModelPicker must be a boolean');
      config.allowModelPicker = update.value;
      break;
    case 'maxTokens':
      config.budget.maxTokens = assertRuntimePositiveInteger(update.value, 'maxTokens');
      break;
    case 'timeoutMs':
      config.budget.timeoutMs = assertRuntimePositiveInteger(update.value, 'timeoutMs');
      break;
    case 'maxTurnsPerThread':
      config.maxTurnsPerThread = assertRuntimePositiveInteger(update.value, 'maxTurnsPerThread');
      break;
    case 'rawSamplePercent': {
      const value = assertRuntimeNumber(update.value, 'rawSamplePercent');
      if (value > 100) throw new Error('[ck-policy] rawSamplePercent must be between 0 and 100');
      config.learningCapture.rawSamplePercent = value;
      break;
    }
    case 'defaultModel': {
      assertAiModelRef(update.value, 'AI runtime update defaultModel');
      const defaultModel = update.value;
      assertKnownProvider(defaultModel.provider);
      assertModelInCatalog(defaultModel.provider, defaultModel.model);
      const policy = config.modelsByProvider[defaultModel.provider];
      if (!policy || !policy.allowed.includes(defaultModel.model)) {
        throw new Error('[ck-policy] defaultModel must already be allowed');
      }
      policy.defaultModel = defaultModel.model;
      config.defaultModel = defaultModel;
      break;
    }
    case 'allowedModel': {
      assertKnownProvider(update.provider);
      assertModelInCatalog(update.provider, update.model);
      if (!resolved.entry.supportedProviders.includes(update.provider)) {
        throw new Error(`[ck-policy] AI runtime provider not supported by agent: ${resolved.entry.agentId}/${update.provider}`);
      }
      const enabled = update.value;
      if (typeof enabled !== 'boolean') throw new Error('[ck-policy] allowedModel update must be a boolean');
      const currentPolicy = config.modelsByProvider[update.provider];
      if (enabled) {
        const policy = currentPolicy ?? { defaultModel: update.model, allowed: [] };
        if (!policy.allowed.includes(update.model)) policy.allowed.push(update.model);
        if (!policy.defaultModel || !policy.allowed.includes(policy.defaultModel)) policy.defaultModel = update.model;
        config.modelsByProvider[update.provider] = policy;
      } else if (currentPolicy) {
        if (config.defaultModel.provider === update.provider && config.defaultModel.model === update.model) {
          throw new Error('[ck-policy] cannot disable the active default model');
        }
        const remaining = currentPolicy.allowed.filter((model) => model !== update.model);
        if (!remaining.length) {
          delete config.modelsByProvider[update.provider];
        } else {
          currentPolicy.allowed = remaining;
          if (!remaining.includes(currentPolicy.defaultModel)) currentPolicy.defaultModel = remaining[0]!;
        }
      }
      break;
    }
    default:
      throw new Error(`[ck-policy] Unknown AI runtime update field: ${String(update.field)}`);
  }

  return assertAiRuntimeMatrix(next);
}

function stableJson(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => typeof entry !== 'undefined')
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function policyIdFor(input: Omit<AgentRuntimePolicy, 'policyId'>): string {
  return `ai-runtime-${stableHash(stableJson(input))}`;
}

function monthlyTurnCeiling(policyProfile: PolicyProfile, entry: AiRegistryEntry): number | null {
  const key = entry.requiredEntitlements?.find((entitlement) => entitlement === 'copilot.turns.monthly.max') ?? null;
  if (!key) return null;
  const value = getEntitlementsMatrix().entitlements[key]?.values?.[policyProfile];
  return typeof value === 'number' || value === null ? value : null;
}

function parseSelectedModel(value: unknown): AiModelRef | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('[ck-policy] Selected AI model must be an object with provider and model');
  }
  const record = value as Record<string, unknown>;
  const provider = typeof record.provider === 'string' ? record.provider.trim() : '';
  const model = typeof record.model === 'string' ? record.model.trim() : '';
  if (!provider || !model) {
    throw new Error('[ck-policy] Selected AI model requires provider and model');
  }
  return { provider: provider as AiProvider, model };
}

function assertSelectedModelAllowed(args: {
  selectedModel: AiModelRef;
  allowModelPicker: boolean;
  modelsByProvider: Partial<Record<AiProvider, AiModelPolicy>>;
}): void {
  if (!args.allowModelPicker) {
    throw new Error('[ck-policy] Selected AI model is not allowed by account policy');
  }
  const policy = args.modelsByProvider[args.selectedModel.provider];
  if (!policy || !policy.allowed.includes(args.selectedModel.model)) {
    throw new Error('[ck-policy] Selected AI model is outside account policy');
  }
}

function buildRuntimePolicy(args: {
  entry: AiRegistryEntry;
  policyProfile: PolicyProfile;
  config: AgentTierRuntimeConfig;
  selectedModel?: AiModelRef;
}): AgentRuntimePolicy {
  const selectedModel = args.selectedModel;
  if (selectedModel) {
    assertSelectedModelAllowed({
      selectedModel,
      allowModelPicker: args.config.allowModelPicker,
      modelsByProvider: args.config.modelsByProvider,
    });
  }

  const base: Omit<AgentRuntimePolicy, 'policyId'> = {
    agentId: args.entry.agentId,
    policyProfile: args.policyProfile,
    enabled: true,
    defaultModel: args.config.defaultModel,
    modelsByProvider: args.config.modelsByProvider,
    allowModelPicker: args.config.allowModelPicker,
    ...(selectedModel ? { selectedModel } : {}),
    maxTokensPerCall: args.config.budget.maxTokens,
    maxTurnsPerThread: args.config.maxTurnsPerThread,
    maxMonthlyTurns: monthlyTurnCeiling(args.policyProfile, args.entry),
    timeoutMs: args.config.budget.timeoutMs,
    learningCapture: args.config.learningCapture,
  };

  return {
    ...base,
    policyId: policyIdFor(base),
  };
}

export function resolveAiRuntimePolicy(args: {
  entry: AiRegistryEntry;
  policyProfile: PolicyProfile;
  selectedModel?: unknown;
}): AgentRuntimePolicy {
  const config = AGENT_RUNTIME_MATRIX[args.entry.agentId]?.[args.policyProfile];
  if (!config) {
    throw new Error(`[ck-policy] Missing AI runtime policy for ${args.entry.agentId}/${args.policyProfile}`);
  }
  return buildRuntimePolicy({
    entry: args.entry,
    policyProfile: args.policyProfile,
    config,
    selectedModel: parseSelectedModel(args.selectedModel),
  });
}

export function resolveAiRuntimeBudget(policy: AgentRuntimePolicy): AiBudget {
  return {
    maxTokens: policy.maxTokensPerCall,
    timeoutMs: policy.timeoutMs,
  };
}

export function deriveAiRuntimePolicyUi(policy: AgentRuntimePolicy): AgentRuntimePolicyUi {
  return {
    allowModelPicker: policy.allowModelPicker,
    defaultModel: policy.defaultModel,
    ...(policy.selectedModel ? { selectedModel: policy.selectedModel } : {}),
    modelOptions: deriveAiModelOptionsForUi(policy),
  };
}

export function listAiRuntimePoliciesForTier(policyProfile: PolicyProfile): Array<{
  agentId: string;
  policy: AgentRuntimePolicy;
  ui: AgentRuntimePolicyUi;
}> {
  return Object.keys(AGENT_RUNTIME_MATRIX).map((agentId) => {
    const resolved = resolveAiAgent(agentId);
    if (!resolved) throw new Error(`[ck-policy] Missing AI agent registry entry: ${agentId}`);
    const policy = resolveAiRuntimePolicy({ entry: resolved.entry, policyProfile });
    return { agentId, policy, ui: deriveAiRuntimePolicyUi(policy) };
  });
}

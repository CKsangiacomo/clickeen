import {
  deriveAiModelOptionsForUi,
  resolveAiAgent,
  type AgentRuntimePolicy,
  type AiBudget,
  type AiModelPolicy,
  type AiModelRef,
  type AiProvider,
  type AiRegistryEntry,
} from '@clickeen/ck-contracts/ai';
import { getEntitlementsMatrix } from './matrix';
import type { PolicyProfile } from './types';

type AgentTierRuntimeConfig = {
  defaultModel: AiModelRef;
  modelsByProvider: Partial<Record<AiProvider, AiModelPolicy>>;
  allowModelPicker: boolean;
  budget: AiBudget;
  maxTurnsPerThread: number;
  learningCapture: AgentRuntimePolicy['learningCapture'];
};

type AgentRuntimeMatrix = Record<string, Record<PolicyProfile, AgentTierRuntimeConfig>>;

export type AiModelOption = AiModelRef & {
  label: string;
};

export type AgentRuntimePolicyUi = {
  allowModelPicker: boolean;
  defaultModel: AiModelRef;
  selectedModel?: AiModelRef;
  modelOptions: AiModelOption[];
};

const LOW_CAPTURE: AgentRuntimePolicy['learningCapture'] = {
  rawSamplePercent: 0,
  captureRawFailures: false,
};

const PAID_CAPTURE: AgentRuntimePolicy['learningCapture'] = {
  rawSamplePercent: 20,
  captureRawFailures: true,
};

const AGENT_RUNTIME_MATRIX: AgentRuntimeMatrix = {
  'cs.widget.copilot.v1': {
    free: {
      defaultModel: { provider: 'deepseek', model: 'deepseek-chat' },
      modelsByProvider: { deepseek: { defaultModel: 'deepseek-chat', allowed: ['deepseek-chat'] } },
      allowModelPicker: false,
      budget: { maxTokens: 650, timeoutMs: 45_000, maxRequests: 2 },
      maxTurnsPerThread: 8,
      learningCapture: LOW_CAPTURE,
    },
    tier1: {
      defaultModel: { provider: 'openai', model: 'gpt-5-mini' },
      modelsByProvider: {
        openai: { defaultModel: 'gpt-5-mini', allowed: ['gpt-5-mini'] },
      },
      allowModelPicker: false,
      budget: { maxTokens: 900, timeoutMs: 45_000, maxRequests: 3, maxCostUsd: 0.05 },
      maxTurnsPerThread: 16,
      learningCapture: PAID_CAPTURE,
    },
    tier2: {
      defaultModel: { provider: 'openai', model: 'gpt-5.2' },
      modelsByProvider: {
        openai: { defaultModel: 'gpt-5.2', allowed: ['gpt-5-mini', 'gpt-5', 'gpt-5.2'] },
        anthropic: { defaultModel: 'claude-3-5-sonnet-20240620', allowed: ['claude-3-5-sonnet-20240620'] },
        groq: { defaultModel: 'llama-3.3-70b-versatile', allowed: ['llama-3.3-70b-versatile'] },
      },
      allowModelPicker: true,
      budget: { maxTokens: 1400, timeoutMs: 60_000, maxRequests: 3, maxCostUsd: 0.12 },
      maxTurnsPerThread: 30,
      learningCapture: PAID_CAPTURE,
    },
    tier3: {
      defaultModel: { provider: 'openai', model: 'gpt-5.2' },
      modelsByProvider: {
        openai: { defaultModel: 'gpt-5.2', allowed: ['gpt-5-mini', 'gpt-5', 'gpt-5.2'] },
        anthropic: { defaultModel: 'claude-3-5-sonnet-20240620', allowed: ['claude-3-5-sonnet-20240620'] },
        groq: { defaultModel: 'llama-3.3-70b-versatile', allowed: ['llama-3.3-70b-versatile'] },
        amazon: { defaultModel: 'amazon.nova-pro-v1:0', allowed: ['amazon.nova-lite-v1:0', 'amazon.nova-pro-v1:0'] },
      },
      allowModelPicker: true,
      budget: { maxTokens: 1600, timeoutMs: 60_000, maxRequests: 3, maxCostUsd: 0.2 },
      maxTurnsPerThread: 50,
      learningCapture: PAID_CAPTURE,
    },
  },
  'widget.instance.translator': {
    free: {
      defaultModel: { provider: 'deepseek', model: 'deepseek-chat' },
      modelsByProvider: { deepseek: { defaultModel: 'deepseek-chat', allowed: ['deepseek-chat'] } },
      allowModelPicker: false,
      budget: { maxTokens: 900, timeoutMs: 20_000, maxRequests: 1, maxCostUsd: 0.03 },
      maxTurnsPerThread: 1,
      learningCapture: LOW_CAPTURE,
    },
    tier1: {
      defaultModel: { provider: 'deepseek', model: 'deepseek-chat' },
      modelsByProvider: { deepseek: { defaultModel: 'deepseek-chat', allowed: ['deepseek-chat'] } },
      allowModelPicker: false,
      budget: { maxTokens: 1200, timeoutMs: 30_000, maxRequests: 1, maxCostUsd: 0.05 },
      maxTurnsPerThread: 1,
      learningCapture: LOW_CAPTURE,
    },
    tier2: {
      defaultModel: { provider: 'openai', model: 'gpt-5-mini' },
      modelsByProvider: {
        deepseek: { defaultModel: 'deepseek-chat', allowed: ['deepseek-chat'] },
        openai: { defaultModel: 'gpt-5-mini', allowed: ['gpt-5-mini'] },
        anthropic: { defaultModel: 'claude-3-5-sonnet-20240620', allowed: ['claude-3-5-sonnet-20240620'] },
      },
      allowModelPicker: false,
      budget: { maxTokens: 1800, timeoutMs: 45_000, maxRequests: 1, maxCostUsd: 0.08 },
      maxTurnsPerThread: 1,
      learningCapture: LOW_CAPTURE,
    },
    tier3: {
      defaultModel: { provider: 'openai', model: 'gpt-5-mini' },
      modelsByProvider: {
        deepseek: { defaultModel: 'deepseek-chat', allowed: ['deepseek-chat'] },
        openai: { defaultModel: 'gpt-5-mini', allowed: ['gpt-5-mini'] },
        anthropic: { defaultModel: 'claude-3-5-sonnet-20240620', allowed: ['claude-3-5-sonnet-20240620'] },
      },
      allowModelPicker: false,
      budget: { maxTokens: 2200, timeoutMs: 60_000, maxRequests: 1, maxCostUsd: 0.12 },
      maxTurnsPerThread: 1,
      learningCapture: LOW_CAPTURE,
    },
  },
  'website.prague.copy.translator': {
    free: {
      defaultModel: { provider: 'openai', model: 'gpt-5.2' },
      modelsByProvider: { openai: { defaultModel: 'gpt-5.2', allowed: ['gpt-5-mini', 'gpt-5', 'gpt-5.2'] } },
      allowModelPicker: false,
      budget: { maxTokens: 2200, timeoutMs: 60_000, maxRequests: 1, maxCostUsd: 0.15 },
      maxTurnsPerThread: 1,
      learningCapture: LOW_CAPTURE,
    },
    tier1: {
      defaultModel: { provider: 'openai', model: 'gpt-5.2' },
      modelsByProvider: { openai: { defaultModel: 'gpt-5.2', allowed: ['gpt-5-mini', 'gpt-5', 'gpt-5.2'] } },
      allowModelPicker: false,
      budget: { maxTokens: 2200, timeoutMs: 60_000, maxRequests: 1, maxCostUsd: 0.15 },
      maxTurnsPerThread: 1,
      learningCapture: LOW_CAPTURE,
    },
    tier2: {
      defaultModel: { provider: 'openai', model: 'gpt-5.2' },
      modelsByProvider: { openai: { defaultModel: 'gpt-5.2', allowed: ['gpt-5-mini', 'gpt-5', 'gpt-5.2'] } },
      allowModelPicker: false,
      budget: { maxTokens: 2200, timeoutMs: 60_000, maxRequests: 1, maxCostUsd: 0.15 },
      maxTurnsPerThread: 1,
      learningCapture: LOW_CAPTURE,
    },
    tier3: {
      defaultModel: { provider: 'openai', model: 'gpt-5.2' },
      modelsByProvider: { openai: { defaultModel: 'gpt-5.2', allowed: ['gpt-5-mini', 'gpt-5', 'gpt-5.2'] } },
      allowModelPicker: false,
      budget: { maxTokens: 2200, timeoutMs: 60_000, maxRequests: 1, maxCostUsd: 0.15 },
      maxTurnsPerThread: 1,
      learningCapture: LOW_CAPTURE,
    },
  },
};

function assertAiRuntimeMatrix(): void {
  for (const [agentId, byTier] of Object.entries(AGENT_RUNTIME_MATRIX)) {
    const resolved = resolveAiAgent(agentId);
    if (!resolved) throw new Error(`[ck-policy] AI runtime matrix references unknown agent: ${agentId}`);
    for (const tier of getEntitlementsMatrix().tiers) {
      const config = byTier[tier];
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
      }
    }
  }
}

assertAiRuntimeMatrix();

function stableJson(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => typeof entry !== 'undefined')
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
}

function fnv1aHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function policyVersionFor(input: Omit<AgentRuntimePolicy, 'policyVersion'>): string {
  return `ai-runtime-v1-${fnv1aHash(stableJson(input))}`;
}

function monthlyTurnCeiling(policyProfile: PolicyProfile, entry: AiRegistryEntry): number | null {
  const key = entry.requiredEntitlements?.find((entitlement) => entitlement === 'budget.copilot.turns') ?? null;
  if (!key) return null;
  const value = getEntitlementsMatrix().capabilities[key]?.values?.[policyProfile];
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

  const base: Omit<AgentRuntimePolicy, 'policyVersion'> = {
    agentId: args.entry.agentId,
    enabled: true,
    defaultModel: args.config.defaultModel,
    modelsByProvider: args.config.modelsByProvider,
    allowModelPicker: args.config.allowModelPicker,
    ...(selectedModel ? { selectedModel } : {}),
    maxTokensPerCall: args.config.budget.maxTokens,
    maxRequestsPerGrant: Math.max(1, args.config.budget.maxRequests ?? 1),
    maxTurnsPerThread: args.config.maxTurnsPerThread,
    maxMonthlyTurns: monthlyTurnCeiling(args.policyProfile, args.entry),
    ...(typeof args.config.budget.maxCostUsd === 'number' ? { maxCostUsd: args.config.budget.maxCostUsd } : {}),
    timeoutMs: args.config.budget.timeoutMs,
    learningCapture: args.config.learningCapture,
  };

  return {
    ...base,
    policyVersion: policyVersionFor(base),
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
    maxRequests: policy.maxRequestsPerGrant,
    ...(typeof policy.maxCostUsd === 'number' ? { maxCostUsd: policy.maxCostUsd } : {}),
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

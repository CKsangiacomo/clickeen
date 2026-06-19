export type AiProvider = 'deepseek' | 'openai';
export type AiPolicyProfile = 'free' | 'tier1' | 'tier2' | 'tier3' | 'tier4';
export type AiExecutionSurface = 'execute' | 'endpoint';
export type AiAgentCategory = 'copilot' | 'system_agent';
export type AiRegistryBoundary =
  | 'editor_ops_only'
  | 'account_widget_translated_values';

export type AiBudget = {
  maxTokens: number;
  timeoutMs: number;
};

export type AiModelRef = {
  provider: AiProvider;
  model: string;
};

export type AiModelPolicy = {
  defaultModel: string;
  allowed: string[];
};

export type AiLearningCapturePolicy = {
  rawSamplePercent: number;
};

export type AgentRuntimePolicy = {
  agentId: string;
  policyProfile: AiPolicyProfile;
  enabled: boolean;
  defaultModel: AiModelRef;
  modelsByProvider: Partial<Record<AiProvider, AiModelPolicy>>;
  allowModelPicker: boolean;
  selectedModel?: AiModelRef;
  maxTokensPerCall: number;
  maxTurnsPerThread: number;
  maxMonthlyTurns: number | null;
  timeoutMs: number;
  learningCapture: AiLearningCapturePolicy;
  policyVersion: string;
};

export type AiGrantPolicy = AgentRuntimePolicy;

type AiRegistryBase = {
  agentId: string;
  category: AiAgentCategory;
  taskClass: string;
  description: string;
  owner: string;
  boundary: AiRegistryBoundary;
  supportedProviders: AiProvider[];
  defaultProvider: AiProvider;
  executionSurface: AiExecutionSurface;
  requiredEntitlements?: string[];
  aliases?: string[];
};

export type AiCopilotRegistryEntry = AiRegistryBase & {
  category: 'copilot';
  surface: string;
  boundary: 'editor_ops_only';
};

export type AiSystemAgentRegistryEntry = AiRegistryBase & {
  category: 'system_agent';
  boundary: Exclude<AiRegistryBoundary, 'editor_ops_only'>;
};

export type AiRegistryEntry = AiCopilotRegistryEntry | AiSystemAgentRegistryEntry;

export type AiProviderUiMeta = {
  provider: AiProvider;
  label: string;
};

export type AiModelCatalogEntry = {
  provider: AiProvider;
  model: string;
  label: string;
  contextWindowTokens?: number;
  notes?: string;
};

export type AiModelTokenParam = 'max_tokens' | 'max_completion_tokens';

export type AiModelCapability = AiModelCatalogEntry & {
  tokenParam: AiModelTokenParam;
  supportsTemperature: boolean;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  pickerEligibility: {
    eligible: boolean;
    proofRef?: string;
    checkedAt?: string;
  };
};

export type AiModelUiMeta = {
  provider: AiProvider;
  model: string;
  label: string;
};

export type BuilderCopilotTurnClass = 'resolved_edit' | 'multi_op_plan';

export type BuilderCopilotSnapshotControl = {
  path: string;
  panelId?: string;
  groupId?: string;
  groupLabel?: string;
  type: string;
  kind: string;
  label: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
  enumValues?: string[];
  min?: number;
  max?: number;
  itemIdPath?: string;
  currentValue: unknown;
  aliases: string[];
  ambiguityGroup?: string;
  choiceLabel?: string;
};

export type BuilderCopilotSnapshot = {
  widgetType: string;
  displayName: string;
  controls: BuilderCopilotSnapshotControl[];
};

export type BuilderCopilotResolvedTarget = {
  path: string;
  valueType: string;
  currentValue: unknown;
};

export type BuilderCopilotRequestEnvelope = {
  instanceId: string;
  widgetType: string;
  activeLocale: string;
  snapshotHash: string;
  turnClass: BuilderCopilotTurnClass;
  resolvedTarget?: BuilderCopilotResolvedTarget;
  snapshot: BuilderCopilotSnapshot;
  userMessage: string;
  sessionId: string;
};

const AI_AGENT_REGISTRY: AiRegistryEntry[] = [
  {
    agentId: 'cs.widget.copilot.v1',
    category: 'copilot',
    taskClass: 'copilot.widget.editor',
    description: 'Builder Copilot.',
    owner: 'roma.builder',
    surface: 'roma.builder',
    boundary: 'editor_ops_only',
    supportedProviders: ['deepseek', 'openai'],
    defaultProvider: 'openai',
    executionSurface: 'execute',
    requiredEntitlements: ['copilot.turns.monthly.max'],
  },
  {
    agentId: 'widget.instance.translator',
    category: 'system_agent',
    taskClass: 'l10n.instance',
    description: 'Widget Instance Translator.',
    owner: 'sanfrancisco.instance-translation',
    boundary: 'account_widget_translated_values',
    supportedProviders: ['deepseek', 'openai'],
    defaultProvider: 'deepseek',
    executionSurface: 'endpoint',
  },
];

const PROVIDER_LABELS: Record<AiProvider, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
};

const AI_MODEL_CAPABILITIES: AiModelCapability[] = [
  {
    provider: 'deepseek',
    model: 'deepseek-chat',
    label: 'DeepSeek Chat',
    tokenParam: 'max_tokens',
    supportsTemperature: true,
    pickerEligibility: {
      eligible: true,
      proofRef: 'documentation/ai/model-conformance/2026-06-18-copilot-picker.md',
      checkedAt: '2026-06-18T21:42:52Z',
    },
  },
  {
    provider: 'openai',
    model: 'gpt-5-mini',
    label: 'GPT 5 Mini',
    tokenParam: 'max_completion_tokens',
    supportsTemperature: false,
    pickerEligibility: {
      eligible: true,
      proofRef: 'documentation/ai/model-conformance/2026-06-18-copilot-picker.md',
      checkedAt: '2026-06-18T21:42:52Z',
    },
  },
  {
    provider: 'openai',
    model: 'gpt-5',
    label: 'GPT 5 High',
    tokenParam: 'max_completion_tokens',
    supportsTemperature: false,
    pickerEligibility: {
      eligible: true,
      proofRef: 'documentation/ai/model-conformance/2026-06-18-copilot-picker.md',
      checkedAt: '2026-06-18T21:42:52Z',
    },
  },
  {
    provider: 'openai',
    model: 'gpt-5.2',
    label: 'GPT 5.2 High',
    tokenParam: 'max_completion_tokens',
    supportsTemperature: false,
    pickerEligibility: {
      eligible: true,
      proofRef: 'documentation/ai/model-conformance/2026-06-18-copilot-picker.md',
      checkedAt: '2026-06-18T21:42:52Z',
    },
  },
];
const AGENT_LOOKUP = new Map<string, AiRegistryEntry>();
const MODEL_LABELS = new Map<string, string>();

for (const model of AI_MODEL_CAPABILITIES) {
  const key = `${model.provider}:${model.model}`;
  if (MODEL_LABELS.has(key)) {
    throw new Error(`[ck-contracts] Duplicate AI model capability entry: ${key}`);
  }
  MODEL_LABELS.set(key, model.label);
}

for (const entry of AI_AGENT_REGISTRY) {
  if (!entry.agentId.trim()) {
    throw new Error('[ck-contracts] AI registry entry missing agentId');
  }
  if (!entry.supportedProviders.length) {
    throw new Error(`[ck-contracts] AI registry entry missing supported providers: ${entry.agentId}`);
  }
  if (!entry.supportedProviders.includes(entry.defaultProvider)) {
    throw new Error(`[ck-contracts] AI registry entry defaultProvider not supported: ${entry.agentId}`);
  }
  if (AGENT_LOOKUP.has(entry.agentId)) {
    throw new Error(`[ck-contracts] Duplicate AI registry agentId: ${entry.agentId}`);
  }
  AGENT_LOOKUP.set(entry.agentId, entry);
  for (const alias of entry.aliases ?? []) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    if (AGENT_LOOKUP.has(trimmed)) {
      throw new Error(`[ck-contracts] Duplicate AI registry alias: ${trimmed}`);
    }
    AGENT_LOOKUP.set(trimmed, entry);
  }
}

export function listAiAgents(): AiRegistryEntry[] {
  return AI_AGENT_REGISTRY.slice();
}

export function resolveAiAgent(agentId: unknown): { entry: AiRegistryEntry; canonicalId: string; requestedId: string } | null {
  const requested = typeof agentId === 'string' ? agentId.trim() : '';
  if (!requested) return null;
  const entry = AGENT_LOOKUP.get(requested);
  if (!entry) return null;
  return { entry, canonicalId: entry.agentId, requestedId: requested };
}

export function listAiProviderUi(): AiProviderUiMeta[] {
  return (Object.keys(PROVIDER_LABELS) as AiProvider[]).map((provider) => ({
    provider,
    label: PROVIDER_LABELS[provider],
  }));
}

export function listAiModelCatalog(): AiModelCatalogEntry[] {
  return AI_MODEL_CAPABILITIES.map(({ provider, model, label, contextWindowTokens, notes }) => ({
    provider,
    model,
    label,
    ...(contextWindowTokens ? { contextWindowTokens } : {}),
    ...(notes ? { notes } : {}),
  }));
}

export function listAiModelCapabilities(): AiModelCapability[] {
  return AI_MODEL_CAPABILITIES.map((entry) => ({ ...entry }));
}

export function resolveAiModelCapability(provider: unknown, model: unknown): AiModelCapability | null {
  const providerId = typeof provider === 'string' ? provider.trim() : '';
  const modelId = typeof model === 'string' ? model.trim() : '';
  if (!providerId || !modelId) return null;
  const entry = AI_MODEL_CAPABILITIES.find((candidate) => candidate.provider === providerId && candidate.model === modelId);
  return entry ? { ...entry } : null;
}

export function labelAiProvider(provider: unknown): string {
  const key = typeof provider === 'string' ? provider.trim() : '';
  return (PROVIDER_LABELS as Record<string, string>)[key] ?? key;
}

export function labelAiModel(model: unknown, provider?: unknown): string {
  const modelId = typeof model === 'string' ? model.trim() : '';
  if (!modelId) return '';
  const providerId = typeof provider === 'string' ? provider.trim() : '';
  if (providerId) {
    const label = MODEL_LABELS.get(`${providerId}:${modelId}`);
    if (label) return label;
  }
  const capability = AI_MODEL_CAPABILITIES.find((entry) => entry.model === modelId);
  return capability?.label ?? modelId;
}

export function listAiModelsForUi(args: {
  modelsByProvider: Partial<Record<AiProvider, AiModelPolicy>>;
}): Partial<Record<AiProvider, { defaultModel: string; models: Array<{ model: string; label: string }> }>> {
  const out: Partial<Record<AiProvider, { defaultModel: string; models: Array<{ model: string; label: string }> }>> = {};
  for (const [provider, policy] of Object.entries(args.modelsByProvider) as Array<[AiProvider, AiModelPolicy | undefined]>) {
    if (!policy) continue;
    out[provider] = {
      defaultModel: policy.defaultModel,
      models: policy.allowed.map((model) => ({ model, label: labelAiModel(model, provider) })),
    };
  }
  return out;
}

export function deriveAiModelOptionsForUi(policy: Pick<AgentRuntimePolicy, 'modelsByProvider'>): AiModelUiMeta[] {
  const out: AiModelUiMeta[] = [];
  for (const [provider, modelPolicy] of Object.entries(policy.modelsByProvider) as Array<[AiProvider, AiModelPolicy | undefined]>) {
    if (!modelPolicy) continue;
    modelPolicy.allowed.forEach((model) => {
      const capability = resolveAiModelCapability(provider, model);
      if (!capability?.pickerEligibility.eligible) return;
      out.push({ provider, model, label: labelAiModel(model, provider) });
    });
  }
  return out;
}

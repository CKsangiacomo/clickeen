export type AiProvider = 'deepseek' | 'openai';
export type AiPolicyProfile = 'free' | 'tier1' | 'tier2' | 'tier3';
export type AiExecutionSurface = 'execute' | 'endpoint';
export type AiAgentCategory = 'copilot' | 'system_agent';
export type AiRegistryBoundary =
  | 'editor_ops_only'
  | 'account_widget_translated_values'
  | 'prague_copy_tooling_output';

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

export type AiModelUiMeta = {
  provider: AiProvider;
  model: string;
  label: string;
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
    owner: 'tokyo-worker.account-widget-l10n',
    boundary: 'account_widget_translated_values',
    supportedProviders: ['deepseek', 'openai'],
    defaultProvider: 'deepseek',
    executionSurface: 'endpoint',
  },
  {
    agentId: 'website.prague.copy.translator',
    category: 'system_agent',
    taskClass: 'l10n.prague.systemStrings',
    description: 'Prague Copy Translator.',
    owner: 'prague.l10n',
    boundary: 'prague_copy_tooling_output',
    supportedProviders: ['openai'],
    defaultProvider: 'openai',
    executionSurface: 'endpoint',
  },
];

const PROVIDER_LABELS: Record<AiProvider, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
};

const AI_MODEL_CATALOG: AiModelCatalogEntry[] = [
  { provider: 'deepseek', model: 'deepseek-chat', label: 'DeepSeek Chat' },
  { provider: 'openai', model: 'gpt-5-mini', label: 'GPT 5 Mini' },
  { provider: 'openai', model: 'gpt-5', label: 'GPT 5 High' },
  { provider: 'openai', model: 'gpt-5.2', label: 'GPT 5.2 High' },
];

const AGENT_LOOKUP = new Map<string, AiRegistryEntry>();
const MODEL_LABELS = new Map<string, string>();

for (const model of AI_MODEL_CATALOG) {
  const key = `${model.provider}:${model.model}`;
  if (MODEL_LABELS.has(key)) {
    throw new Error(`[ck-contracts] Duplicate AI model catalog entry: ${key}`);
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
  return AI_MODEL_CATALOG.slice();
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
  const catalogEntry = AI_MODEL_CATALOG.find((entry) => entry.model === modelId);
  return catalogEntry?.label ?? modelId;
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
      out.push({ provider, model, label: labelAiModel(model, provider) });
    });
  }
  return out;
}

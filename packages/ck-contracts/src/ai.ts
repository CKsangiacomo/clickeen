export type AiProvider = 'deepseek' | 'openai' | 'anthropic' | 'groq' | 'amazon';
export type AiPolicyProfile = 'free' | 'tier1' | 'tier2' | 'tier3';
export type AiExecutionSurface = 'execute' | 'endpoint';
export type AiAgentCategory = 'copilot' | 'job';
export type AiRegistryBoundary =
  | 'editor_ops_only'
  | 'account_widget_translation_overlay'
  | 'prague_copy_tooling_output';

export type AiBudget = {
  maxTokens: number;
  timeoutMs: number;
  maxRequests?: number;
  maxCostUsd?: number;
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
  captureRawFailures: boolean;
};

export type AgentRuntimePolicy = {
  agentId: string;
  enabled: boolean;
  defaultModel: AiModelRef;
  modelsByProvider: Partial<Record<AiProvider, AiModelPolicy>>;
  allowModelPicker: boolean;
  selectedModel?: AiModelRef;
  maxTokensPerCall: number;
  maxRequestsPerGrant: number;
  maxTurnsPerThread: number;
  maxMonthlyTurns: number | null;
  maxCostUsd?: number;
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

export type AiJobRegistryEntry = AiRegistryBase & {
  category: 'job';
  jobType: string;
  boundary: Exclude<AiRegistryBoundary, 'editor_ops_only'>;
};

export type AiRegistryEntry = AiCopilotRegistryEntry | AiJobRegistryEntry;

export type AiProviderUiMeta = {
  provider: AiProvider;
  label: string;
};

export type AiModelCatalogEntry = {
  provider: AiProvider;
  model: string;
  label: string;
  status: 'active' | 'deprecated' | 'hidden';
  costClass: 'low' | 'standard' | 'premium';
  promptUsdPer1M: number;
  completionUsdPer1M: number;
  contextWindowTokens?: number;
  supportsStructuredOutput: boolean;
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
    description: 'CS widget copilot.',
    owner: 'roma.builder',
    surface: 'roma.builder',
    boundary: 'editor_ops_only',
    supportedProviders: ['deepseek', 'openai', 'anthropic', 'groq', 'amazon'],
    defaultProvider: 'openai',
    executionSurface: 'execute',
    requiredEntitlements: ['budget.copilot.turns'],
  },
  {
    agentId: 'widget.instance.translator',
    category: 'job',
    taskClass: 'l10n.instance',
    description: 'Instance localization pipeline.',
    owner: 'tokyo-worker.account-widget-l10n',
    jobType: 'widget.instance.translation',
    boundary: 'account_widget_translation_overlay',
    supportedProviders: ['deepseek', 'openai', 'anthropic'],
    defaultProvider: 'deepseek',
    executionSurface: 'endpoint',
  },
  {
    agentId: 'website.prague.copy.translator',
    category: 'job',
    taskClass: 'l10n.prague.systemStrings',
    description: 'Prague system strings translation.',
    owner: 'prague.l10n',
    jobType: 'website.prague.copy.translation',
    boundary: 'prague_copy_tooling_output',
    supportedProviders: ['openai'],
    defaultProvider: 'openai',
    executionSurface: 'endpoint',
  },
];

const PROVIDER_LABELS: Record<AiProvider, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Claude',
  groq: 'Groq',
  amazon: 'Amazon Nova',
};

const AI_MODEL_CATALOG: AiModelCatalogEntry[] = [
  { provider: 'deepseek', model: 'deepseek-chat', label: 'DeepSeek Chat', status: 'active', costClass: 'low', promptUsdPer1M: 0.14, completionUsdPer1M: 0.28, supportsStructuredOutput: true },
  { provider: 'deepseek', model: 'deepseek-reasoner', label: 'DeepSeek Reasoner', status: 'active', costClass: 'standard', promptUsdPer1M: 0.55, completionUsdPer1M: 2.19, supportsStructuredOutput: true },
  { provider: 'openai', model: 'gpt-5-mini', label: 'GPT 5 Mini', status: 'active', costClass: 'standard', promptUsdPer1M: 0.25, completionUsdPer1M: 2, supportsStructuredOutput: true },
  { provider: 'openai', model: 'gpt-5', label: 'GPT 5 High', status: 'active', costClass: 'premium', promptUsdPer1M: 2.5, completionUsdPer1M: 10, supportsStructuredOutput: true },
  { provider: 'openai', model: 'gpt-5.2', label: 'GPT 5.2 High', status: 'active', costClass: 'premium', promptUsdPer1M: 2.5, completionUsdPer1M: 10, supportsStructuredOutput: true },
  { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT 4o Mini', status: 'deprecated', costClass: 'standard', promptUsdPer1M: 0.15, completionUsdPer1M: 0.6, supportsStructuredOutput: true },
  { provider: 'openai', model: 'gpt-4o', label: 'GPT 4o', status: 'deprecated', costClass: 'premium', promptUsdPer1M: 2.5, completionUsdPer1M: 10, supportsStructuredOutput: true },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', status: 'active', costClass: 'premium', promptUsdPer1M: 3, completionUsdPer1M: 15, supportsStructuredOutput: true },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', status: 'active', costClass: 'standard', promptUsdPer1M: 0.59, completionUsdPer1M: 0.79, supportsStructuredOutput: true },
  { provider: 'amazon', model: 'nova-2-lite-v1', label: 'Nova 2 Lite', status: 'active', costClass: 'low', promptUsdPer1M: 0.3, completionUsdPer1M: 1.2, supportsStructuredOutput: true },
  { provider: 'amazon', model: 'nova-2-pro-v1', label: 'Nova 2 Pro', status: 'active', costClass: 'standard', promptUsdPer1M: 0.8, completionUsdPer1M: 3.2, supportsStructuredOutput: true },
  { provider: 'amazon', model: 'nova-2-micro-v1', label: 'Nova 2 Micro', status: 'active', costClass: 'low', promptUsdPer1M: 0.035, completionUsdPer1M: 0.14, supportsStructuredOutput: true },
  { provider: 'amazon', model: 'amazon.nova-micro-v1:0', label: 'Nova Micro', status: 'active', costClass: 'low', promptUsdPer1M: 0.035, completionUsdPer1M: 0.14, supportsStructuredOutput: true },
  { provider: 'amazon', model: 'amazon.nova-lite-v1:0', label: 'Nova Lite', status: 'active', costClass: 'low', promptUsdPer1M: 0.3, completionUsdPer1M: 1.2, supportsStructuredOutput: true },
  { provider: 'amazon', model: 'amazon.nova-pro-v1:0', label: 'Nova Pro', status: 'active', costClass: 'standard', promptUsdPer1M: 0.8, completionUsdPer1M: 3.2, supportsStructuredOutput: true },
  { provider: 'amazon', model: 'amazon.nova-premier-v1:0', label: 'Nova Premier', status: 'hidden', costClass: 'premium', promptUsdPer1M: 2.5, completionUsdPer1M: 12.5, supportsStructuredOutput: true },
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

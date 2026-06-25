export type AiProvider = 'deepseek' | 'openai';
export type AiPolicyProfile = 'free' | 'tier1' | 'tier2' | 'tier3' | 'tier4';
export type AiExecutionSurface = 'execute' | 'endpoint';
export type AiAgentCategory = 'copilot' | 'system_agent';
export type AiRegistryBoundary =
  | 'product_copilot_draft_actions'
  | 'account_widget_translated_values';
export type AiAgentHome =
  | 'product-copilot'
  | 'translation-agent';
export type AiLoopOwner =
  | 'bob-live-draft'
  | 'agent-home'
  | 'single-pass-workflow';
export type AiRuntimeIdentity =
  | 'authenticated-product'
  | 'internal-service';

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
  policyId: string;
};

export type AiGrantPolicy = AgentRuntimePolicy;

type AiRegistryBase = {
  agentId: string;
  category: AiAgentCategory;
  taskClass: string;
  description: string;
  owner: string;
  agentHome: AiAgentHome;
  loopOwner: AiLoopOwner;
  runtimeIdentity: AiRuntimeIdentity;
  traceNamespace: string;
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
  boundary: 'product_copilot_draft_actions';
};

export type AiSystemAgentRegistryEntry = AiRegistryBase & {
  category: 'system_agent';
  boundary: Exclude<AiRegistryBoundary, 'product_copilot_draft_actions'>;
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
  supportsStructuredOutput: boolean;
  supportsToolCalls: boolean;
  supportsPromptCaching: boolean;
  contextWindowTokens: number;
  latencyClass: 'low' | 'medium' | 'high' | 'unknown';
  costClass: 'low' | 'medium' | 'high' | 'unknown';
  privacyBoundary: 'external-hosted' | 'clickeen-hosted' | 'unknown';
  taskClassEligibility: string[];
  evalStatus: 'unproven' | 'candidate' | 'approved';
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
};

export type AiModelUiMeta = {
  provider: AiProvider;
  model: string;
  label: string;
};

export type ProductCopilotControl = {
  path: string;
  panelId?: string;
  groupId?: string;
  groupLabel?: string;
  type: string;
  kind: string;
  label?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
  enumValues?: string[];
  min?: number;
  max?: number;
  itemIdPath?: string;
  currentValue: unknown;
};

export type ProductCopilotContextCapsule = {
  instanceId: string;
  widgetType: string;
  displayName: string;
  activeLocale: string;
  draftSignature: string;
  controls: ProductCopilotControl[];
  availableActions: Array<'draft_edit'>;
  unavailableCapabilities: string[];
  selectedControlPath?: string;
  traceRequestId: string;
};

export type ProductCopilotConversationMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type ProductCopilotRequestEnvelope = {
  instanceId: string;
  sessionId: string;
  userMessage: string;
  context: ProductCopilotContextCapsule;
  conversationHistory?: ProductCopilotConversationMessage[];
};

export type ProductCopilotWidgetOp =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; itemId: string }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };

export type ProductCopilotOutputKind =
  | 'answer'
  | 'clarification'
  | 'suggestion'
  | 'draft_edit'
  | 'refusal'
  | 'error';

export type ProductCopilotResponse = {
  kind: ProductCopilotOutputKind;
  message: string;
  draftEdit?: {
    ops: ProductCopilotWidgetOp[];
  };
  meta?: {
    requestId?: string;
    promptId?: string;
    opsCount?: number;
    uniquePathsTouched?: number;
    touchedPaths?: string[];
    validationRetryCount?: number;
  };
};

const AI_AGENT_REGISTRY: AiRegistryEntry[] = [
  {
    agentId: 'product.copilot',
    category: 'copilot',
    taskClass: 'copilot.widget.editor',
    description: 'Builder Copilot.',
    owner: 'roma.builder',
    agentHome: 'product-copilot',
    loopOwner: 'bob-live-draft',
    runtimeIdentity: 'authenticated-product',
    traceNamespace: 'product-copilot',
    surface: 'roma.builder',
    boundary: 'product_copilot_draft_actions',
    supportedProviders: ['deepseek', 'openai'],
    defaultProvider: 'openai',
    executionSurface: 'endpoint',
    requiredEntitlements: ['copilot.turns.monthly.max'],
  },
  {
    agentId: 'widget.instance.translator',
    category: 'system_agent',
    taskClass: 'l10n.instance',
    description: 'Widget Instance Translator.',
    owner: 'translation-agent',
    agentHome: 'translation-agent',
    loopOwner: 'single-pass-workflow',
    runtimeIdentity: 'internal-service',
    traceNamespace: 'translation-agent',
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
    model: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    contextWindowTokens: 1_000_000,
    tokenParam: 'max_tokens',
    supportsTemperature: true,
    supportsStructuredOutput: true,
    supportsToolCalls: true,
    supportsPromptCaching: true,
    latencyClass: 'medium',
    costClass: 'low',
    privacyBoundary: 'external-hosted',
    taskClassEligibility: ['copilot.widget.editor', 'l10n.instance'],
    evalStatus: 'candidate',
  },
  {
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    contextWindowTokens: 1_000_000,
    tokenParam: 'max_tokens',
    supportsTemperature: true,
    supportsStructuredOutput: true,
    supportsToolCalls: true,
    supportsPromptCaching: true,
    latencyClass: 'medium',
    costClass: 'medium',
    privacyBoundary: 'external-hosted',
    taskClassEligibility: ['copilot.widget.editor'],
    evalStatus: 'candidate',
  },
  {
    provider: 'openai',
    model: 'gpt-5.4-mini',
    label: 'GPT 5.4 Mini',
    contextWindowTokens: 400_000,
    tokenParam: 'max_completion_tokens',
    supportsTemperature: false,
    supportsStructuredOutput: true,
    supportsToolCalls: true,
    supportsPromptCaching: true,
    latencyClass: 'medium',
    costClass: 'medium',
    privacyBoundary: 'external-hosted',
    taskClassEligibility: ['copilot.widget.editor', 'l10n.instance'],
    evalStatus: 'candidate',
    reasoningEffort: 'low',
  },
  {
    provider: 'openai',
    model: 'gpt-5.4',
    label: 'GPT 5.4',
    contextWindowTokens: 1_000_000,
    tokenParam: 'max_completion_tokens',
    supportsTemperature: false,
    supportsStructuredOutput: true,
    supportsToolCalls: true,
    supportsPromptCaching: true,
    latencyClass: 'high',
    costClass: 'high',
    privacyBoundary: 'external-hosted',
    taskClassEligibility: ['copilot.widget.editor'],
    evalStatus: 'candidate',
    reasoningEffort: 'medium',
  },
  {
    provider: 'openai',
    model: 'gpt-5.5',
    label: 'GPT 5.5',
    contextWindowTokens: 1_050_000,
    tokenParam: 'max_completion_tokens',
    supportsTemperature: false,
    supportsStructuredOutput: true,
    supportsToolCalls: true,
    supportsPromptCaching: true,
    latencyClass: 'high',
    costClass: 'high',
    privacyBoundary: 'external-hosted',
    taskClassEligibility: ['copilot.widget.editor'],
    evalStatus: 'candidate',
    reasoningEffort: 'medium',
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
  if (!entry.agentHome.trim()) {
    throw new Error(`[ck-contracts] AI registry entry missing agentHome: ${entry.agentId}`);
  }
  if (!entry.loopOwner.trim()) {
    throw new Error(`[ck-contracts] AI registry entry missing loopOwner: ${entry.agentId}`);
  }
  if (!entry.runtimeIdentity.trim()) {
    throw new Error(`[ck-contracts] AI registry entry missing runtimeIdentity: ${entry.agentId}`);
  }
  if (!entry.traceNamespace.trim()) {
    throw new Error(`[ck-contracts] AI registry entry missing traceNamespace: ${entry.agentId}`);
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
      if (!resolveAiModelCapability(provider, model)) return;
      out.push({ provider, model, label: labelAiModel(model, provider) });
    });
  }
  return out;
}

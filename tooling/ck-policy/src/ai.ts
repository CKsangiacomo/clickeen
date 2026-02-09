import type { Policy, PolicyProfile } from './types';

export type AiProvider = 'deepseek' | 'openai' | 'anthropic' | 'groq' | 'amazon';
export type AiProfile = 'free_low' | 'paid_standard' | 'paid_premium' | 'curated_premium';
export type AiExecutionSurface = 'execute' | 'endpoint' | 'queue';

export type AiBudget = {
  maxTokens: number;
  timeoutMs: number;
  maxRequests?: number;
};

export type AiGrantPolicy = {
  profile: AiProfile;
  allowedProviders: AiProvider[];
  defaultProvider: AiProvider;
  models?: Partial<
    Record<
      AiProvider,
      {
        defaultModel: string;
        allowed: string[];
      }
    >
  >;
  selectedProvider?: AiProvider;
  selectedModel?: string;
  allowProviderChoice?: boolean;
  allowModelChoice?: boolean;
  tokenBudgetDay?: number;
  tokenBudgetMonth?: number;
};

export type AiRegistryEntry = {
  agentId: string;
  category: 'copilot' | 'agent';
  taskClass: string;
  description: string;
  supportedProviders: AiProvider[];
  defaultProvider: AiProvider;
  executionSurface: AiExecutionSurface;
  allowProviderChoice?: boolean;
  allowModelChoice?: boolean;
  requiredEntitlements?: string[];
  budgetsByProfile: Record<AiProfile, AiBudget>;
  toolCaps?: string[];
  aliases?: string[];
};

export type AiProviderUiMeta = {
  provider: AiProvider;
  label: string;
};

export type AiModelUiMeta = {
  model: string;
  label: string;
};

const SDR_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 280, timeoutMs: 15_000, maxRequests: 1 },
  paid_standard: { maxTokens: 600, timeoutMs: 25_000, maxRequests: 2 },
  paid_premium: { maxTokens: 900, timeoutMs: 35_000, maxRequests: 2 },
  curated_premium: { maxTokens: 1200, timeoutMs: 45_000, maxRequests: 2 },
};

const CS_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 650, timeoutMs: 45_000, maxRequests: 2 },
  paid_standard: { maxTokens: 900, timeoutMs: 45_000, maxRequests: 3 },
  paid_premium: { maxTokens: 1400, timeoutMs: 60_000, maxRequests: 3 },
  curated_premium: { maxTokens: 1600, timeoutMs: 60_000, maxRequests: 3 },
};

const DEBUG_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 200, timeoutMs: 10_000, maxRequests: 1 },
  paid_standard: { maxTokens: 200, timeoutMs: 10_000, maxRequests: 1 },
  paid_premium: { maxTokens: 200, timeoutMs: 10_000, maxRequests: 1 },
  curated_premium: { maxTokens: 200, timeoutMs: 10_000, maxRequests: 1 },
};

const L10N_INSTANCE_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 900, timeoutMs: 20_000, maxRequests: 1 },
  paid_standard: { maxTokens: 1200, timeoutMs: 30_000, maxRequests: 1 },
  paid_premium: { maxTokens: 1800, timeoutMs: 45_000, maxRequests: 1 },
  curated_premium: { maxTokens: 2200, timeoutMs: 60_000, maxRequests: 1 },
};

const L10N_PRAGUE_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 1500, timeoutMs: 60_000, maxRequests: 1 },
  paid_standard: { maxTokens: 1500, timeoutMs: 60_000, maxRequests: 1 },
  paid_premium: { maxTokens: 2000, timeoutMs: 60_000, maxRequests: 1 },
  curated_premium: { maxTokens: 2200, timeoutMs: 60_000, maxRequests: 1 },
};

const PERSONALIZATION_PREVIEW_BUDGETS: Record<AiProfile, AiBudget> = {
  // This runs inside a `waitUntil(...)` job (San Francisco). Keep budgets reasonably
  // short, but long enough to avoid spurious provider timeouts in local/cloud-dev.
  free_low: { maxTokens: 400, timeoutMs: 25_000, maxRequests: 1 },
  paid_standard: { maxTokens: 500, timeoutMs: 30_000, maxRequests: 1 },
  paid_premium: { maxTokens: 650, timeoutMs: 30_000, maxRequests: 1 },
  curated_premium: { maxTokens: 800, timeoutMs: 30_000, maxRequests: 1 },
};

const PERSONALIZATION_ONBOARDING_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 900, timeoutMs: 30_000, maxRequests: 2 },
  paid_standard: { maxTokens: 1200, timeoutMs: 45_000, maxRequests: 2 },
  paid_premium: { maxTokens: 1800, timeoutMs: 60_000, maxRequests: 3 },
  curated_premium: { maxTokens: 2200, timeoutMs: 60_000, maxRequests: 3 },
};

const AI_AGENT_REGISTRY: AiRegistryEntry[] = [
  {
    agentId: 'sdr.copilot',
    category: 'copilot',
    taskClass: 'copilot.sdr.chat',
    description: 'Public SDR copilot for acquisition conversations.',
    supportedProviders: ['deepseek'],
    defaultProvider: 'deepseek',
    executionSurface: 'execute',
    allowProviderChoice: false,
    allowModelChoice: false,
    budgetsByProfile: SDR_BUDGETS,
  },
  {
    agentId: 'sdr.widget.copilot.v1',
    category: 'copilot',
    taskClass: 'copilot.widget.editor',
    description: 'Widget editor copilot (Minibob/Bob).',
    supportedProviders: ['deepseek', 'openai', 'anthropic', 'groq', 'amazon'],
    defaultProvider: 'deepseek',
    executionSurface: 'execute',
    allowProviderChoice: true,
    allowModelChoice: true,
    requiredEntitlements: ['budget.copilot.turns'],
    budgetsByProfile: CS_BUDGETS,
  },
  {
    agentId: 'l10n.instance.v1',
    category: 'agent',
    taskClass: 'l10n.instance',
    description: 'Instance localization pipeline.',
    supportedProviders: ['deepseek', 'openai', 'anthropic'],
    defaultProvider: 'deepseek',
    executionSurface: 'queue',
    allowProviderChoice: false,
    allowModelChoice: false,
    budgetsByProfile: L10N_INSTANCE_BUDGETS,
  },
  {
    agentId: 'l10n.prague.strings.v1',
    category: 'agent',
    taskClass: 'l10n.prague.systemStrings',
    description: 'Prague system strings translation (local-only).',
    supportedProviders: ['openai'],
    defaultProvider: 'openai',
    executionSurface: 'endpoint',
    allowProviderChoice: false,
    allowModelChoice: false,
    budgetsByProfile: L10N_PRAGUE_BUDGETS,
  },
  {
    agentId: 'agent.personalization.preview.v1',
    category: 'agent',
    taskClass: 'personalization.acquisitionPreview',
    description: 'Acquisition preview personalization (copy overrides only).',
    supportedProviders: ['deepseek'],
    defaultProvider: 'deepseek',
    executionSurface: 'endpoint',
    allowProviderChoice: false,
    allowModelChoice: false,
    budgetsByProfile: PERSONALIZATION_PREVIEW_BUDGETS,
    requiredEntitlements: ['budget.personalization.runs'],
    toolCaps: ['tool:fetchHeadMeta', 'tool:fetchHomepageSnippet'],
  },
  {
    agentId: 'agent.personalization.onboarding.v1',
    category: 'agent',
    taskClass: 'personalization.onboardingProfile',
    description: 'Onboarding personalization (business profile enrichment).',
    supportedProviders: ['deepseek', 'openai', 'anthropic', 'groq', 'amazon'],
    defaultProvider: 'deepseek',
    executionSurface: 'endpoint',
    allowProviderChoice: true,
    allowModelChoice: false,
    budgetsByProfile: PERSONALIZATION_ONBOARDING_BUDGETS,
    requiredEntitlements: ['budget.personalization.runs', 'budget.personalization.website.crawls'],
    toolCaps: [
      'tool:fetchWebsite',
      'tool:fetchGBP',
      'tool:fetchFacebook',
      'tool:writeWorkspaceProfile',
    ],
  },
  {
    agentId: 'debug.grantProbe',
    category: 'agent',
    taskClass: 'ops.debug',
    description: 'Grant validation probe.',
    supportedProviders: ['deepseek'],
    defaultProvider: 'deepseek',
    executionSurface: 'execute',
    allowProviderChoice: false,
    budgetsByProfile: DEBUG_BUDGETS,
  },
];

const AGENT_LOOKUP = new Map<string, AiRegistryEntry>();
for (const entry of AI_AGENT_REGISTRY) {
  if (!entry.agentId || !entry.agentId.trim()) {
    throw new Error('[ck-policy] AI registry entry missing agentId');
  }
  if (!entry.supportedProviders.length) {
    throw new Error(`[ck-policy] AI registry entry missing supported providers: ${entry.agentId}`);
  }
  if (!entry.supportedProviders.includes(entry.defaultProvider)) {
    throw new Error(
      `[ck-policy] AI registry entry defaultProvider not supported: ${entry.agentId}`,
    );
  }
  const canonical = entry.agentId.trim();
  if (AGENT_LOOKUP.has(canonical)) {
    throw new Error(`[ck-policy] Duplicate AI registry agentId: ${canonical}`);
  }
  AGENT_LOOKUP.set(canonical, entry);
  for (const alias of entry.aliases ?? []) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    if (AGENT_LOOKUP.has(trimmed)) {
      throw new Error(`[ck-policy] Duplicate AI registry alias: ${trimmed}`);
    }
    AGENT_LOOKUP.set(trimmed, entry);
  }
}

const PROFILE_BY_POLICY: Record<PolicyProfile, AiProfile> = {
  devstudio: 'paid_premium',
  minibob: 'free_low',
  free: 'free_low',
  tier1: 'paid_standard',
  tier2: 'paid_premium',
  tier3: 'paid_premium',
};

const CURATED_TASK_CLASSES = new Set(['l10n.prague.systemStrings']);

const PROVIDER_LABELS: Record<AiProvider, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Claude',
  groq: 'Groq (Llama)',
  amazon: 'Amazon (Bedrock)',
};

const MODEL_LABELS: Record<string, string> = {
  // DeepSeek
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  // OpenAI (chat completions compatible in this repo)
  'gpt-4o-mini': 'GPT-4o mini',
  'gpt-4o': 'GPT-4o',
  // Anthropic (messages API)
  'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
  // Groq
  'llama-3.3-70b-versatile': 'Llama 3.3 70B (fast)',
  // Amazon Bedrock (model IDs)
  'amazon.nova-micro-v1:0': 'Nova Micro',
  'amazon.nova-lite-v1:0': 'Nova Lite',
  'amazon.nova-pro-v1:0': 'Nova Pro',
  'amazon.nova-premier-v1:0': 'Nova Premier',
};

type ProviderModelPolicy = { defaultModel: string; allowed: string[] };

const MODELS_BY_PROFILE: Record<AiProfile, Partial<Record<AiProvider, ProviderModelPolicy>>> = {
  free_low: {
    deepseek: { defaultModel: 'deepseek-chat', allowed: ['deepseek-chat'] },
  },
  paid_standard: {
    deepseek: { defaultModel: 'deepseek-chat', allowed: ['deepseek-chat', 'deepseek-reasoner'] },
    openai: { defaultModel: 'gpt-4o-mini', allowed: ['gpt-4o-mini'] },
    anthropic: {
      defaultModel: 'claude-3-5-sonnet-20240620',
      allowed: ['claude-3-5-sonnet-20240620'],
    },
    groq: { defaultModel: 'llama-3.3-70b-versatile', allowed: ['llama-3.3-70b-versatile'] },
    amazon: {
      defaultModel: 'amazon.nova-pro-v1:0',
      allowed: ['amazon.nova-lite-v1:0', 'amazon.nova-pro-v1:0'],
    },
  },
  paid_premium: {
    deepseek: {
      defaultModel: 'deepseek-reasoner',
      allowed: ['deepseek-chat', 'deepseek-reasoner'],
    },
    openai: { defaultModel: 'gpt-4o', allowed: ['gpt-4o-mini', 'gpt-4o'] },
    anthropic: {
      defaultModel: 'claude-3-5-sonnet-20240620',
      allowed: ['claude-3-5-sonnet-20240620'],
    },
    groq: { defaultModel: 'llama-3.3-70b-versatile', allowed: ['llama-3.3-70b-versatile'] },
    amazon: {
      defaultModel: 'amazon.nova-pro-v1:0',
      allowed: ['amazon.nova-micro-v1:0', 'amazon.nova-lite-v1:0', 'amazon.nova-pro-v1:0'],
    },
  },
  curated_premium: {
    openai: { defaultModel: 'gpt-5.2', allowed: ['gpt-5.2', 'gpt-4o', 'gpt-4o-mini'] },
  },
};

const DEFAULT_PROVIDER_BY_PROFILE: Record<AiProfile, AiProvider> = {
  free_low: 'deepseek',
  paid_standard: 'openai',
  paid_premium: 'openai',
  curated_premium: 'openai',
};

function uniqProviders(values: AiProvider[]): AiProvider[] {
  const seen = new Set<AiProvider>();
  const out: AiProvider[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function listAiAgents(): AiRegistryEntry[] {
  return AI_AGENT_REGISTRY.slice();
}

export function resolveAiAgent(
  agentId: string,
): { entry: AiRegistryEntry; canonicalId: string; requestedId: string } | null {
  const requested = typeof agentId === 'string' ? agentId.trim() : '';
  if (!requested) return null;
  const entry = AGENT_LOOKUP.get(requested);
  if (!entry) return null;
  return { entry, canonicalId: entry.agentId, requestedId: requested };
}

export function resolveAiProfile(args: {
  policyProfile: PolicyProfile;
  taskClass: string;
  isCurated?: boolean;
}): AiProfile {
  if (args.isCurated) return 'curated_premium';
  if (CURATED_TASK_CLASSES.has(args.taskClass)) return 'curated_premium';
  return PROFILE_BY_POLICY[args.policyProfile] ?? 'free_low';
}

export function resolveAiAllowedProviders(
  entry: AiRegistryEntry,
  profile: AiProfile,
): AiProvider[] {
  const allowed = Object.keys(MODELS_BY_PROFILE[profile] ?? {}) as AiProvider[];
  const filtered = entry.supportedProviders.filter((provider) => allowed.includes(provider));
  return uniqProviders(filtered);
}

export function resolveAiBudgets(entry: AiRegistryEntry, profile: AiProfile): AiBudget {
  return entry.budgetsByProfile[profile] ?? entry.budgetsByProfile.free_low;
}

export function resolveAiModels(
  profile: AiProfile,
  provider: AiProvider,
): ProviderModelPolicy | null {
  const profileConfig = MODELS_BY_PROFILE[profile] ?? null;
  if (!profileConfig) return null;
  const entry = profileConfig[provider];
  if (!entry) return null;
  const allowed = Array.isArray(entry.allowed)
    ? entry.allowed.filter((m) => typeof m === 'string' && m.trim())
    : [];
  const defaultModel = typeof entry.defaultModel === 'string' ? entry.defaultModel.trim() : '';
  if (!defaultModel || allowed.length === 0) return null;
  if (!allowed.includes(defaultModel)) return null;
  return { defaultModel, allowed };
}

export function resolveAiDefaultProvider(
  profile: AiProfile,
  allowedProviders: AiProvider[],
): AiProvider {
  const preferred = DEFAULT_PROVIDER_BY_PROFILE[profile] ?? 'deepseek';
  if (allowedProviders.includes(preferred)) return preferred;
  return allowedProviders[0] ?? 'deepseek';
}

export function listAiProviderUi(): AiProviderUiMeta[] {
  return (Object.keys(PROVIDER_LABELS) as AiProvider[]).map((provider) => ({
    provider,
    label: PROVIDER_LABELS[provider],
  }));
}

export function labelAiProvider(provider: string): string {
  const key =
    typeof provider === 'string' ? (provider.trim() as AiProvider) : ('deepseek' as AiProvider);
  return PROVIDER_LABELS[key] ?? provider;
}

export function labelAiModel(model: string): string {
  const trimmed = typeof model === 'string' ? model.trim() : '';
  if (!trimmed) return '';
  return MODEL_LABELS[trimmed] ?? trimmed;
}

export function listAiModelsForUi(args: {
  profile: AiProfile;
  allowedProviders: AiProvider[];
}): Record<AiProvider, { defaultModel: string; models: AiModelUiMeta[] }> {
  const out: Record<string, { defaultModel: string; models: AiModelUiMeta[] }> = {};
  for (const provider of args.allowedProviders) {
    const policy = resolveAiModels(args.profile, provider);
    if (!policy) continue;
    out[provider] = {
      defaultModel: policy.defaultModel,
      models: policy.allowed.map((model) => ({ model, label: labelAiModel(model) })),
    };
  }
  return out as any;
}

export function resolveAiPolicyCapsule(args: {
  entry: AiRegistryEntry;
  policyProfile: PolicyProfile;
  requestedProvider?: string;
  requestedModel?: string;
  isCurated?: boolean;
}): AiGrantPolicy {
  const profile = resolveAiProfile({
    policyProfile: args.policyProfile,
    taskClass: args.entry.taskClass,
    isCurated: args.isCurated,
  });
  const allowedProviders = resolveAiAllowedProviders(args.entry, profile);
  if (!allowedProviders.length) {
    throw new Error(`[ck-policy] No allowed providers for ${args.entry.agentId} (${profile})`);
  }
  const defaultProvider = resolveAiDefaultProvider(profile, allowedProviders);
  const models = Object.fromEntries(
    allowedProviders
      .map((provider) => {
        const policy = resolveAiModels(profile, provider);
        return policy ? [provider, policy] : null;
      })
      .filter(Boolean) as Array<[AiProvider, ProviderModelPolicy]>,
  ) as AiGrantPolicy['models'];

  const allowProviderChoice =
    Boolean(args.entry.allowProviderChoice) && allowedProviders.length > 1;
  const providerCandidate =
    typeof args.requestedProvider === 'string' ? args.requestedProvider.trim() : '';
  const selectedProvider =
    allowProviderChoice && allowedProviders.includes(providerCandidate as AiProvider)
      ? (providerCandidate as AiProvider)
      : undefined;

  const allowModelChoice = Boolean(args.entry.allowModelChoice);
  const modelCandidate = typeof args.requestedModel === 'string' ? args.requestedModel.trim() : '';
  const modelProvider = selectedProvider ?? defaultProvider;
  const selectedModel =
    allowModelChoice &&
    modelCandidate &&
    models &&
    models[modelProvider]?.allowed?.includes(modelCandidate)
      ? modelCandidate
      : undefined;

  return {
    profile,
    allowedProviders,
    defaultProvider,
    models,
    allowProviderChoice,
    allowModelChoice,
    ...(selectedProvider ? { selectedProvider } : {}),
    ...(selectedModel ? { selectedModel } : {}),
  };
}

export function isPolicyEntitled(policy: Policy, key: string): boolean {
  if (key in policy.flags) {
    return policy.flags[key] === true;
  }
  if (key in policy.caps) {
    const value = policy.caps[key];
    return value != null && Number.isFinite(value) && value > 0;
  }
  if (key in policy.budgets) {
    const max = policy.budgets[key]?.max;
    return max == null || (Number.isFinite(max) && max > 0);
  }
  return false;
}

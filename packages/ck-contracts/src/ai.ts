export type AiProvider = 'deepseek' | 'openai' | 'anthropic' | 'groq' | 'amazon';
export type AiProfile = 'free_low' | 'paid_standard' | 'paid_premium' | 'system_premium';
export type AiPolicyProfile = 'free' | 'tier1' | 'tier2' | 'tier3';
export type AiExecutionSurface = 'execute' | 'endpoint';
export type AiBudget = {
  maxTokens: number;
  timeoutMs: number;
  maxRequests?: number;
};
export type AiModelPolicy = {
  defaultModel: string;
  allowed: string[];
};
export type AiGrantPolicy = {
  profile: AiProfile;
  allowedProviders: AiProvider[];
  defaultProvider: AiProvider;
  models?: Partial<Record<AiProvider, AiModelPolicy>>;
  selectedProvider?: AiProvider;
  selectedModel?: string;
  allowProviderChoice?: boolean;
  allowModelChoice?: boolean;
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
  free_low: { maxTokens: 280, timeoutMs: 15e3, maxRequests: 1 },
  paid_standard: { maxTokens: 600, timeoutMs: 25e3, maxRequests: 2 },
  paid_premium: { maxTokens: 900, timeoutMs: 35e3, maxRequests: 2 },
  system_premium: { maxTokens: 1200, timeoutMs: 45e3, maxRequests: 2 }
};
const CS_WIDGET_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 650, timeoutMs: 45e3, maxRequests: 2 },
  paid_standard: { maxTokens: 900, timeoutMs: 45e3, maxRequests: 3 },
  paid_premium: { maxTokens: 1400, timeoutMs: 6e4, maxRequests: 3 },
  system_premium: { maxTokens: 1600, timeoutMs: 6e4, maxRequests: 3 }
};
const L10N_INSTANCE_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 900, timeoutMs: 2e4, maxRequests: 1 },
  paid_standard: { maxTokens: 1200, timeoutMs: 3e4, maxRequests: 1 },
  paid_premium: { maxTokens: 1800, timeoutMs: 45e3, maxRequests: 1 },
  system_premium: { maxTokens: 2200, timeoutMs: 6e4, maxRequests: 1 }
};
const L10N_PRAGUE_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 1500, timeoutMs: 6e4, maxRequests: 1 },
  paid_standard: { maxTokens: 1500, timeoutMs: 6e4, maxRequests: 1 },
  paid_premium: { maxTokens: 2e3, timeoutMs: 6e4, maxRequests: 1 },
  system_premium: { maxTokens: 2200, timeoutMs: 6e4, maxRequests: 1 }
};
const PERSONALIZATION_ONBOARDING_BUDGETS: Record<AiProfile, AiBudget> = {
  free_low: { maxTokens: 900, timeoutMs: 3e4, maxRequests: 2 },
  paid_standard: { maxTokens: 1200, timeoutMs: 45e3, maxRequests: 2 },
  paid_premium: { maxTokens: 1800, timeoutMs: 6e4, maxRequests: 3 },
  system_premium: { maxTokens: 2200, timeoutMs: 6e4, maxRequests: 3 }
};
const AI_AGENT_REGISTRY: AiRegistryEntry[] = [
  {
    agentId: "sdr.copilot",
    category: "copilot",
    taskClass: "copilot.sdr.chat",
    description: "Public SDR copilot for acquisition conversations.",
    supportedProviders: ["deepseek"],
    defaultProvider: "deepseek",
    executionSurface: "execute",
    allowProviderChoice: false,
    allowModelChoice: false,
    budgetsByProfile: SDR_BUDGETS
  },
  {
    agentId: "cs.widget.copilot.v1",
    category: "copilot",
    taskClass: "copilot.widget.editor",
    description: "CS widget copilot (paid tiers).",
    supportedProviders: ["deepseek", "openai", "anthropic", "groq", "amazon"],
    defaultProvider: "openai",
    executionSurface: "execute",
    allowProviderChoice: true,
    allowModelChoice: true,
    requiredEntitlements: ["budget.copilot.turns"],
    budgetsByProfile: CS_WIDGET_BUDGETS
  },
  {
    agentId: "l10n.instance.v1",
    category: "agent",
    taskClass: "l10n.instance",
    description: "Instance localization pipeline.",
    supportedProviders: ["deepseek", "openai", "anthropic"],
    defaultProvider: "deepseek",
    executionSurface: "endpoint",
    allowProviderChoice: false,
    allowModelChoice: false,
    budgetsByProfile: L10N_INSTANCE_BUDGETS
  },
  {
    agentId: "l10n.prague.strings.v1",
    category: "agent",
    taskClass: "l10n.prague.systemStrings",
    description: "Prague system strings translation (local-only).",
    supportedProviders: ["openai"],
    defaultProvider: "openai",
    executionSurface: "endpoint",
    allowProviderChoice: false,
    allowModelChoice: false,
    budgetsByProfile: L10N_PRAGUE_BUDGETS
  },
  {
    agentId: "agent.personalization.onboarding.v1",
    category: "agent",
    taskClass: "personalization.onboardingProfile",
    description: "Onboarding personalization (business profile enrichment).",
    supportedProviders: ["deepseek", "openai", "anthropic", "groq", "amazon"],
    defaultProvider: "deepseek",
    executionSurface: "endpoint",
    allowProviderChoice: true,
    allowModelChoice: false,
    budgetsByProfile: PERSONALIZATION_ONBOARDING_BUDGETS,
    requiredEntitlements: ["budget.personalization.runs", "budget.personalization.website.crawls"]
  },
];
const AGENT_LOOKUP = /* @__PURE__ */ new Map<string, AiRegistryEntry>();
for (const entry of AI_AGENT_REGISTRY) {
  if (!entry.agentId || !entry.agentId.trim()) {
    throw new Error("[ck-contracts] AI registry entry missing agentId");
  }
  if (!entry.supportedProviders.length) {
    throw new Error(`[ck-contracts] AI registry entry missing supported providers: ${entry.agentId}`);
  }
  if (!entry.supportedProviders.includes(entry.defaultProvider)) {
    throw new Error(
      `[ck-contracts] AI registry entry defaultProvider not supported: ${entry.agentId}`
    );
  }
  const canonical = entry.agentId.trim();
  if (AGENT_LOOKUP.has(canonical)) {
    throw new Error(`[ck-contracts] Duplicate AI registry agentId: ${canonical}`);
  }
  AGENT_LOOKUP.set(canonical, entry);
  for (const alias of entry.aliases ?? []) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    if (AGENT_LOOKUP.has(trimmed)) {
      throw new Error(`[ck-contracts] Duplicate AI registry alias: ${trimmed}`);
    }
    AGENT_LOOKUP.set(trimmed, entry);
  }
}
const PROFILE_BY_POLICY: Record<AiPolicyProfile, AiProfile> = {
  free: "free_low",
  tier1: "paid_standard",
  tier2: "paid_premium",
  tier3: "paid_premium"
};
const SYSTEM_TASK_CLASSES = /* @__PURE__ */ new Set<string>(["l10n.prague.systemStrings"]);
const PROVIDER_LABELS: Record<AiProvider, string> = {
  deepseek: "DeepSeek",
  openai: "OpenAI",
  anthropic: "Claude",
  groq: "Groq (Llama)",
  amazon: "Amazon Nova"
};
const MODEL_LABELS: Record<string, string> = {
  // DeepSeek
  "deepseek-chat": "DeepSeek Chat",
  "deepseek-reasoner": "DeepSeek Reasoner",
  // OpenAI (chat completions compatible in this repo)
  "gpt-5-mini": "GPT-5 mini",
  "gpt-5": "GPT-5",
  "gpt-5.2": "GPT-5.2",
  "gpt-4o-mini": "GPT-4o mini",
  "gpt-4o": "GPT-4o",
  // Anthropic (messages API)
  "claude-3-5-sonnet-20240620": "Claude 3.5 Sonnet",
  // Groq
  "llama-3.3-70b-versatile": "Llama 3.3 70B (fast)",
  // Amazon Bedrock (model IDs)
  "nova-2-lite-v1": "Nova 2 Lite",
  "nova-2-pro-v1": "Nova 2 Pro",
  "nova-2-micro-v1": "Nova 2 Micro",
  "amazon.nova-micro-v1:0": "Nova Micro",
  "amazon.nova-lite-v1:0": "Nova Lite",
  "amazon.nova-pro-v1:0": "Nova Pro",
  "amazon.nova-premier-v1:0": "Nova Premier"
};
const MODELS_BY_PROFILE: Record<AiProfile, Partial<Record<AiProvider, AiModelPolicy>>> = {
  free_low: {
    deepseek: { defaultModel: "deepseek-chat", allowed: ["deepseek-chat"] },
    amazon: { defaultModel: "nova-2-lite-v1", allowed: ["nova-2-lite-v1"] }
  },
  paid_standard: {
    deepseek: { defaultModel: "deepseek-chat", allowed: ["deepseek-chat", "deepseek-reasoner"] },
    openai: { defaultModel: "gpt-5-mini", allowed: ["gpt-5-mini", "gpt-4o-mini"] },
    anthropic: {
      defaultModel: "claude-3-5-sonnet-20240620",
      allowed: ["claude-3-5-sonnet-20240620"]
    },
    groq: { defaultModel: "llama-3.3-70b-versatile", allowed: ["llama-3.3-70b-versatile"] },
    amazon: {
      defaultModel: "amazon.nova-pro-v1:0",
      allowed: ["amazon.nova-lite-v1:0", "amazon.nova-pro-v1:0"]
    }
  },
  paid_premium: {
    deepseek: {
      defaultModel: "deepseek-reasoner",
      allowed: ["deepseek-chat", "deepseek-reasoner"]
    },
    openai: { defaultModel: "gpt-5.2", allowed: ["gpt-5-mini", "gpt-5", "gpt-5.2", "gpt-4o"] },
    anthropic: {
      defaultModel: "claude-3-5-sonnet-20240620",
      allowed: ["claude-3-5-sonnet-20240620"]
    },
    groq: { defaultModel: "llama-3.3-70b-versatile", allowed: ["llama-3.3-70b-versatile"] },
    amazon: {
      defaultModel: "amazon.nova-pro-v1:0",
      allowed: ["amazon.nova-micro-v1:0", "amazon.nova-lite-v1:0", "amazon.nova-pro-v1:0"]
    }
  },
  system_premium: {
    openai: { defaultModel: "gpt-5.2", allowed: ["gpt-5-mini", "gpt-5", "gpt-5.2", "gpt-4o"] }
  }
};
const DEFAULT_PROVIDER_BY_PROFILE: Record<AiProfile, AiProvider> = {
  free_low: "deepseek",
  paid_standard: "openai",
  paid_premium: "openai",
  system_premium: "openai"
};
function uniqProviders(values: AiProvider[]): AiProvider[] {
  const seen = /* @__PURE__ */ new Set();
  const out: AiProvider[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
function listAiAgents(): AiRegistryEntry[] {
  return AI_AGENT_REGISTRY.slice();
}
function resolveAiAgent(agentId: unknown): { entry: AiRegistryEntry; canonicalId: string; requestedId: string } | null {
  const requested = typeof agentId === "string" ? agentId.trim() : "";
  if (!requested) return null;
  const entry = AGENT_LOOKUP.get(requested);
  if (!entry) return null;
  return { entry, canonicalId: entry.agentId, requestedId: requested };
}
function resolveAiProfile(args: { policyProfile: AiPolicyProfile; taskClass: string }): AiProfile {
  if (SYSTEM_TASK_CLASSES.has(args.taskClass)) return "system_premium";
  const profile = PROFILE_BY_POLICY[args.policyProfile];
  if (!profile) {
    throw new Error(`[ck-contracts] Missing AI profile mapping for policy profile: ${args.policyProfile}`);
  }
  return profile;
}
function resolveAiAllowedProviders(entry: AiRegistryEntry, profile: AiProfile): AiProvider[] {
  const allowed = Object.keys(MODELS_BY_PROFILE[profile] ?? {}) as AiProvider[];
  const filtered = entry.supportedProviders.filter((provider) => allowed.includes(provider));
  return uniqProviders(filtered);
}
function resolveAiBudgets(entry: AiRegistryEntry, profile: AiProfile): AiBudget {
  const budget = entry.budgetsByProfile[profile];
  if (!budget) {
    throw new Error(`[ck-contracts] Missing AI budget for ${entry.agentId} (${profile})`);
  }
  return budget;
}
function resolveAiModels(profile: AiProfile, provider: AiProvider): AiModelPolicy | null {
  const profileConfig = MODELS_BY_PROFILE[profile] ?? null;
  if (!profileConfig) return null;
  const entry = profileConfig[provider];
  if (!entry) return null;
  const allowed = Array.isArray(entry.allowed) ? entry.allowed.filter((m: unknown): m is string => typeof m === "string" && Boolean(m.trim())) : [];
  const defaultModel = typeof entry.defaultModel === "string" ? entry.defaultModel.trim() : "";
  if (!defaultModel || allowed.length === 0) return null;
  if (!allowed.includes(defaultModel)) return null;
  return { defaultModel, allowed };
}
function resolveAiDefaultProvider(profile: AiProfile, allowedProviders: AiProvider[]): AiProvider {
  const preferred = DEFAULT_PROVIDER_BY_PROFILE[profile] ?? "deepseek";
  if (allowedProviders.includes(preferred)) return preferred;
  return allowedProviders[0] ?? "deepseek";
}
function listAiProviderUi(): AiProviderUiMeta[] {
  return (Object.keys(PROVIDER_LABELS) as AiProvider[]).map((provider) => ({
    provider,
    label: PROVIDER_LABELS[provider]
  }));
}
function labelAiProvider(provider: unknown): string {
  const key = typeof provider === "string" ? provider.trim() : "deepseek";
  return (PROVIDER_LABELS as Record<string, string>)[key] ?? String(provider ?? "");
}
function labelAiModel(model: unknown): string {
  const trimmed = typeof model === "string" ? model.trim() : "";
  if (!trimmed) return "";
  return MODEL_LABELS[trimmed] ?? trimmed;
}
function listAiModelsForUi(args: {
  profile: AiProfile;
  allowedProviders: AiProvider[];
}): Partial<Record<AiProvider, { defaultModel: string; models: AiModelUiMeta[] }>> {
  const out: Partial<Record<AiProvider, { defaultModel: string; models: AiModelUiMeta[] }>> = {};
  for (const provider of args.allowedProviders) {
    const policy = resolveAiModels(args.profile, provider);
    if (!policy) continue;
    out[provider] = {
      defaultModel: policy.defaultModel,
      models: policy.allowed.map((model) => ({ model, label: labelAiModel(model) }))
    };
  }
  return out;
}
function resolveAiPolicyCapsule(args: {
  entry: AiRegistryEntry;
  policyProfile: AiPolicyProfile;
  requestedProvider?: unknown;
  requestedModel?: unknown;
}): AiGrantPolicy {
  const profile = resolveAiProfile({
    policyProfile: args.policyProfile,
    taskClass: args.entry.taskClass
  });
  const allowedProviders = resolveAiAllowedProviders(args.entry, profile);
  if (!allowedProviders.length) {
    throw new Error(`[ck-contracts] No allowed providers for ${args.entry.agentId} (${profile})`);
  }
  const defaultProvider = resolveAiDefaultProvider(profile, allowedProviders);
  const modelEntries = allowedProviders.map((provider): [AiProvider, AiModelPolicy] | null => {
      const policy = resolveAiModels(profile, provider);
      return policy ? [provider, policy] : null;
    }).filter((entry): entry is [AiProvider, AiModelPolicy] => entry != null);
  const models: Partial<Record<AiProvider, AiModelPolicy>> = Object.fromEntries(modelEntries);
  const allowProviderChoice = Boolean(args.entry.allowProviderChoice) && allowedProviders.length > 1;
  const providerCandidate = typeof args.requestedProvider === "string" ? args.requestedProvider.trim() : "";
  const selectedProvider =
    allowProviderChoice && allowedProviders.includes(providerCandidate as AiProvider)
      ? (providerCandidate as AiProvider)
      : void 0;
  const allowModelChoice = Boolean(args.entry.allowModelChoice);
  const modelCandidate = typeof args.requestedModel === "string" ? args.requestedModel.trim() : "";
  const modelProvider = selectedProvider ?? defaultProvider;
  const selectedModel = allowModelChoice && modelCandidate && models && models[modelProvider]?.allowed?.includes(modelCandidate) ? modelCandidate : void 0;
  return {
    profile,
    allowedProviders,
    defaultProvider,
    models,
    allowProviderChoice,
    allowModelChoice,
    ...(selectedProvider ? { selectedProvider } : {}),
    ...(selectedModel ? { selectedModel } : {})
  };
}
export {
  labelAiModel,
  labelAiProvider,
  listAiAgents,
  listAiModelsForUi,
  listAiProviderUi,
  resolveAiAgent,
  resolveAiAllowedProviders,
  resolveAiBudgets,
  resolveAiDefaultProvider,
  resolveAiModels,
  resolveAiPolicyCapsule,
  resolveAiProfile
};

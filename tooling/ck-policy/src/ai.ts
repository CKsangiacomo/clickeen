import type { Policy, PolicyProfile } from './types';

export type AiProvider = 'deepseek' | 'openai' | 'anthropic';
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
  requiredEntitlements?: string[];
  budgetsByProfile: Record<AiProfile, AiBudget>;
  toolCaps?: string[];
  aliases?: string[];
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
  free_low: { maxTokens: 400, timeoutMs: 12_000, maxRequests: 1 },
  paid_standard: { maxTokens: 500, timeoutMs: 15_000, maxRequests: 1 },
  paid_premium: { maxTokens: 650, timeoutMs: 18_000, maxRequests: 1 },
  curated_premium: { maxTokens: 800, timeoutMs: 20_000, maxRequests: 1 },
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
    budgetsByProfile: SDR_BUDGETS,
  },
  {
    agentId: 'sdr.widget.copilot.v1',
    category: 'copilot',
    taskClass: 'copilot.widget.editor',
    description: 'Widget editor copilot (Minibob/Bob).',
    supportedProviders: ['deepseek', 'openai', 'anthropic'],
    defaultProvider: 'deepseek',
    executionSurface: 'execute',
    allowProviderChoice: true,
    requiredEntitlements: ['budget.copilot.turns'],
    budgetsByProfile: CS_BUDGETS,
  },
  {
    agentId: 'l10n.instance.v1',
    category: 'agent',
    taskClass: 'l10n.instance',
    description: 'Instance localization pipeline.',
    supportedProviders: ['deepseek'],
    defaultProvider: 'deepseek',
    executionSurface: 'queue',
    allowProviderChoice: false,
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
    budgetsByProfile: PERSONALIZATION_PREVIEW_BUDGETS,
    requiredEntitlements: ['budget.personalization.runs'],
    toolCaps: ['tool:fetchHeadMeta', 'tool:fetchHomepageSnippet'],
  },
  {
    agentId: 'agent.personalization.onboarding.v1',
    category: 'agent',
    taskClass: 'personalization.onboardingProfile',
    description: 'Onboarding personalization (business profile enrichment).',
    supportedProviders: ['deepseek', 'openai', 'anthropic'],
    defaultProvider: 'deepseek',
    executionSurface: 'endpoint',
    allowProviderChoice: true,
    budgetsByProfile: PERSONALIZATION_ONBOARDING_BUDGETS,
    requiredEntitlements: ['budget.personalization.runs', 'budget.personalization.website.crawls'],
    toolCaps: ['tool:fetchWebsite', 'tool:fetchGBP', 'tool:fetchFacebook', 'tool:writeWorkspaceProfile'],
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
    throw new Error(`[ck-policy] AI registry entry defaultProvider not supported: ${entry.agentId}`);
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

const ALLOWED_PROVIDERS_BY_PROFILE: Record<AiProfile, AiProvider[]> = {
  free_low: ['deepseek'],
  paid_standard: ['deepseek', 'openai', 'anthropic'],
  paid_premium: ['deepseek', 'openai', 'anthropic'],
  curated_premium: ['openai'],
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

export function resolveAiAgent(agentId: string): { entry: AiRegistryEntry; canonicalId: string; requestedId: string } | null {
  const requested = typeof agentId === 'string' ? agentId.trim() : '';
  if (!requested) return null;
  const entry = AGENT_LOOKUP.get(requested);
  if (!entry) return null;
  return { entry, canonicalId: entry.agentId, requestedId: requested };
}

export function resolveAiProfile(args: { policyProfile: PolicyProfile; taskClass: string; isCurated?: boolean }): AiProfile {
  if (args.isCurated) return 'curated_premium';
  if (CURATED_TASK_CLASSES.has(args.taskClass)) return 'curated_premium';
  return PROFILE_BY_POLICY[args.policyProfile] ?? 'free_low';
}

export function resolveAiAllowedProviders(entry: AiRegistryEntry, profile: AiProfile): AiProvider[] {
  const allowed = ALLOWED_PROVIDERS_BY_PROFILE[profile] ?? ALLOWED_PROVIDERS_BY_PROFILE.free_low;
  const filtered = entry.supportedProviders.filter((provider) => allowed.includes(provider));
  return uniqProviders(filtered);
}

export function resolveAiBudgets(entry: AiRegistryEntry, profile: AiProfile): AiBudget {
  return entry.budgetsByProfile[profile] ?? entry.budgetsByProfile.free_low;
}

export function resolveAiPolicyCapsule(args: {
  entry: AiRegistryEntry;
  policyProfile: PolicyProfile;
  requestedProvider?: string;
  requestedModel?: string;
  isCurated?: boolean;
}): AiGrantPolicy {
  const profile = resolveAiProfile({ policyProfile: args.policyProfile, taskClass: args.entry.taskClass, isCurated: args.isCurated });
  const allowedProviders = resolveAiAllowedProviders(args.entry, profile);
  if (!allowedProviders.length) {
    throw new Error(`[ck-policy] No allowed providers for ${args.entry.agentId} (${profile})`);
  }
  const allowProviderChoice = Boolean(args.entry.allowProviderChoice) && allowedProviders.length > 1;
  const providerCandidate = typeof args.requestedProvider === 'string' ? args.requestedProvider.trim() : '';
  const selectedProvider = allowProviderChoice && allowedProviders.includes(providerCandidate as AiProvider)
    ? (providerCandidate as AiProvider)
    : undefined;
  const modelCandidate = typeof args.requestedModel === 'string' ? args.requestedModel.trim() : '';
  const selectedModel = selectedProvider && modelCandidate ? modelCandidate : undefined;
  return {
    profile,
    allowedProviders,
    allowProviderChoice,
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

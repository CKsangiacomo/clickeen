export type AiProvider = 'deepseek' | 'openai' | 'anthropic' | 'groq' | 'amazon';
export type AiProfile = 'free_low' | 'paid_standard' | 'paid_premium' | 'curated_premium';
export type AiPolicyProfile = 'free' | 'tier1' | 'tier2' | 'tier3';
export type AiExecutionSurface = 'execute' | 'endpoint';

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

export declare const WIDGET_COPILOT_AGENT_ALIAS: 'widget.copilot.v1';
export declare const WIDGET_COPILOT_AGENT_IDS: Readonly<{
  sdr: 'sdr.widget.copilot.v1';
  cs: 'cs.widget.copilot.v1';
}>;
export type WidgetCopilotAgentId = (typeof WIDGET_COPILOT_AGENT_IDS)[keyof typeof WIDGET_COPILOT_AGENT_IDS];

export declare function listAiAgents(): AiRegistryEntry[];
export declare function resolveAiAgent(agentId: string): {
  entry: AiRegistryEntry;
  canonicalId: string;
  requestedId: string;
} | null;
export declare function isWidgetCopilotAgentId(agentId: string): agentId is WidgetCopilotAgentId;
export declare function resolveWidgetCopilotAgentId(args: {
  policyProfile: AiPolicyProfile;
}): WidgetCopilotAgentId;
export declare function resolveWidgetCopilotRequestedAgentId(args: {
  requestedAgentId?: string;
  policyProfile: AiPolicyProfile;
}): string;
export declare function resolveAiProfile(args: {
  policyProfile: AiPolicyProfile;
  taskClass: string;
  isCurated?: boolean;
}): AiProfile;
export declare function resolveAiAllowedProviders(
  entry: AiRegistryEntry,
  profile: AiProfile,
): AiProvider[];
export declare function resolveAiBudgets(entry: AiRegistryEntry, profile: AiProfile): AiBudget;
export declare function resolveAiModels(
  profile: AiProfile,
  provider: AiProvider,
): { defaultModel: string; allowed: string[] } | null;
export declare function resolveAiDefaultProvider(
  profile: AiProfile,
  allowedProviders: AiProvider[],
): AiProvider;
export declare function listAiProviderUi(): AiProviderUiMeta[];
export declare function labelAiProvider(provider: string): string;
export declare function labelAiModel(model: string): string;
export declare function listAiModelsForUi(args: {
  profile: AiProfile;
  allowedProviders: AiProvider[];
}): Record<AiProvider, { defaultModel: string; models: AiModelUiMeta[] }>;
export declare function resolveAiPolicyCapsule(args: {
  entry: AiRegistryEntry;
  policyProfile: AiPolicyProfile;
  requestedProvider?: string;
  requestedModel?: string;
  isCurated?: boolean;
}): AiGrantPolicy;

import {
  resolveAiAgent,
  resolveAiModelCapability,
  type AiModelRef,
  type AiPolicyProfile,
} from './ai';

export type ProductCopilotManagedModelConfig = {
  defaultModel: AiModelRef;
  enabledModels: AiModelRef[];
  userPicker: 'all-enabled-models';
};

export type SdrCopilotManagedModelConfig = {
  enabledModels: AiModelRef[];
  publicPicker: 'none';
  defaultModel?: AiModelRef;
};

export type InternalAgentModelRoute = {
  policyProfile: AiPolicyProfile | 'default';
  model: AiModelRef;
  reason: string;
};

export type InternalAgentManagedModelConfig = {
  routes: InternalAgentModelRoute[];
};

export type AiModelManagementConfig = {
  v: 1;
  productCopilot: ProductCopilotManagedModelConfig;
  sdrCopilot: SdrCopilotManagedModelConfig;
  internalAgents: Record<string, InternalAgentManagedModelConfig>;
};

export type AiModelManagementValidationIssue = {
  path: string;
  message: string;
};

export type AiModelManagementValidationResult =
  | { ok: true; config: AiModelManagementConfig }
  | { ok: false; issues: AiModelManagementValidationIssue[] };

const AI_POLICY_PROFILES: readonly AiPolicyProfile[] = ['free', 'tier1', 'tier2', 'tier3', 'tier4'];

export const AI_MODEL_MANAGEMENT_CONFIG: AiModelManagementConfig = {
  v: 1,
  productCopilot: {
    defaultModel: { provider: 'openai', model: 'gpt-5-mini' },
    enabledModels: [
      { provider: 'deepseek', model: 'deepseek-chat' },
      { provider: 'openai', model: 'gpt-5-mini' },
      { provider: 'openai', model: 'gpt-5' },
      { provider: 'openai', model: 'gpt-5.2' },
    ],
    userPicker: 'all-enabled-models',
  },
  sdrCopilot: {
    enabledModels: [],
    publicPicker: 'none',
  },
  internalAgents: {
    'widget.instance.translator': {
      routes: [
        {
          policyProfile: 'free',
          model: { provider: 'deepseek', model: 'deepseek-chat' },
          reason: 'low-cost translation route for free accounts',
        },
        {
          policyProfile: 'tier1',
          model: { provider: 'deepseek', model: 'deepseek-chat' },
          reason: 'low-cost translation route for tier1 accounts',
        },
        {
          policyProfile: 'tier2',
          model: { provider: 'openai', model: 'gpt-5-mini' },
          reason: 'paid translation route with stronger hosted model',
        },
        {
          policyProfile: 'tier3',
          model: { provider: 'openai', model: 'gpt-5-mini' },
          reason: 'paid translation route with stronger hosted model',
        },
        {
          policyProfile: 'tier4',
          model: { provider: 'openai', model: 'gpt-5-mini' },
          reason: 'paid translation route with stronger hosted model',
        },
      ],
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function modelKey(model: AiModelRef): string {
  return `${model.provider}:${model.model}`;
}

function isModelRef(value: unknown): value is AiModelRef {
  if (!isRecord(value)) return false;
  return typeof value.provider === 'string' && typeof value.model === 'string';
}

function pushModelIssue(
  issues: AiModelManagementValidationIssue[],
  path: string,
  model: unknown,
): model is AiModelRef {
  if (!isModelRef(model)) {
    issues.push({ path, message: 'Expected model reference with provider and model' });
    return false;
  }
  const capability = resolveAiModelCapability(model.provider, model.model);
  if (!capability) {
    issues.push({ path, message: `Unknown model candidate: ${model.provider}:${model.model}` });
    return false;
  }
  return true;
}

function validateModelList(args: {
  issues: AiModelManagementValidationIssue[];
  path: string;
  models: unknown;
}): AiModelRef[] {
  const out: AiModelRef[] = [];
  if (!Array.isArray(args.models)) {
    args.issues.push({ path: args.path, message: 'Expected model list' });
    return out;
  }
  const seen = new Set<string>();
  args.models.forEach((entry, index) => {
    const path = `${args.path}[${index}]`;
    if (!pushModelIssue(args.issues, path, entry)) return;
    const key = modelKey(entry);
    if (seen.has(key)) {
      args.issues.push({ path, message: `Duplicate model candidate: ${key}` });
      return;
    }
    seen.add(key);
    out.push(entry);
  });
  return out;
}

export function validateAiModelManagementConfig(
  value: unknown,
): AiModelManagementValidationResult {
  const issues: AiModelManagementValidationIssue[] = [];
  if (!isRecord(value) || value.v !== 1) {
    return { ok: false, issues: [{ path: 'v', message: 'Expected AI model management config v1' }] };
  }

  const productCopilot = isRecord(value.productCopilot) ? value.productCopilot : null;
  if (!productCopilot) {
    issues.push({ path: 'productCopilot', message: 'Expected Product Copilot model config' });
  } else {
    const productModels = validateModelList({
      issues,
      path: 'productCopilot.enabledModels',
      models: productCopilot.enabledModels,
    });
    if (productCopilot.userPicker !== 'all-enabled-models') {
      issues.push({
        path: 'productCopilot.userPicker',
        message: 'Product Copilot must expose all enabled models to paid users',
      });
    }
    if (
      pushModelIssue(issues, 'productCopilot.defaultModel', productCopilot.defaultModel) &&
      !productModels.some((model) => modelKey(model) === modelKey(productCopilot.defaultModel as AiModelRef))
    ) {
      issues.push({
        path: 'productCopilot.defaultModel',
        message: 'Product Copilot default model must be included in enabled models',
      });
    }
  }

  const sdrCopilot = isRecord(value.sdrCopilot) ? value.sdrCopilot : null;
  if (!sdrCopilot) {
    issues.push({ path: 'sdrCopilot', message: 'Expected SDR Copilot model config' });
  } else {
    validateModelList({
      issues,
      path: 'sdrCopilot.enabledModels',
      models: sdrCopilot.enabledModels,
    });
    if (sdrCopilot.publicPicker !== 'none') {
      issues.push({ path: 'sdrCopilot.publicPicker', message: 'SDR Copilot must not expose a public model picker' });
    }
    if (sdrCopilot.defaultModel !== undefined) {
      pushModelIssue(issues, 'sdrCopilot.defaultModel', sdrCopilot.defaultModel);
    }
  }

  const internalAgents = isRecord(value.internalAgents) ? value.internalAgents : null;
  if (!internalAgents) {
    issues.push({ path: 'internalAgents', message: 'Expected internal agent model routing config' });
  } else {
    for (const [agentId, rawConfig] of Object.entries(internalAgents)) {
      const resolved = resolveAiAgent(agentId);
      if (!resolved) {
        issues.push({ path: `internalAgents.${agentId}`, message: `Unknown internal agent: ${agentId}` });
        continue;
      }
      if (resolved.entry.category !== 'system_agent') {
        issues.push({ path: `internalAgents.${agentId}`, message: 'Internal routing config is only for system agents' });
      }
      if (!isRecord(rawConfig) || !Array.isArray(rawConfig.routes)) {
        issues.push({ path: `internalAgents.${agentId}.routes`, message: 'Expected internal model routes' });
        continue;
      }
      rawConfig.routes.forEach((route, index) => {
        const routePath = `internalAgents.${agentId}.routes[${index}]`;
        if (!isRecord(route)) {
          issues.push({ path: routePath, message: 'Expected route object' });
          return;
        }
        const policyProfile = route.policyProfile;
        if (policyProfile !== 'default' && !AI_POLICY_PROFILES.includes(policyProfile as AiPolicyProfile)) {
          issues.push({ path: `${routePath}.policyProfile`, message: 'Unknown policy profile' });
        }
        pushModelIssue(issues, `${routePath}.model`, route.model);
        if (typeof route.reason !== 'string' || !route.reason.trim()) {
          issues.push({ path: `${routePath}.reason`, message: 'Route reason is required' });
        }
      });
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, config: value as AiModelManagementConfig };
}

export function getAiModelManagementConfig(): AiModelManagementConfig {
  const result = validateAiModelManagementConfig(AI_MODEL_MANAGEMENT_CONFIG);
  if (!result.ok) {
    throw new Error(`[ck-contracts] AI model management config invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.config;
}

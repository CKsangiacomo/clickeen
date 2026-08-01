import {
  isPolicyEntitled,
  deriveAiRuntimePolicyUi,
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  resolvePolicyFromEntitlementsSnapshot,
  type AgentRuntimePolicyUi,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { CK_REQUEST_ID_HEADER, asTrimmedString, looksLikeHtmlErrorPage } from '@clickeen/ck-contracts';
import {
  resolveAiAgent,
  type AiGrantPolicy,
  type AiModelRef,
} from '@clickeen/ck-contracts/ai';
import {
  isProductCopilotManagedModel,
  listProductCopilotManagedModels,
} from '@clickeen/ck-contracts/ai-model-management';
import { reserveAccountCopilotTurn, type RomaUsageKv } from '../account-limit-usage';
import { resolveProductCopilotBaseUrl } from '../env/product-copilot';
import {
  mintRomaAIGrant,
  resolveRomaAiGrantPrivateKeyPem,
  resolveEnvStage,
  type RomaAIGrant,
} from './grants';

export const ACCOUNT_WIDGET_COPILOT_AGENT_ID = 'product.copilot';
export type AccountCopilotRuntimeUi = AgentRuntimePolicyUi;

function modelKey(model: AiModelRef): string {
  return `${model.provider}:${model.model}`;
}

function policyModelKeys(ai: AiGrantPolicy): Set<string> {
  const out = new Set<string>();
  for (const [provider, policy] of Object.entries(ai.modelsByProvider)) {
    if (!policy) continue;
    policy.allowed.forEach((model) => out.add(`${provider}:${model}`));
  }
  return out;
}

function isPaidProductCopilotProfile(profile: AiGrantPolicy['policyProfile']): boolean {
  return profile !== 'free';
}

function assertProductCopilotGrantPolicyManaged(ai: AiGrantPolicy): void {
  const managedModels = listProductCopilotManagedModels();
  const managed = new Set(managedModels.map(modelKey));
  if (!managed.has(modelKey(ai.defaultModel))) {
    throw new Error(`[Roma] Product Copilot default model is not managed: ${modelKey(ai.defaultModel)}`);
  }
  if (ai.selectedModel && !managed.has(modelKey(ai.selectedModel))) {
    throw new Error(`[Roma] Product Copilot selected model is not managed: ${modelKey(ai.selectedModel)}`);
  }
  for (const [provider, policy] of Object.entries(ai.modelsByProvider)) {
    if (!policy) continue;
    for (const model of policy.allowed) {
      const key = `${provider}:${model}`;
      if (!managed.has(key)) {
        throw new Error(`[Roma] Product Copilot policy model is not managed: ${key}`);
      }
    }
  }
  if (isPaidProductCopilotProfile(ai.policyProfile)) {
    const policyModels = policyModelKeys(ai);
    if (policyModels.size !== managed.size || managedModels.some((model) => !policyModels.has(modelKey(model)))) {
      throw new Error('[Roma] Paid Product Copilot policy must include every managed Product Copilot model');
    }
  }
}

export async function issueAccountCopilotGrant(args: {
  authz: RomaAccountAuthzCapsulePayload;
  selectedModel?: AiModelRef | null;
  trace?: { sessionId?: string; instanceId?: string };
  usageKv?: RomaUsageKv | null;
}): Promise<
  | { ok: true; grant: string; exp: number; agentId: string }
  | { ok: false; status: number; reasonKey: string; detail?: string }
> {
  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: args.authz.profile,
    role: args.authz.role,
    entitlements: args.authz.entitlements ?? null,
  });

  const resolvedAgent = resolveAiAgent(ACCOUNT_WIDGET_COPILOT_AGENT_ID);
  if (!resolvedAgent) {
    return { ok: false, status: 422, reasonKey: 'coreui.errors.ai.agent.invalid' };
  }

  const entry = resolvedAgent.entry;
  if (entry.requiredEntitlements?.length) {
    for (const key of entry.requiredEntitlements) {
      if (!isPolicyEntitled(policy, key)) {
        return {
          ok: false,
          status: 403,
          reasonKey: 'coreui.upsell.reason.flagBlocked',
          detail: key,
        };
      }
    }
  }

  let ai: AiGrantPolicy;
  try {
    if (args.selectedModel && !isProductCopilotManagedModel(args.selectedModel)) {
      throw new Error(`[Roma] Selected Product Copilot model is not managed: ${modelKey(args.selectedModel)}`);
    }
    ai = resolveAiRuntimePolicy({
      entry,
      policyProfile: args.authz.profile,
      selectedModel: args.selectedModel ?? undefined,
    });
    assertProductCopilotGrantPolicyManaged(ai);
  } catch (error) {
    return {
      ok: false,
      status: 403,
      reasonKey: 'coreui.errors.ai.model.notAllowed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const traceRaw = args.trace ?? {};
  const sessionId =
    typeof traceRaw.sessionId === 'string' && traceRaw.sessionId.trim() ? traceRaw.sessionId.trim() : crypto.randomUUID();
  const instanceId =
    typeof traceRaw.instanceId === 'string' && traceRaw.instanceId.trim()
      ? traceRaw.instanceId.trim()
      : undefined;

  const baseBudgets = resolveAiRuntimeBudget(ai);
  const maxTokens = baseBudgets.maxTokens;
  const timeoutMs = baseBudgets.timeoutMs;

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + 10 * 60;
  const grantPayload: RomaAIGrant = {
    iss: 'roma',
    jti: crypto.randomUUID(),
    sub: { kind: 'user', userId: args.authz.userId, accountId: args.authz.accountId },
    exp,
    caps: [`agent:${resolvedAgent.canonicalId}`],
    budgets: {
      maxTokens,
      timeoutMs,
    },
    mode: 'editor',
    ai,
    trace: {
      sessionId,
      ...(instanceId ? { instanceId } : {}),
      surfaceId: 'roma.builder',
      envStage: resolveEnvStage(),
    },
  };

  const grant = await mintRomaAIGrant(grantPayload, resolveRomaAiGrantPrivateKeyPem());

  const copilotTurnLimit = policy.limits['copilot.turns.monthly.max'];
  try {
    const reservation = await reserveAccountCopilotTurn({
      accountId: args.authz.accountId,
      max: copilotTurnLimit,
      usageKv: args.usageKv,
    });
    if (!reservation.ok) {
      return {
        ok: false,
        status: 403,
        reasonKey: 'coreui.upsell.reason.limitReached',
        detail: 'copilot.turns.monthly.max limit exceeded.',
      };
    }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      reasonKey: 'coreui.errors.auth.contextUnavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  return { ok: true, grant, exp, agentId: resolvedAgent.canonicalId };
}

export function resolveAccountCopilotRuntimeUi(args: {
  authz: RomaAccountAuthzCapsulePayload;
}): AccountCopilotRuntimeUi | null {
  const resolvedAgent = resolveAiAgent(ACCOUNT_WIDGET_COPILOT_AGENT_ID);
  if (!resolvedAgent) return null;
  const policy = resolveAiRuntimePolicy({
    entry: resolvedAgent.entry,
    policyProfile: args.authz.profile,
  });
  assertProductCopilotGrantPolicyManaged(policy);
  return deriveAiRuntimePolicyUi(policy);
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function summarizeUpstreamError(args: { serviceName: string; baseUrl: string; status: number; bodyText: string }): string {
  const base = args.baseUrl ? args.baseUrl.replace(/\/$/, '') : '(missing)';
  if (looksLikeHtmlErrorPage(args.bodyText)) {
    return `${args.serviceName} returned an HTML error page (HTTP ${args.status}). Check ${args.serviceName.toUpperCase()}_BASE_URL (currently: ${base}).`;
  }
  return args.bodyText || `${args.serviceName} error (${args.status})`;
}

export async function executeCopilotOnProductCopilot(args: {
  grant: string;
  agentId: string;
  input: unknown;
  traceClient: 'roma';
  requestId?: string | null;
}): Promise<
  | { ok: true; requestId: string; result: unknown }
  | { ok: false; status: number; message: string; reasonKey?: string; issues?: Array<{ path: string; message: string }> }
> {
  const baseUrl = resolveProductCopilotBaseUrl().replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(args.requestId ? { [CK_REQUEST_ID_HEADER]: args.requestId } : {}),
      },
      body: JSON.stringify({
        grant: args.grant,
        agentId: args.agentId,
        input: args.input,
        trace: { client: args.traceClient, requestId: args.requestId ?? undefined },
      }),
      cache: 'no-store',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 502, message: `Product Copilot request failed: ${detail}` };
  }

  const text = await res.text().catch(() => '');
  const payload = safeJsonParse(text) as any;
  if (!res.ok) {
    const message =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.message === 'string'
          ? payload.message
          : summarizeUpstreamError({ serviceName: 'Product Copilot', baseUrl, status: res.status, bodyText: text });
    const issues = Array.isArray(payload?.error?.issues)
      ? payload.error.issues.filter((issue: unknown): issue is { path: string; message: string } => {
          return Boolean(issue) &&
            typeof issue === 'object' &&
            typeof (issue as any).path === 'string' &&
            typeof (issue as any).message === 'string';
        })
      : undefined;
    const reasonKey = typeof payload?.error?.reasonKey === 'string' ? payload.error.reasonKey : undefined;
    return { ok: false, status: res.status, message, ...(reasonKey ? { reasonKey } : {}), ...(issues?.length ? { issues } : {}) };
  }

  return {
    ok: true,
    requestId: asTrimmedString(payload?.requestId) ?? '',
    result: payload?.result ?? null,
  };
}

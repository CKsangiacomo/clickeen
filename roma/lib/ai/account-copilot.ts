import {
  isPolicyEntitled,
  deriveAiRuntimePolicyUi,
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  resolvePolicyFromEntitlementsSnapshot,
  type AgentRuntimePolicyUi,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { CK_REQUEST_ID_HEADER, asTrimmedString, isRecord, looksLikeHtmlErrorPage } from '@clickeen/ck-contracts';
import {
  resolveAiAgent,
  type AiGrantPolicy,
  type AiModelRef,
  type CopilotTurnRequest,
} from '@clickeen/ck-contracts/ai';
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

export async function issueAccountCopilotGrant(args: {
  authz: RomaAccountAuthzCapsulePayload;
  selectedModel?: AiModelRef | null;
  trace: { sessionId: string; instanceId: string };
  usageKv?: RomaUsageKv | null;
  skipTurnReservation?: boolean;
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
    ai = resolveAiRuntimePolicy({
      entry,
      policyProfile: args.authz.profile,
      selectedModel: args.selectedModel ?? undefined,
    });
  } catch (error) {
    return {
      ok: false,
      status: 403,
      reasonKey: 'coreui.errors.ai.model.notAllowed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

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
      sessionId: args.trace.sessionId,
      instanceId: args.trace.instanceId,
      surfaceId: 'roma.builder',
      envStage: resolveEnvStage(),
    },
  };

  const grant = await mintRomaAIGrant(grantPayload, resolveRomaAiGrantPrivateKeyPem());

  const copilotTurnLimit = policy.limits['copilot.turns.monthly.max'];
  if (!args.skipTurnReservation) {
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

/**
 * PRD 128D — Stream a copilot turn from the Product Copilot Worker.
 *
 * Calls POST /turn (SSE) and returns the raw streaming Response for the route
 * to pipe through to Bob. Roma does NOT buffer or reinterpret the stream.
 *
 * PRD 128D correction: the upstream body is constructed from explicitly
 * allowed fields of the ALREADY-VALIDATED CopilotTurnRequest. The
 * Roma-issued grant is written authoritatively AFTER all caller input.
 * Caller-supplied grant and trace fields NEVER cross this boundary.
 */
export async function streamCopilotTurn(args: {
  grant: string;
  turnRequest: CopilotTurnRequest;
  requestId?: string | null;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; response: Response }
  | { ok: false; status: number; message: string; reasonKey?: string }
> {
  const baseUrl = resolveProductCopilotBaseUrl().replace(/\/+$/, '');
  const req = args.turnRequest;

  // Construct from allowed fields only — no spread of caller-controlled input.
  const upstream: Record<string, unknown> = {
    version: req.version,
    kind: req.kind,
    sessionId: req.sessionId,
    userTurnId: req.userTurnId,
    ...(req.kind === 'initial' ? { userMessage: req.userMessage } : {}),
    ...(req.kind === 'continuation'
      ? {
          priorModelStepId: req.priorModelStepId,
          toolCallId: req.toolCallId,
          toolName: req.toolName,
          toolResult: req.toolResult,
        }
      : {}),
    ...(req.selectedModel ? { selectedModel: req.selectedModel } : {}),
    conversationHistory: req.conversationHistory,
    currentDraftContext: req.currentDraftContext,
    // Roma's minted grant and trace — authoritative, written last.
    grant: args.grant,
    trace: { client: 'roma', requestId: args.requestId ?? undefined },
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/turn`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        ...(args.requestId ? { [CK_REQUEST_ID_HEADER]: args.requestId } : {}),
      },
      body: JSON.stringify(upstream),
      cache: 'no-store',
      signal: args.signal,
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      message: `Product Copilot turn request failed: ${error instanceof Error ? error.message : String(error)}`,
      reasonKey: 'coreui.errors.copilot.failed',
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const payload = safeJsonParse(text);
    return {
      ok: false,
      status: res.status,
      message: summarizeUpstreamError({
        serviceName: 'Product Copilot',
        baseUrl,
        status: res.status,
        bodyText: isRecord(payload) ? asTrimmedString((payload as Record<string, unknown>).error) ?? text : text,
      }),
      reasonKey: 'coreui.errors.copilot.failed',
    };
  }

  return { ok: true, response: res };
}

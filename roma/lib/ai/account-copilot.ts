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
import { reserveAccountLimitUse, type RomaUsageKv } from '../account-limit-usage';
import { getOptionalCloudflareRequestContext } from '../cloudflare-request-context';
import { resolveSanfranciscoBaseUrl } from '../env/sanfrancisco';

type AIGrant = {
  v: 1;
  iss: 'roma';
  jti?: string;
  sub: { kind: 'user'; userId: string; accountId: string };
  exp: number;
  caps: string[];
  budgets: {
    maxTokens: number;
    timeoutMs: number;
  };
  mode: 'editor' | 'ops';
  ai?: AiGrantPolicy;
  trace?: {
    sessionId?: string;
    instanceId?: string;
    envStage?: string;
  };
};

const OUTCOME_EVENTS = new Set([
  'cta_clicked',
  'edit_applied',
  'edit_rejected',
  'edit_undone',
  'clarification_needed',
  'invalid_output',
] as const);
export const ACCOUNT_WIDGET_COPILOT_AGENT_ID = 'cs.widget.copilot.v1';
export type AccountCopilotRuntimeUi = AgentRuntimePolicyUi;

function readTrimmedSecret(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveAiGrantSecret(): string {
  const fromRequestContext = getOptionalCloudflareRequestContext<{ env?: { AI_GRANT_HMAC_SECRET?: string } }>()
    ?.env?.AI_GRANT_HMAC_SECRET;
  const requestSecret = readTrimmedSecret(fromRequestContext);
  if (requestSecret) return requestSecret;

  const processSecret = readTrimmedSecret(typeof process !== 'undefined' ? process.env.AI_GRANT_HMAC_SECRET : undefined);
  if (processSecret) return processSecret;

  throw new Error('[Roma] Missing AI_GRANT_HMAC_SECRET');
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  return base64UrlEncodeBytes(await hmacSha256(secret, message));
}

function resolveEnvStage(): string {
  const stage = String(process.env.ENV_STAGE || process.env.CF_PAGES_BRANCH || '').trim().toLowerCase();
  if (stage) return stage;
  return process.env.NODE_ENV === 'development' ? 'local' : 'cloud-dev';
}

async function mintGrant(grant: AIGrant, secret: string): Promise<string> {
  const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(grant)));
  const sigBytes = await hmacSha256(secret, `v1.${payloadB64}`);
  const sigB64 = base64UrlEncodeBytes(sigBytes);
  return `v1.${payloadB64}.${sigB64}`;
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

  const copilotTurnLimit = policy.limits['copilot.turns.monthly.max'];
  try {
    const reserved = await reserveAccountLimitUse({
      accountId: args.authz.accountId,
      limitKey: 'copilot.turns.monthly.max',
      max: copilotTurnLimit ?? null,
      usageKv: args.usageKv,
    });
    if (!reserved.ok) {
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

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + 10 * 60;
  const grantPayload: AIGrant = {
    v: 1,
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
      envStage: resolveEnvStage(),
    },
  };

  const grant = await mintGrant(grantPayload, resolveAiGrantSecret());
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

export async function executeCopilotOnSanFrancisco(args: {
  grant: string;
  agentId: string;
  input: unknown;
  traceClient: 'roma';
  requestId?: string | null;
}): Promise<
  | { ok: true; requestId: string; result: unknown }
  | { ok: false; message: string }
> {
  const baseUrl = resolveSanfranciscoBaseUrl().replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/execute`, {
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
    return { ok: false, message: `SanFrancisco request failed: ${detail}` };
  }

  const text = await res.text().catch(() => '');
  const payload = safeJsonParse(text) as any;
  if (!res.ok) {
    const message =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.message === 'string'
          ? payload.message
          : summarizeUpstreamError({ serviceName: 'SanFrancisco', baseUrl, status: res.status, bodyText: text });
    return { ok: false, message };
  }

  return {
    ok: true,
    requestId: asTrimmedString(payload?.requestId) ?? '',
    result: payload?.result ?? null,
  };
}

export function isValidCopilotOutcomePayload(value: unknown): value is {
  requestId: string;
  sessionId: string;
  event: string;
  occurredAtMs: number;
  timeToDecisionMs?: number;
  accountIdHash?: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const requestId = asTrimmedString(body.requestId);
  const sessionId = asTrimmedString(body.sessionId);
  const event = asTrimmedString(body.event);
  const occurredAtMs = body.occurredAtMs;
  const timeToDecisionMs = body.timeToDecisionMs;
  const accountIdHash = body.accountIdHash;
  if (!requestId || !sessionId || !event || !OUTCOME_EVENTS.has(event as any)) return false;
  if (typeof occurredAtMs !== 'number' || !Number.isFinite(occurredAtMs)) return false;
  if (timeToDecisionMs !== undefined && (typeof timeToDecisionMs !== 'number' || !Number.isFinite(timeToDecisionMs) || timeToDecisionMs < 0)) {
    return false;
  }
  if (accountIdHash !== undefined && (typeof accountIdHash !== 'string' || !accountIdHash.trim())) return false;
  return true;
}

export async function hashCopilotAccountId(accountId: string): Promise<string> {
  const normalized = String(accountId || '').trim();
  if (!normalized) return '';
  return hmacSha256Base64Url(resolveAiGrantSecret(), `copilot.account.v1.${normalized}`);
}

export async function forwardCopilotOutcome(body: unknown): Promise<{ ok: true; upstream: unknown } | { ok: false; message: string }> {
  const bodyText = JSON.stringify(body);
  const signature = await hmacSha256Base64Url(resolveAiGrantSecret(), `outcome.v1.${bodyText}`);
  const baseUrl = resolveSanfranciscoBaseUrl().replace(/\/+$/, '');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/outcome`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-clickeen-signature': signature,
      },
      body: bodyText,
      cache: 'no-store',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `SanFrancisco outcome request failed: ${detail}` };
  }

  const text = await response.text().catch(() => '');
  if (!response.ok) {
    return {
      ok: false,
      message: summarizeUpstreamError({ serviceName: 'SanFrancisco', baseUrl, status: response.status, bodyText: text }),
    };
  }

  return { ok: true, upstream: safeJsonParse(text) };
}

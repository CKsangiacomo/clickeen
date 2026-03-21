import {
  isPolicyEntitled,
  resolveAiAgent,
  resolveAiBudgets,
  resolveAiPolicyCapsule,
  resolvePolicyFromEntitlementsSnapshot,
  resolveWidgetCopilotRequestedAgentId,
  type BudgetKey,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { readAccountBudgetUsed, type RomaUsageKv } from '../account-budget-usage';
import { readAccountStorageBytesUsed } from '../account-storage-usage';
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
    timeoutMs?: number;
    maxCostUsd?: number;
    maxRequests?: number;
  };
  mode: 'editor' | 'ops';
  ai?: ReturnType<typeof resolveAiPolicyCapsule>;
  trace?: {
    sessionId?: string;
    instancePublicId?: string;
    envStage?: string;
  };
};

const OUTCOME_EVENTS = new Set([
  'upgrade_clicked',
  'upgrade_completed',
  'cta_clicked',
  'ux_keep',
  'ux_undo',
] as const);
const STORAGE_BYTES_BUDGET_KEY = 'budget.uploads.bytes';

function resolveAiGrantSecret(): string {
  const fromRequestContext = getOptionalCloudflareRequestContext<{ env?: { AI_GRANT_HMAC_SECRET?: string } }>()
    ?.env?.AI_GRANT_HMAC_SECRET;
  const secret = typeof fromRequestContext === 'string' ? fromRequestContext.trim() : '';
  if (secret) return secret;

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

function clampBudget(requested: number | null, allowed: number, hardCap: number): number {
  const allowedInt = Math.max(1, Math.floor(allowed));
  const capped = Math.min(allowedInt, hardCap);
  if (requested && Number.isFinite(requested) && requested > 0) {
    return Math.min(capped, Math.floor(requested));
  }
  return capped;
}

function isBudgetEntitlementKey(policy: ReturnType<typeof resolvePolicyFromEntitlementsSnapshot>, key: string): key is BudgetKey {
  return key in policy.budgets;
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
  accountCapsule?: string | null;
  agentId: string;
  mode?: 'editor' | 'ops';
  requestedProvider?: string;
  requestedModel?: string;
  trace?: { sessionId?: string; instancePublicId?: string };
  budgets?: { maxTokens?: number; timeoutMs?: number; maxRequests?: number };
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

  const normalizedAgentId = resolveWidgetCopilotRequestedAgentId({
    requestedAgentId: args.agentId,
    policyProfile: args.authz.profile,
  });
  const resolvedAgent = normalizedAgentId ? resolveAiAgent(normalizedAgentId) : null;
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
      if (isBudgetEntitlementKey(policy, key)) {
        let used: number;
        try {
          used =
            key === STORAGE_BYTES_BUDGET_KEY
              ? await readAccountStorageBytesUsed({
                  accountId: args.authz.accountId,
                  accountCapsule: String(args.accountCapsule || '').trim(),
                })
              : await readAccountBudgetUsed(
                  args.authz.accountId,
                  key,
                  args.usageKv,
                );
        } catch (error) {
          return {
            ok: false,
            status: 503,
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail: error instanceof Error ? error.message : String(error),
          };
        }
        const budget = policy.budgets[key];
        if (budget.max != null && used + 1 > budget.max) {
          return {
            ok: false,
            status: 403,
            reasonKey: 'coreui.upsell.reason.budgetExceeded',
            detail: `${String(key)} budget exceeded (max=${budget.max}).`,
          };
        }
      }
    }
  }

  const ai = resolveAiPolicyCapsule({
    entry,
    policyProfile: args.authz.profile,
    requestedProvider: args.requestedProvider,
    requestedModel: args.requestedModel,
    isCurated: false,
  });

  const traceRaw = args.trace ?? {};
  const sessionId =
    typeof traceRaw.sessionId === 'string' && traceRaw.sessionId.trim() ? traceRaw.sessionId.trim() : crypto.randomUUID();
  const instancePublicId =
    typeof traceRaw.instancePublicId === 'string' && traceRaw.instancePublicId.trim()
      ? traceRaw.instancePublicId.trim()
      : undefined;

  const budgetsRaw = args.budgets ?? {};
  const requestedMaxTokens = typeof budgetsRaw.maxTokens === 'number' ? budgetsRaw.maxTokens : null;
  const requestedTimeoutMs = typeof budgetsRaw.timeoutMs === 'number' ? budgetsRaw.timeoutMs : null;
  const requestedMaxRequests = typeof budgetsRaw.maxRequests === 'number' ? budgetsRaw.maxRequests : null;

  const MAX_TOKENS_CAP = 1200;
  const TIMEOUT_MS_CAP = 60_000;
  const MAX_REQUESTS_CAP = 3;
  const baseBudgets = resolveAiBudgets(entry, ai.profile);
  const maxTokens = clampBudget(requestedMaxTokens, baseBudgets.maxTokens, MAX_TOKENS_CAP);
  const timeoutMs = clampBudget(requestedTimeoutMs, baseBudgets.timeoutMs, TIMEOUT_MS_CAP);
  const maxRequests = clampBudget(requestedMaxRequests, baseBudgets.maxRequests ?? 1, MAX_REQUESTS_CAP);

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + 10 * 60;
  const grantPayload: AIGrant = {
    v: 1,
    iss: 'roma',
    jti: crypto.randomUUID(),
    sub: { kind: 'user', userId: args.authz.userId, accountId: args.authz.accountId },
    exp,
    caps: [`agent:${resolvedAgent.canonicalId}`],
    budgets: { maxTokens, timeoutMs, maxRequests },
    mode: args.mode === 'editor' ? 'editor' : 'ops',
    ai,
    trace: {
      sessionId,
      ...(instancePublicId ? { instancePublicId } : {}),
      envStage: resolveEnvStage(),
    },
  };

  const grant = await mintGrant(grantPayload, resolveAiGrantSecret());
  return { ok: true, grant, exp, agentId: resolvedAgent.canonicalId };
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function looksLikeHtml(text: string): boolean {
  const s = (text || '').trim().slice(0, 2000).toLowerCase();
  if (!s) return false;
  return (
    s.startsWith('<!doctype html') ||
    s.startsWith('<html') ||
    s.includes('<html') ||
    s.includes('id="cf-wrapper"') ||
    s.includes("id='cf-wrapper'") ||
    s.includes('cloudflare.com/5xx-error-landing')
  );
}

function summarizeUpstreamError(args: { serviceName: string; baseUrl: string; status: number; bodyText: string }): string {
  const base = args.baseUrl ? args.baseUrl.replace(/\/$/, '') : '(missing)';
  if (looksLikeHtml(args.bodyText)) {
    return `${args.serviceName} returned an HTML error page (HTTP ${args.status}). Check ${args.serviceName.toUpperCase()}_BASE_URL (currently: ${base}).`;
  }
  return args.bodyText || `${args.serviceName} error (${args.status})`;
}

export async function executeCopilotOnSanFrancisco(args: {
  grant: string;
  agentId: string;
  input: unknown;
  traceClient: 'roma';
}): Promise<
  | { ok: true; requestId: string; result: unknown }
  | { ok: false; message: string }
> {
  const baseUrl = resolveSanfranciscoBaseUrl().replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant: args.grant,
        agentId: args.agentId,
        input: args.input,
        trace: { client: args.traceClient },
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
    requestId: asTrimmedString(payload?.requestId),
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

export async function forwardCopilotOutcome(body: unknown): Promise<{ ok: true; upstream: unknown } | { ok: false; message: string }> {
  const bodyText = JSON.stringify({
    command: 'ai.outcome.attach' as const,
    payload: body,
  });
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

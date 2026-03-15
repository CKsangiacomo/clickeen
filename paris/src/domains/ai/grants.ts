import {
  resolvePolicy,
  resolveAiAgent,
  resolveAiBudgets,
  resolveAiPolicyCapsule,
  isPolicyEntitled,
  resolveWidgetCopilotRequestedAgentId,
  type BudgetKey,
  type Policy,
  type PolicyProfile,
} from '@clickeen/ck-policy';
import type { AIGrant, AccountRow, Env } from '../../shared/types';
import { json } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { asTrimmedString, isUuid } from '../../shared/validation';
import { consumeBudget } from '../../shared/budgets';
import { requireAccount } from '../../shared/accounts';

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

function aiMisconfiguredResponse(detail = 'missing_ai_grant_hmac_secret'): Response {
  return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail }, 503);
}

async function mintGrant(grant: AIGrant, secret: string): Promise<string> {
  const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(grant)));
  const sigBytes = await hmacSha256(secret, `v1.${payloadB64}`);
  const sigB64 = base64UrlEncodeBytes(sigBytes);
  return `v1.${payloadB64}.${sigB64}`;
}

function clampBudget(requested: number | null, allowed: number, hardCap: number): number {
  const allowedInt = Math.max(1, Math.floor(allowed));
  const capped = Math.min(allowedInt, hardCap);
  if (requested && Number.isFinite(requested) && requested > 0) {
    return Math.min(capped, Math.floor(requested));
  }
  return capped;
}

function resolveAiSubjectPolicy(args: {
  subject: 'minibob' | 'account';
  account?: AccountRow | null;
}): { policy: Policy; profile: PolicyProfile } {
  if (args.subject === 'minibob') {
    const policy = resolvePolicy({ profile: 'minibob', role: 'editor' });
    return { policy, profile: 'minibob' };
  }
  const tier = args.account?.tier ?? 'free';
  const policy = resolvePolicy({ profile: tier, role: 'editor' });
  return { policy, profile: tier };
}

function isBudgetEntitlementKey(policy: Policy, key: string): key is BudgetKey {
  return key in policy.budgets;
}

export async function issueAiGrant(args: {
  env: Env;
  agentId: string;
  mode?: 'editor' | 'ops';
  requestedProvider?: string;
  requestedModel?: string;
  subject?: 'minibob' | 'account';
  accountId?: string;
  account?: AccountRow | null;
  trace?: { sessionId?: string; instancePublicId?: string };
  budgets?: { maxTokens?: number; timeoutMs?: number; maxRequests?: number };
}): Promise<{ ok: true; grant: string; exp: number; agentId: string } | { ok: false; response: Response }> {
  const subject = args.subject ?? (args.accountId ? 'account' : 'minibob');
  let account: AccountRow | null = args.account ?? null;
  if (subject === 'account') {
    const accountIdRaw = args.accountId ?? '';
    if (!accountIdRaw || !isUuid(accountIdRaw)) {
      return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' }, 422) };
    }
    if (!account) {
      const accountRes = await requireAccount(args.env, accountIdRaw);
      if (!accountRes.ok) return { ok: false, response: accountRes.response };
      account = accountRes.account;
    }
  }

  const { policy, profile } = resolveAiSubjectPolicy({ subject, account });
  const normalizedAgentId = resolveWidgetCopilotRequestedAgentId({
    requestedAgentId: args.agentId,
    policyProfile: profile,
  });
  const resolvedAgent = normalizedAgentId ? resolveAiAgent(normalizedAgentId) : null;
  if (!resolvedAgent) {
    return { ok: false, response: json([{ path: 'agentId', message: 'unknown agentId' }], { status: 422 }) };
  }
  const entry = resolvedAgent.entry;

  if (entry.requiredEntitlements?.length) {
    const denied = entry.requiredEntitlements.find((key) => !isPolicyEntitled(policy, key));
    if (denied) {
      return {
        ok: false,
        response: ckError({ kind: 'DENY', reasonKey: 'coreui.upsell.reason.flagBlocked', upsell: 'UP', detail: denied }, 403),
      };
    }
  }

  if (subject === 'account' && account?.id && entry.requiredEntitlements?.length) {
    const scope = { kind: 'account' as const, accountId: account.id };
    for (const key of entry.requiredEntitlements) {
      if (!isBudgetEntitlementKey(policy, key)) continue;
      const max = policy.budgets[key]?.max ?? null;
      const consumed = await consumeBudget({ env: args.env, scope, budgetKey: key, max, amount: 1 });
      if (!consumed.ok) {
        return {
          ok: false,
          response: ckError({ kind: 'DENY', reasonKey: consumed.reasonKey, upsell: 'UP', detail: consumed.detail }, 403),
        };
      }
    }
  }

  const ai = resolveAiPolicyCapsule({
    entry,
    policyProfile: profile,
    requestedProvider: args.requestedProvider,
    requestedModel: args.requestedModel,
    isCurated: false,
  });

  const traceRaw = args.trace ?? {};
  const sessionId =
    typeof traceRaw.sessionId === 'string' && traceRaw.sessionId.trim() ? traceRaw.sessionId.trim() : crypto.randomUUID();
  const instancePublicId =
    typeof traceRaw.instancePublicId === 'string' && traceRaw.instancePublicId.trim() ? traceRaw.instancePublicId.trim() : undefined;

  const envStage = typeof args.env.ENV_STAGE === 'string' && args.env.ENV_STAGE.trim() ? args.env.ENV_STAGE.trim() : 'cloud-dev';
  const trace: AIGrant['trace'] = {
    sessionId,
    ...(instancePublicId ? { instancePublicId } : {}),
    envStage,
  };

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
    iss: 'paris',
    jti: crypto.randomUUID(),
    sub: { kind: 'anon', sessionId: trace.sessionId || crypto.randomUUID() },
    exp,
    caps: [`agent:${resolvedAgent.canonicalId}`],
    budgets: { maxTokens, timeoutMs, maxRequests },
    mode: args.mode === 'ops' ? 'ops' : 'editor',
    ai,
    trace,
  };

  const secret = asTrimmedString(args.env.AI_GRANT_HMAC_SECRET);
  if (!secret) {
    return { ok: false, response: aiMisconfiguredResponse() };
  }

  const grant = await mintGrant(grantPayload, secret);
  return { ok: true, grant, exp, agentId: resolvedAgent.canonicalId };
}

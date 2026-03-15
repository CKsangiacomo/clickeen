import {
  isPolicyEntitled,
  resolveAiAgent,
  resolveAiBudgets,
  resolveAiPolicyCapsule,
  resolvePolicy,
  resolveWidgetCopilotRequestedAgentId,
} from '@clickeen/ck-policy';

type AIGrant = {
  v: 1;
  iss: 'bob';
  jti?: string;
  sub: { kind: 'anon'; sessionId: string };
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

const MINIBOB_SESSION_TTL_SEC = 60 * 60;
const MINIBOB_SESSION_FUTURE_SKEW_SEC = 5 * 60;

function resolveAiGrantSecret(): string {
  const secret = String(process.env.AI_GRANT_HMAC_SECRET || '').trim();
  if (secret) return secret;
  throw new Error('[Bob] Missing AI_GRANT_HMAC_SECRET');
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

export async function mintMinibobSessionToken(): Promise<{ sessionToken: string; exp: number }> {
  const secret = resolveAiGrantSecret();
  const issuedAtSec = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const signature = await hmacSha256Base64Url(secret, `minibob|v1|${issuedAtSec}|${nonce}`);
  return {
    sessionToken: `minibob.v1.${issuedAtSec}.${nonce}.${signature}`,
    exp: issuedAtSec + MINIBOB_SESSION_TTL_SEC,
  };
}

async function deriveSessionKey(secret: string, nonce: string): Promise<string> {
  return hmacSha256Base64Url(secret, `minibob|session|${nonce}`);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyMinibobSessionToken(
  token: string,
): Promise<{ ok: true; sessionKey: string } | { ok: false; status: number; message: string }> {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 5 || parts[0] !== 'minibob' || parts[1] !== 'v1') {
    return { ok: false, status: 403, message: 'Invalid session token format.' };
  }

  const issuedAtSec = Number.parseInt(parts[2] || '', 10);
  const nonce = parts[3] || '';
  const signature = parts[4] || '';
  if (!Number.isFinite(issuedAtSec) || issuedAtSec <= 0 || !nonce || !signature) {
    return { ok: false, status: 403, message: 'Invalid session token.' };
  }

  const secret = resolveAiGrantSecret();
  const expected = await hmacSha256Base64Url(secret, `minibob|v1|${issuedAtSec}|${nonce}`);
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, status: 403, message: 'Invalid session token.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (issuedAtSec > nowSec + MINIBOB_SESSION_FUTURE_SKEW_SEC) {
    return { ok: false, status: 403, message: 'Invalid session token.' };
  }
  if (nowSec - issuedAtSec > MINIBOB_SESSION_TTL_SEC) {
    return { ok: false, status: 403, message: 'Session expired. Refresh and try again.' };
  }

  return { ok: true, sessionKey: await deriveSessionKey(secret, nonce) };
}

export async function issueMinibobCopilotGrant(args: {
  agentId: string;
  requestedProvider?: string;
  requestedModel?: string;
  trace?: { sessionId?: string };
  budgets?: { maxTokens?: number; timeoutMs?: number; maxRequests?: number };
}): Promise<
  | { ok: true; grant: string; exp: number; agentId: string }
  | { ok: false; status: number; reasonKey: string; detail?: string }
> {
  const policy = resolvePolicy({ profile: 'minibob', role: 'editor' });
  const normalizedAgentId = resolveWidgetCopilotRequestedAgentId({
    requestedAgentId: args.agentId,
    policyProfile: 'minibob',
  });
  const resolvedAgent = normalizedAgentId ? resolveAiAgent(normalizedAgentId) : null;
  if (!resolvedAgent) {
    return { ok: false, status: 422, reasonKey: 'coreui.errors.ai.agent.invalid' };
  }

  const entry = resolvedAgent.entry;
  if (entry.requiredEntitlements?.length) {
    const denied = entry.requiredEntitlements.find((key) => !isPolicyEntitled(policy, key));
    if (denied) {
      return {
        ok: false,
        status: 403,
        reasonKey: 'coreui.upsell.reason.flagBlocked',
        detail: denied,
      };
    }
  }

  const ai = resolveAiPolicyCapsule({
    entry,
    policyProfile: 'minibob',
    requestedProvider: args.requestedProvider,
    requestedModel: args.requestedModel,
    isCurated: false,
  });

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

  const sessionId =
    typeof args.trace?.sessionId === 'string' && args.trace.sessionId.trim() ? args.trace.sessionId.trim() : crypto.randomUUID();
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + 10 * 60;
  const grantPayload: AIGrant = {
    v: 1,
    iss: 'bob',
    jti: crypto.randomUUID(),
    sub: { kind: 'anon', sessionId },
    exp,
    caps: [`agent:${resolvedAgent.canonicalId}`],
    budgets: { maxTokens, timeoutMs, maxRequests },
    mode: 'ops',
    ai,
    trace: {
      sessionId,
      envStage: resolveEnvStage(),
    },
  };

  const grant = await mintGrant(grantPayload, resolveAiGrantSecret());
  return { ok: true, grant, exp, agentId: resolvedAgent.canonicalId };
}

export async function signOutcomeBody(bodyText: string): Promise<string> {
  return hmacSha256Base64Url(resolveAiGrantSecret(), `outcome.v1.${bodyText}`);
}

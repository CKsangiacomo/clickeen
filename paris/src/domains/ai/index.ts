import {
  resolvePolicy,
  resolveAiAgent,
  resolveAiBudgets,
  resolveAiPolicyCapsule,
  isPolicyEntitled,
} from '@clickeen/ck-policy';
import type { BudgetKey, Policy, PolicyProfile } from '@clickeen/ck-policy';
import type { AIGrant, Env, WorkspaceRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { assertDevAuth } from '../../shared/auth';
import { asTrimmedString, isRecord, isUuid } from '../../shared/validation';
import { consumeBudget } from '../../shared/budgets';
import { requireWorkspace } from '../../shared/workspaces';

const OUTCOME_EVENTS = new Set([
  'signup_started',
  'signup_completed',
  'upgrade_clicked',
  'upgrade_completed',
  'cta_clicked',
  'ux_keep',
  'ux_undo',
]);

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

const MINIBOB_SESSION_TTL_SEC = 60 * 60;
const MINIBOB_SESSION_FUTURE_SKEW_SEC = 5 * 60;
const MINIBOB_SESSION_LIMIT_PER_MINUTE = 6;
const MINIBOB_SESSION_LIMIT_PER_HOUR = 12;
const MINIBOB_MINUTE_TTL_SEC = 2 * 60;
const MINIBOB_HOUR_TTL_SEC = 2 * 60 * 60;

type MinibobRateLimitMode = 'off' | 'log' | 'enforce';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function getEnvStage(env: Env): string {
  return (asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev').toLowerCase();
}

function resolveMinibobRateLimitMode(env: Env): { stage: string; mode: MinibobRateLimitMode } {
  const stage = getEnvStage(env);
  const override = asTrimmedString(env.MINIBOB_RATELIMIT_MODE)?.toLowerCase();
  if (override === 'off' || override === 'log' || override === 'enforce') {
    return { stage, mode: override };
  }
  if (stage === 'local') return { stage, mode: 'off' };
  if (stage === 'cloud-dev') return { stage, mode: 'log' };
  return { stage, mode: 'enforce' };
}

function utcMinuteKey(now: Date): string {
  return now.toISOString().slice(0, 16);
}

function utcHourKey(now: Date): string {
  return now.toISOString().slice(0, 13);
}

async function incrementKvCounter(kv: KVNamespace, key: string, ttlSec: number): Promise<number> {
  const raw = await kv.get(key);
  const current = raw ? Number.parseInt(raw, 10) : 0;
  const next = Number.isFinite(current) && current > 0 ? current + 1 : 1;
  await kv.put(key, String(next), { expirationTtl: ttlSec });
  return next;
}

async function deriveSessionKey(secret: string, nonce: string): Promise<string> {
  return hmacSha256Base64Url(secret, `minibob|session|${nonce}`);
}

async function verifyMinibobSessionToken(
  token: string,
  secret: string,
): Promise<{ ok: true; sessionKey: string; nonce: string; issuedAtSec: number } | { ok: false; response: Response }> {
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'minibob' || parts[1] !== 'v1') {
    return { ok: false, response: json([{ path: 'sessionToken', message: 'invalid session token format' }], { status: 403 }) };
  }
  const issuedAtSec = Number.parseInt(parts[2] || '', 10);
  const nonce = parts[3] || '';
  const signature = parts[4] || '';
  if (!Number.isFinite(issuedAtSec) || issuedAtSec <= 0 || !nonce || !signature) {
    return { ok: false, response: json([{ path: 'sessionToken', message: 'invalid session token parts' }], { status: 403 }) };
  }

  const expected = await hmacSha256Base64Url(secret, `minibob|v1|${issuedAtSec}|${nonce}`);
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, response: json([{ path: 'sessionToken', message: 'invalid session token signature' }], { status: 403 }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (issuedAtSec > nowSec + MINIBOB_SESSION_FUTURE_SKEW_SEC) {
    return { ok: false, response: json([{ path: 'sessionToken', message: 'session token issued in the future' }], { status: 403 }) };
  }
  if (nowSec - issuedAtSec > MINIBOB_SESSION_TTL_SEC) {
    return { ok: false, response: json([{ path: 'sessionToken', message: 'session token expired' }], { status: 403 }) };
  }

  const sessionKey = await deriveSessionKey(secret, nonce);
  return { ok: true, sessionKey, nonce, issuedAtSec };
}

function logMinibobMintDecision(args: {
  stage: string;
  mode: MinibobRateLimitMode;
  decision: 'allow' | 'throttle' | 'deny';
  reason: string;
  sessionId: string;
  widgetType: string;
  sessionKey?: string | null;
}) {
  const sessionKeyShort = args.sessionKey ? args.sessionKey.slice(0, 16) : null;
  console.log(
    JSON.stringify({
      event: 'minibob.mint',
      stage: args.stage,
      mode: args.mode,
      decision: args.decision,
      reason: args.reason,
      sessionId: args.sessionId,
      widgetType: args.widgetType,
      sessionKey: sessionKeyShort,
      budgets: { maxTokens: 420, timeoutMs: 12_000, maxRequests: 2 },
      ts: Date.now(),
    }),
  );
}

async function applyMinibobRateLimit(args: {
  req: Request;
  env: Env;
  secret: string;
  sessionKey: string;
}): Promise<
  | { ok: true; stage: string; mode: MinibobRateLimitMode; rateLimited: boolean; reason: string }
  | { ok: false; response: Response; stage: string; mode: MinibobRateLimitMode; reason: string }
> {
  const { stage, mode } = resolveMinibobRateLimitMode(args.env);
  if (mode === 'off') {
    return { ok: true, stage, mode, rateLimited: false, reason: 'off' };
  }

  const kv = args.env.MINIBOB_RATELIMIT_KV;
  if (!kv) {
    if (stage === 'local') {
      return { ok: true, stage, mode: 'off', rateLimited: false, reason: 'no_kv_local' };
    }
    if (stage === 'cloud-dev') {
      return { ok: true, stage, mode: 'log', rateLimited: false, reason: 'no_kv_cloud_dev' };
    }
    return {
      ok: false,
      stage,
      mode,
      reason: 'ratelimit_unavailable',
      response: json({ error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.ai.minibob.ratelimitUnavailable' } }, { status: 503 }),
    };
  }

  const now = new Date();
  const minuteKey = utcMinuteKey(now);
  const hourKey = utcHourKey(now);

  // Note: Minibob grant requests may be proxied through Bob, so IP-based fingerprinting is proxy-fragile.
  // Use the server-verified sessionKey as the stable rate-limit key, and rely on edge/WAF rules to protect
  // the public `/api/ai/minibob/session` mint from infinite session rotation.
  const sessionMinuteCounterKey = `minibob:session:${args.sessionKey}:minute:${minuteKey}`;
  const sessionHourCounterKey = `minibob:session:${args.sessionKey}:hour:${hourKey}`;

  const [minuteCount, hourCount] = await Promise.all([
    incrementKvCounter(kv, sessionMinuteCounterKey, MINIBOB_MINUTE_TTL_SEC),
    incrementKvCounter(kv, sessionHourCounterKey, MINIBOB_HOUR_TTL_SEC),
  ]);

  const minuteExceeded = minuteCount > MINIBOB_SESSION_LIMIT_PER_MINUTE;
  const hourExceeded = hourCount > MINIBOB_SESSION_LIMIT_PER_HOUR;
  if (!minuteExceeded && !hourExceeded) {
    return { ok: true, stage, mode, rateLimited: false, reason: 'ok' };
  }

  const reason = minuteExceeded ? 'session_minute_limit_exceeded' : 'session_hour_limit_exceeded';
  const retryAfterSec = minuteExceeded ? 60 : 60 * 60;
  if (mode === 'log') {
    return { ok: true, stage, mode, rateLimited: true, reason };
  }

  return {
    ok: false,
    stage,
    mode,
    reason,
    response: json(
      { error: { kind: 'DENY', reasonKey: 'coreui.errors.ai.minibob.rateLimited' } },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    ),
  };
}

async function mintGrant(grant: AIGrant, secret: string): Promise<string> {
  const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(grant)));
  const sigBytes = await hmacSha256(secret, `v1.${payloadB64}`);
  const sigB64 = base64UrlEncodeBytes(sigBytes);
  return `v1.${payloadB64}.${sigB64}`;
}

function normalizeAiSubject(value: unknown): 'devstudio' | 'minibob' | 'workspace' | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'devstudio' || raw === 'minibob' || raw === 'workspace') return raw;
  return null;
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
  subject: 'devstudio' | 'minibob' | 'workspace';
  workspace?: WorkspaceRow | null;
}): { policy: Policy; profile: PolicyProfile } {
  if (args.subject === 'devstudio') {
    const policy = resolvePolicy({ profile: 'devstudio', role: 'owner' });
    return { policy, profile: 'devstudio' };
  }
  if (args.subject === 'minibob') {
    const policy = resolvePolicy({ profile: 'minibob', role: 'editor' });
    return { policy, profile: 'minibob' };
  }
  const tier = args.workspace?.tier ?? 'free';
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
  subject?: 'devstudio' | 'minibob' | 'workspace';
  workspaceId?: string;
  workspace?: WorkspaceRow | null;
  trace?: { sessionId?: string; instancePublicId?: string };
  budgets?: { maxTokens?: number; timeoutMs?: number; maxRequests?: number };
}): Promise<{ ok: true; grant: string; exp: number; agentId: string } | { ok: false; response: Response }> {
  const resolvedAgent = args.agentId ? resolveAiAgent(args.agentId) : null;
  if (!resolvedAgent) {
    return { ok: false, response: json([{ path: 'agentId', message: 'unknown agentId' }], { status: 422 }) };
  }
  const entry = resolvedAgent.entry;

  const subject = args.subject ?? (args.workspaceId ? 'workspace' : 'minibob');
  let workspace: WorkspaceRow | null = args.workspace ?? null;
  if (subject === 'workspace') {
    const workspaceIdRaw = args.workspaceId ?? '';
    if (!workspaceIdRaw || !isUuid(workspaceIdRaw)) {
      return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' }, 422) };
    }
    if (!workspace) {
      const workspaceRes = await requireWorkspace(args.env, workspaceIdRaw);
      if (!workspaceRes.ok) return { ok: false, response: workspaceRes.response };
      workspace = workspaceRes.workspace;
    }
  }

  const { policy, profile } = resolveAiSubjectPolicy({ subject, workspace });

  if (entry.requiredEntitlements?.length) {
    const denied = entry.requiredEntitlements.find((key) => !isPolicyEntitled(policy, key));
    if (denied) {
      return {
        ok: false,
        response: ckError({ kind: 'DENY', reasonKey: 'coreui.upsell.reason.flagBlocked', upsell: 'UP', detail: denied }, 403),
      };
    }
  }

  if (subject === 'workspace' && workspace?.id && entry.requiredEntitlements?.length) {
    const scope = { kind: 'workspace' as const, workspaceId: workspace.id };
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
  const sessionId = typeof traceRaw.sessionId === 'string' && traceRaw.sessionId.trim() ? traceRaw.sessionId.trim() : crypto.randomUUID();
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
  // Queue delivery + multi-locale runs can exceed 60s; use a longer grant TTL.
  const exp = nowSec + 10 * 60;
  const jti = crypto.randomUUID();

  const grantPayload: AIGrant = {
    v: 1,
    iss: 'paris',
    jti,
    sub: { kind: 'anon', sessionId: trace.sessionId || crypto.randomUUID() },
    exp,
    caps: [`agent:${resolvedAgent.canonicalId}`],
    budgets: { maxTokens, timeoutMs, maxRequests },
    mode: args.mode === 'ops' ? 'ops' : 'editor',
    ai,
    trace,
  };

  const secret = args.env.AI_GRANT_HMAC_SECRET?.trim();
  if (!secret) {
    return { ok: false, response: json({ error: 'AI_NOT_CONFIGURED', message: 'Missing AI_GRANT_HMAC_SECRET' }, { status: 503 }) };
  }

  const grant = await mintGrant(grantPayload, secret);
  return { ok: true, grant, exp, agentId: resolvedAgent.canonicalId };
}

export async function handleAiGrant(req: Request, env: Env) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  if (!isRecord(body)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const agentId = typeof (body as any).agentId === 'string' ? (body as any).agentId.trim() : '';
  const requestedProvider = typeof (body as any).provider === 'string' ? (body as any).provider.trim() : '';
  const requestedModel = typeof (body as any).model === 'string' ? (body as any).model.trim() : '';

  const workspaceIdRaw = typeof (body as any).workspaceId === 'string' ? (body as any).workspaceId.trim() : '';
  const subjectRaw = normalizeAiSubject((body as any).subject);
  const subject = subjectRaw ?? (workspaceIdRaw ? 'workspace' : 'minibob');

  const traceRaw = isRecord((body as any).trace) ? (body as any).trace : null;
  const trace = traceRaw
    ? {
        sessionId: typeof (traceRaw as any).sessionId === 'string' ? (traceRaw as any).sessionId : undefined,
        instancePublicId: typeof (traceRaw as any).instancePublicId === 'string' ? (traceRaw as any).instancePublicId : undefined,
      }
    : undefined;

  const budgetsRaw = isRecord((body as any).budgets) ? (body as any).budgets : null;
  const budgets = budgetsRaw
    ? {
        maxTokens: typeof (budgetsRaw as any).maxTokens === 'number' ? (budgetsRaw as any).maxTokens : undefined,
        timeoutMs: typeof (budgetsRaw as any).timeoutMs === 'number' ? (budgetsRaw as any).timeoutMs : undefined,
        maxRequests: typeof (budgetsRaw as any).maxRequests === 'number' ? (budgetsRaw as any).maxRequests : undefined,
      }
    : undefined;

  const issued = await issueAiGrant({
    env,
    agentId,
    mode: (body as any).mode === 'ops' ? 'ops' : 'editor',
    requestedProvider,
    requestedModel,
    subject,
    workspaceId: workspaceIdRaw || undefined,
    trace,
    budgets,
  });
  if (!issued.ok) return issued.response;
  return json({ grant: issued.grant, exp: issued.exp, agentId: issued.agentId });
}

export async function handleAiMinibobSession(_req: Request, env: Env) {
  const secret = env.AI_GRANT_HMAC_SECRET?.trim();
  if (!secret) {
    return json({ error: 'AI_NOT_CONFIGURED', message: 'Missing AI_GRANT_HMAC_SECRET' }, { status: 503 });
  }

  const issuedAtSec = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const signature = await hmacSha256Base64Url(secret, `minibob|v1|${issuedAtSec}|${nonce}`);
  const sessionToken = `minibob.v1.${issuedAtSec}.${nonce}.${signature}`;
  return json({ sessionToken, exp: issuedAtSec + MINIBOB_SESSION_TTL_SEC });
}

export async function handleAiMinibobGrant(req: Request, env: Env) {
  const { stage, mode } = resolveMinibobRateLimitMode(env);
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  if (!isRecord(body)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const sessionId = asTrimmedString((body as any).sessionId);
  const sessionToken = asTrimmedString((body as any).sessionToken);
  const widgetType = asTrimmedString((body as any).widgetType);
  if (!sessionId) {
    return json([{ path: 'sessionId', message: 'sessionId is required' }], { status: 422 });
  }
  if (!sessionToken) {
    logMinibobMintDecision({ stage, mode, decision: 'deny', reason: 'missing_session_token', sessionId, widgetType: widgetType ?? '' });
    return json([{ path: 'sessionToken', message: 'sessionToken is required' }], { status: 422 });
  }
  if (!widgetType) {
    logMinibobMintDecision({ stage, mode, decision: 'deny', reason: 'missing_widget_type', sessionId, widgetType: '' });
    return json([{ path: 'widgetType', message: 'widgetType is required' }], { status: 422 });
  }

  const secret = env.AI_GRANT_HMAC_SECRET?.trim();
  if (!secret) {
    return json({ error: 'AI_NOT_CONFIGURED', message: 'Missing AI_GRANT_HMAC_SECRET' }, { status: 503 });
  }

  const workspaceIdRaw = asTrimmedString((body as any).workspaceId);
  if (workspaceIdRaw) {
    logMinibobMintDecision({ stage, mode, decision: 'deny', reason: 'workspace_not_allowed', sessionId, widgetType });
    return json([{ path: 'workspaceId', message: 'workspaceId is not allowed for minibob grants' }], { status: 403 });
  }

  const agentIdRaw = asTrimmedString((body as any).agentId);
  if (agentIdRaw && agentIdRaw !== 'sdr.widget.copilot.v1') {
    logMinibobMintDecision({ stage, mode, decision: 'deny', reason: 'agent_not_allowed', sessionId, widgetType });
    return json([{ path: 'agentId', message: 'agentId is not allowed for minibob grants' }], { status: 403 });
  }

  const modeRaw = asTrimmedString((body as any).mode);
  if (modeRaw && modeRaw !== 'ops') {
    logMinibobMintDecision({ stage, mode, decision: 'deny', reason: 'mode_not_allowed', sessionId, widgetType });
    return json([{ path: 'mode', message: 'mode is not allowed for minibob grants' }], { status: 403 });
  }

  const verified = await verifyMinibobSessionToken(sessionToken, secret);
  if (!verified.ok) {
    logMinibobMintDecision({ stage, mode, decision: 'deny', reason: 'invalid_session_token', sessionId, widgetType });
    return verified.response;
  }

  const rateLimit = await applyMinibobRateLimit({ req, env, secret, sessionKey: verified.sessionKey });
  if (!rateLimit.ok) {
    logMinibobMintDecision({
      stage: rateLimit.stage,
      mode: rateLimit.mode,
      decision: 'throttle',
      reason: rateLimit.reason,
      sessionId,
      widgetType,
      sessionKey: verified.sessionKey,
    });
    return rateLimit.response;
  }

  const decision: 'allow' | 'throttle' = rateLimit.rateLimited ? 'throttle' : 'allow';
  const reason = rateLimit.rateLimited ? rateLimit.reason : 'ok';
  logMinibobMintDecision({
    stage: rateLimit.stage,
    mode: rateLimit.mode,
    decision,
    reason,
    sessionId,
    widgetType,
    sessionKey: verified.sessionKey,
  });

  const minibobPolicy = resolvePolicy({ profile: 'minibob', role: 'editor' });
  const minibobTurnsMax = minibobPolicy.budgets['budget.copilot.turns']?.max ?? null;
  const turn = await consumeBudget({
    env,
    scope: { kind: 'minibob', sessionKey: verified.sessionKey },
    budgetKey: 'budget.copilot.turns',
    max: minibobTurnsMax,
    amount: 1,
  });
  if (!turn.ok) {
    logMinibobMintDecision({
      stage: rateLimit.stage,
      mode: rateLimit.mode,
      decision: 'deny',
      reason: 'budget_exceeded',
      sessionId,
      widgetType,
      sessionKey: verified.sessionKey,
    });
    return json({ error: { kind: 'DENY', reasonKey: turn.reasonKey, upsell: 'UP', detail: turn.detail } }, { status: 403 });
  }

  const minibobBudgets =
    stage === 'local'
      ? { maxTokens: 650, timeoutMs: 45_000, maxRequests: 2 }
      : { maxTokens: 420, timeoutMs: 12_000, maxRequests: 2 };
  const issued = await issueAiGrant({
    env,
    agentId: 'sdr.widget.copilot.v1',
    mode: 'ops',
    subject: 'minibob',
    trace: { sessionId },
    budgets: minibobBudgets,
  });
  if (!issued.ok) return issued.response;

  return json({ grant: issued.grant, exp: issued.exp, agentId: issued.agentId });
}

function isOutcomeAttachPayload(value: unknown): value is {
  requestId: string;
  sessionId: string;
  event: string;
  occurredAtMs: number;
  timeToDecisionMs?: number;
  accountIdHash?: string;
  workspaceIdHash?: string;
} {
  if (!isRecord(value)) return false;
  const requestId = asTrimmedString((value as any).requestId);
  const sessionId = asTrimmedString((value as any).sessionId);
  const event = asTrimmedString((value as any).event);
  const occurredAtMs = (value as any).occurredAtMs;
  const timeToDecisionMs = (value as any).timeToDecisionMs;
  const accountIdHash = (value as any).accountIdHash;
  const workspaceIdHash = (value as any).workspaceIdHash;

  if (!requestId) return false;
  if (!sessionId) return false;
  if (!event || !OUTCOME_EVENTS.has(event)) return false;
  if (typeof occurredAtMs !== 'number' || !Number.isFinite(occurredAtMs)) return false;
  if (timeToDecisionMs !== undefined && (typeof timeToDecisionMs !== 'number' || !Number.isFinite(timeToDecisionMs) || timeToDecisionMs < 0))
    return false;
  if (accountIdHash !== undefined && (typeof accountIdHash !== 'string' || !accountIdHash.trim())) return false;
  if (workspaceIdHash !== undefined && (typeof workspaceIdHash !== 'string' || !workspaceIdHash.trim())) return false;
  return true;
}

export async function handleAiOutcome(req: Request, env: Env) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  if (!isOutcomeAttachPayload(body)) {
    return json([{ path: 'body', message: 'expected { requestId, sessionId, event, occurredAtMs }' }], { status: 422 });
  }

  const sfBaseUrl = asTrimmedString(env.SANFRANCISCO_BASE_URL);
  if (!sfBaseUrl) {
    return json({ error: 'MISCONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' }, { status: 503 });
  }

  const secret = env.AI_GRANT_HMAC_SECRET?.trim();
  if (!secret) {
    return json({ error: 'AI_NOT_CONFIGURED', message: 'Missing AI_GRANT_HMAC_SECRET' }, { status: 503 });
  }

  const bodyText = JSON.stringify(body);
  const signature = await hmacSha256Base64Url(secret, `outcome.v1.${bodyText}`);
  const outcomeUrl = new URL('/v1/outcome', sfBaseUrl).toString();

  const res = await fetch(outcomeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paris-signature': signature,
    },
    body: bodyText,
  });

  if (!res.ok) {
    const details = await readJson(res);
    return json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', status: res.status, details }, { status: 502 });
  }

  const data = await readJson(res);
  return json({ ok: true, upstream: data });
}

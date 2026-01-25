import {
  resolvePolicy,
  resolveAiAgent,
  resolveAiBudgets,
  resolveAiPolicyCapsule,
  isPolicyEntitled,
} from '@clickeen/ck-policy';
import type { Policy, PolicyProfile } from '@clickeen/ck-policy';
import type { AIGrant, Env, WorkspaceRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { assertDevAuth } from '../../shared/auth';
import { asTrimmedString, isRecord, isUuid } from '../../shared/validation';
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
  const exp = nowSec + 60;

  const grantPayload: AIGrant = {
    v: 1,
    iss: 'paris',
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

export async function handleAiMinibobGrant(req: Request, env: Env) {
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
  const widgetType = asTrimmedString((body as any).widgetType);
  if (!sessionId) {
    return json([{ path: 'sessionId', message: 'sessionId is required' }], { status: 422 });
  }
  if (!widgetType) {
    return json([{ path: 'widgetType', message: 'widgetType is required' }], { status: 422 });
  }

  const workspaceIdRaw = asTrimmedString((body as any).workspaceId);
  if (workspaceIdRaw) {
    return json([{ path: 'workspaceId', message: 'workspaceId is not allowed for minibob grants' }], { status: 403 });
  }

  const agentIdRaw = asTrimmedString((body as any).agentId);
  if (agentIdRaw && agentIdRaw !== 'sdr.widget.copilot.v1') {
    return json([{ path: 'agentId', message: 'agentId is not allowed for minibob grants' }], { status: 403 });
  }

  const modeRaw = asTrimmedString((body as any).mode);
  if (modeRaw && modeRaw !== 'ops') {
    return json([{ path: 'mode', message: 'mode is not allowed for minibob grants' }], { status: 403 });
  }

  const issued = await issueAiGrant({
    env,
    agentId: 'sdr.widget.copilot.v1',
    mode: 'ops',
    subject: 'minibob',
    trace: { sessionId },
    budgets: { maxTokens: 420, timeoutMs: 12_000, maxRequests: 2 },
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

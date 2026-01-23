import type { AIGrant, Env, ExecuteRequest, ExecuteResponse, InteractionEvent, OutcomeAttachRequest, Usage } from './types';
import { listAiAgents, resolveAiAgent } from '@clickeen/ck-policy';
import { HttpError, json, noStore, readJson, asString, isRecord } from './http';
import { assertCap, verifyGrant } from './grants';
import { executeSdrCopilot } from './agents/sdrCopilot';
import { executeDebugGrantProbe } from './agents/debugGrantProbe';
import { executeSdrWidgetCopilot } from './agents/sdrWidgetCopilot';
import { executeL10nJob, isL10nJob, type L10nJob } from './agents/l10nInstance';
import { executePragueStringsTranslate, isPragueStringsJob } from './agents/l10nPragueStrings';
import { executePersonalizationPreview, type PersonalizationPreviewInput, type PersonalizationPreviewResult } from './agents/personalizationPreview';
import { executePersonalizationOnboarding, type PersonalizationOnboardingInput, type PersonalizationOnboardingResult } from './agents/personalizationOnboarding';

const MAX_INFLIGHT_PER_ISOLATE = 8;
let inflight = 0;

let d1SchemaReady = false;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

function previewJobKey(jobId: string): string {
  return `personalization:preview:${jobId}`;
}

function onboardingJobKey(jobId: string): string {
  return `personalization:onboarding:${jobId}`;
}

function normalizeOverrideKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return PREVIEW_DEFAULT_OVERRIDES.slice();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || !PREVIEW_OVERRIDE_KEY_RE.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= 12) break;
  }
  return out.length ? out : PREVIEW_DEFAULT_OVERRIDES.slice();
}

async function loadPreviewJob(env: Env, jobId: string): Promise<PreviewJobRecord | null> {
  const stored = await env.SF_KV.get(previewJobKey(jobId), 'json').catch(() => null);
  if (!stored || !isRecord(stored)) return null;
  if (stored.v !== 1) return null;
  return stored as PreviewJobRecord;
}

async function savePreviewJob(env: Env, record: PreviewJobRecord): Promise<void> {
  await env.SF_KV.put(previewJobKey(record.jobId), JSON.stringify(record), { expirationTtl: PREVIEW_JOB_TTL_SEC });
}

async function loadOnboardingJob(env: Env, jobId: string): Promise<OnboardingJobRecord | null> {
  const stored = await env.SF_KV.get(onboardingJobKey(jobId), 'json').catch(() => null);
  if (!stored || !isRecord(stored)) return null;
  if (stored.v !== 1) return null;
  return stored as OnboardingJobRecord;
}

async function saveOnboardingJob(env: Env, record: OnboardingJobRecord): Promise<void> {
  await env.SF_KV.put(onboardingJobKey(record.jobId), JSON.stringify(record), { expirationTtl: ONBOARDING_JOB_TTL_SEC });
}

function assertInternalAuth(request: Request, env: Env): void {
  const expected = asTrimmedString(env.PARIS_DEV_JWT);
  if (!expected) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Missing PARIS_DEV_JWT' });
  }
  const auth = asTrimmedString(request.headers.get('Authorization'));
  const [scheme, token] = auth ? auth.split(' ') : [];
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, { code: 'CAPABILITY_DENIED', message: 'Missing auth token' });
  }
  if (token.trim() !== expected) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'Invalid auth token' });
  }
}

async function persistWorkspaceBusinessProfile(args: {
  env: Env;
  workspaceId: string;
  profile: Record<string, unknown>;
  sources?: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const baseUrl = asTrimmedString(args.env.PARIS_BASE_URL);
  if (!baseUrl) {
    return { ok: false, message: 'Missing PARIS_BASE_URL' };
  }
  const token = asTrimmedString(args.env.PARIS_DEV_JWT);
  if (!token) {
    return { ok: false, message: 'Missing PARIS_DEV_JWT' };
  }

  const url = new URL(`/api/workspaces/${encodeURIComponent(args.workspaceId)}/business-profile`, baseUrl).toString();
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        profile: args.profile,
        ...(args.sources ? { sources: args.sources } : {}),
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Paris request failed: ${message}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, message: `Paris returned ${res.status}: ${text || 'error'}` };
  }

  return { ok: true };
}

function toIsoDay(ms: number): string {
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function promptHasUrl(input: unknown): boolean {
  if (!isRecord(input)) return false;
  const prompt = asTrimmedString(input.prompt);
  if (!prompt) return false;
  return /\bhttps?:\/\/[^\s<>"')]+/i.test(prompt) || /\b([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s<>"')]+)?\b/i.test(prompt);
}

function inferScopeFromPath(controlPath: string): 'stage' | 'pod' | 'content' {
  if (controlPath.startsWith('stage.')) return 'stage';
  if (controlPath.startsWith('pod.')) return 'pod';
  return 'content';
}

const OUTCOME_EVENTS = new Set([
  'signup_started',
  'signup_completed',
  'upgrade_clicked',
  'upgrade_completed',
  'cta_clicked',
  'ux_keep',
  'ux_undo',
]);

type PreviewJobStatus = 'queued' | 'running' | 'completed' | 'failed';

type PreviewJobRecord = {
  v: 1;
  jobId: string;
  status: PreviewJobStatus;
  createdAtMs: number;
  updatedAtMs: number;
  input: PersonalizationPreviewInput;
  result?: PersonalizationPreviewResult;
  usage?: Usage;
  error?: { message: string };
};

const PREVIEW_JOB_TTL_SEC = 60 * 20;
const PREVIEW_DEFAULT_OVERRIDES = ['heroTitle', 'heroSubtitle', 'sectionTitle', 'ctaText'];
const PREVIEW_OVERRIDE_KEY_RE = /^[a-zA-Z0-9._-]{1,40}$/;

type OnboardingJobStatus = 'queued' | 'running' | 'completed' | 'failed';

type OnboardingJobRecord = {
  v: 1;
  jobId: string;
  status: OnboardingJobStatus;
  createdAtMs: number;
  updatedAtMs: number;
  input: PersonalizationOnboardingInput;
  result?: PersonalizationOnboardingResult;
  usage?: Usage;
  error?: { message: string };
  persisted?: boolean;
  persistError?: string;
};

const ONBOARDING_JOB_TTL_SEC = 60 * 30;

type AgentExecutor = (args: { grant: AIGrant; input: unknown }, env: Env) => Promise<{ result: unknown; usage: any }>;

const AGENT_EXECUTORS: Record<string, AgentExecutor> = {
  'sdr.copilot': executeSdrCopilot,
  'cs.copilot.v1': executeSdrWidgetCopilot,
  'debug.grantProbe': executeDebugGrantProbe,
};

const EXECUTABLE_AGENT_IDS = new Set(
  listAiAgents()
    .filter((entry) => entry.executionSurface === 'execute')
    .map((entry) => entry.agentId),
);

for (const agentId of EXECUTABLE_AGENT_IDS) {
  if (!AGENT_EXECUTORS[agentId]) {
    throw new Error(`[sanfrancisco] Missing executor for agentId: ${agentId}`);
  }
}

for (const agentId of Object.keys(AGENT_EXECUTORS)) {
  const resolved = resolveAiAgent(agentId);
  if (!resolved) {
    throw new Error(`[sanfrancisco] Executor has no registry entry: ${agentId}`);
  }
  if (resolved.entry.executionSurface !== 'execute') {
    throw new Error(`[sanfrancisco] Executor registered for non-execute agent: ${agentId}`);
  }
}

function isOutcomeAttachRequest(value: unknown): value is OutcomeAttachRequest {
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

  if (timeToDecisionMs !== undefined && (typeof timeToDecisionMs !== 'number' || !Number.isFinite(timeToDecisionMs) || timeToDecisionMs < 0)) {
    return false;
  }
  if (accountIdHash !== undefined && (typeof accountIdHash !== 'string' || !accountIdHash.trim())) return false;
  if (workspaceIdHash !== undefined && (typeof workspaceIdHash !== 'string' || !workspaceIdHash.trim())) return false;

  return true;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let out = 0;
  for (let i = 0; i < aBytes.length; i++) out |= aBytes[i] ^ bBytes[i];
  return out === 0;
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return base64UrlEncodeBytes(new Uint8Array(sig));
}

async function verifyOutcomeSignature(args: { request: Request; env: Env; bodyText: string }): Promise<void> {
  const provided = asTrimmedString(args.request.headers.get('x-paris-signature'));
  if (!provided) {
    throw new HttpError(401, { code: 'CAPABILITY_DENIED', message: 'Missing signature' });
  }
  const secret = asTrimmedString(args.env.AI_GRANT_HMAC_SECRET);
  if (!secret) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Missing AI_GRANT_HMAC_SECRET' });
  }
  const expected = await hmacSha256Base64Url(secret, `outcome.v1.${args.bodyText}`);
  if (!timingSafeEqual(provided, expected)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'Invalid signature' });
  }
}

async function ensureD1Schema(env: Env): Promise<void> {
  if (d1SchemaReady) return;
  try {
    await env.SF_D1.prepare(
      `CREATE TABLE IF NOT EXISTS copilot_events_v1 (
        requestId TEXT PRIMARY KEY NOT NULL,
        day TEXT NOT NULL,
        occurredAtMs INTEGER NOT NULL,
        runtimeEnv TEXT,
        envStage TEXT,
        sessionId TEXT,
        instancePublicId TEXT,
        agentId TEXT NOT NULL,
        widgetType TEXT,
        intent TEXT,
        outcome TEXT,
        hasUrl INTEGER,
        controlCount INTEGER,
        opsCount INTEGER,
        uniquePathsTouched INTEGER,
        scopesTouched TEXT,
        ctaAction TEXT,
        promptVersion TEXT,
        policyVersion TEXT,
        dictionaryHash TEXT,
        aiProfile TEXT,
        taskClass TEXT,
        provider TEXT,
        model TEXT,
        latencyMs INTEGER
      )`,
    ).run();

    const maybeAddColumn = async (sql: string) => {
      try {
        await env.SF_D1.prepare(sql).run();
      } catch {
        // best-effort migration; ignore if the column already exists
      }
    };
    await maybeAddColumn(`ALTER TABLE copilot_events_v1 ADD COLUMN sessionId TEXT`);
    await maybeAddColumn(`ALTER TABLE copilot_events_v1 ADD COLUMN instancePublicId TEXT`);
    await maybeAddColumn(`ALTER TABLE copilot_events_v1 ADD COLUMN aiProfile TEXT`);
    await maybeAddColumn(`ALTER TABLE copilot_events_v1 ADD COLUMN taskClass TEXT`);

    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_agent ON copilot_events_v1(day, agentId)`).run();
    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_stage ON copilot_events_v1(day, envStage)`).run();
    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_widget ON copilot_events_v1(day, widgetType)`).run();
    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_session ON copilot_events_v1(day, sessionId)`).run();
    await env.SF_D1.prepare(
      `CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_intent_outcome ON copilot_events_v1(day, intent, outcome)`,
    ).run();

    await env.SF_D1.prepare(
      `CREATE TABLE IF NOT EXISTS copilot_outcomes_v1 (
        requestId TEXT NOT NULL,
        event TEXT NOT NULL,
        day TEXT NOT NULL,
        occurredAtMs INTEGER NOT NULL,
        sessionId TEXT NOT NULL,
        timeToDecisionMs INTEGER,
        accountIdHash TEXT,
        workspaceIdHash TEXT,
        PRIMARY KEY (requestId, event)
      )`,
    ).run();
    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_v1_day_event ON copilot_outcomes_v1(day, event)`).run();
    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_v1_request ON copilot_outcomes_v1(requestId)`).run();
    d1SchemaReady = true;
  } catch (err) {
    console.error('[sanfrancisco] ensureD1Schema failed', err);
  }
}

async function indexCopilotEvent(env: Env, e: InteractionEvent): Promise<void> {
  const runtimeEnv = asTrimmedString(env.ENVIRONMENT) ?? 'unknown';
  const envStage = isRecord(e.trace) ? asTrimmedString((e.trace as any).envStage) : null;
  const sessionId = isRecord(e.trace) ? asTrimmedString((e.trace as any).sessionId) : null;
  const instancePublicId = isRecord(e.trace) ? asTrimmedString((e.trace as any).instancePublicId) : null;

  const day = toIsoDay(e.occurredAtMs);
  const agentId = e.agentId;

  let widgetType: string | null = null;
  let controlCount: number | null = null;
  let hasUrl = 0;

  if (isRecord(e.input)) {
    widgetType = asTrimmedString((e.input as any).widgetType);
    const controls = (e.input as any).controls;
    controlCount = Array.isArray(controls) ? controls.length : null;
    hasUrl = promptHasUrl(e.input) ? 1 : 0;
  }

  let intent: string | null = null;
  let outcome: string | null = null;
  let promptVersion: string | null = null;
  let policyVersion: string | null = null;
  let dictionaryHash: string | null = null;

  let ctaAction: string | null = null;
  let opsCount: number | null = null;
  let uniquePathsTouched: number | null = null;
  let scopesTouched: string | null = null;

  if (isRecord(e.result)) {
    const meta = isRecord((e.result as any).meta) ? ((e.result as any).meta as any) : null;
    intent = meta ? asTrimmedString(meta.intent) : null;
    outcome = meta ? asTrimmedString(meta.outcome) : null;
    promptVersion = meta ? asTrimmedString(meta.promptVersion) : null;
    policyVersion = meta ? asTrimmedString(meta.policyVersion) : null;
    dictionaryHash = meta ? asTrimmedString(meta.dictionaryHash) : null;

    const cta = isRecord((e.result as any).cta) ? ((e.result as any).cta as any) : null;
    ctaAction = cta ? asTrimmedString(cta.action) : null;

    const opsRaw = (e.result as any).ops;
    if (Array.isArray(opsRaw)) {
      const paths = new Set<string>();
      const scopes = new Set<string>();
      let count = 0;
      for (const op of opsRaw) {
        if (!isRecord(op)) continue;
        const path = asTrimmedString((op as any).path);
        if (!path) continue;
        count += 1;
        paths.add(path);
        scopes.add(inferScopeFromPath(path));
      }
      opsCount = count;
      uniquePathsTouched = paths.size;
      scopesTouched = JSON.stringify(Array.from(scopes));
      if (!outcome) outcome = count > 0 ? 'ops_applied' : 'no_ops';
    } else if (!outcome) {
      outcome = 'no_ops';
    }
  }

  const provider = asTrimmedString(e.usage?.provider) ?? null;
  const model = asTrimmedString(e.usage?.model) ?? null;
  const latencyMs = typeof e.usage?.latencyMs === 'number' && Number.isFinite(e.usage.latencyMs) ? e.usage.latencyMs : null;
  const aiProfile = asTrimmedString(e.ai?.profile) ?? null;
  const taskClass = asTrimmedString(e.ai?.taskClass) ?? null;

  try {
    await env.SF_D1.prepare(
      `INSERT OR REPLACE INTO copilot_events_v1
      (requestId, day, occurredAtMs, runtimeEnv, envStage, sessionId, instancePublicId, agentId, widgetType, intent, outcome, hasUrl, controlCount, opsCount, uniquePathsTouched, scopesTouched, ctaAction, promptVersion, policyVersion, dictionaryHash, aiProfile, taskClass, provider, model, latencyMs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        e.requestId,
        day,
        e.occurredAtMs,
        runtimeEnv,
        envStage,
        sessionId,
        instancePublicId,
        agentId,
        widgetType,
        intent,
        outcome,
        hasUrl,
        controlCount,
        opsCount,
        uniquePathsTouched,
        scopesTouched,
        ctaAction,
        promptVersion,
        policyVersion,
        dictionaryHash,
        aiProfile,
        taskClass,
        provider,
        model,
        latencyMs,
      )
      .run();
  } catch (err) {
    console.error('[sanfrancisco] D1 index insert failed', err);
  }
}

function isExecuteRequest(value: unknown): value is ExecuteRequest {
  if (!isRecord(value)) return false;
  return typeof value.grant === 'string' && typeof value.agentId === 'string';
}

function okHealth(env: Env): Response {
  return noStore(
    json({
      ok: true,
      service: 'sanfrancisco',
      env: env.ENVIRONMENT ?? 'unknown',
      ts: Date.now(),
    }),
  );
}

async function handleExecute(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (inflight >= MAX_INFLIGHT_PER_ISOLATE) {
    throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Service concurrency limit reached' });
  }

  inflight++;
  try {
    const body = await readJson(request);
    if (!isExecuteRequest(body)) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid request', issues: [{ path: '', message: 'Expected { grant, agentId, input }' }] });
    }

    const grant: AIGrant = await verifyGrant(body.grant, env.AI_GRANT_HMAC_SECRET);
    const resolvedAgent = resolveAiAgent(body.agentId);
    if (!resolvedAgent) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${body.agentId}` });
    }
    const canonicalId = resolvedAgent.canonicalId;
    if (resolvedAgent.entry.executionSurface !== 'execute') {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Agent not executable via /v1/execute: ${canonicalId}` });
    }
    assertCap(grant, `agent:${canonicalId}`);

    const requestId = asString(body.trace?.requestId) ?? crypto.randomUUID();
    const occurredAtMs = Date.now();

    const executor = AGENT_EXECUTORS[canonicalId];
    if (!executor) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${canonicalId}` });
    }
    const executed = await executor({ grant, input: body.input }, env);

    const event: InteractionEvent = {
      v: 1,
      requestId,
      agentId: canonicalId,
      occurredAtMs,
      subject: grant.sub,
      trace: grant.trace,
      ai: {
        profile: grant.ai?.profile,
        taskClass: resolvedAgent.entry.taskClass,
      },
      input: body.input,
      result: executed.result,
      usage: executed.usage,
    };

    ctx.waitUntil(
      env.SF_EVENTS.send(event).catch((err: unknown) => {
        console.error('[sanfrancisco] SF_EVENTS.send failed', err);
      }),
    );

    const response: ExecuteResponse = { requestId, agentId: canonicalId, result: executed.result, usage: executed.usage };
    return noStore(json(response));
  } finally {
    inflight--;
  }
}

async function handleOutcome(request: Request, env: Env): Promise<Response> {
  const bodyText = await request.text();
  await verifyOutcomeSignature({ request, env, bodyText });

  let body: unknown;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
  }

  if (!isOutcomeAttachRequest(body)) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Invalid request',
      issues: [{ path: '', message: 'Expected { requestId, sessionId, event, occurredAtMs }' }],
    });
  }

  await ensureD1Schema(env);
  const day = toIsoDay(body.occurredAtMs);

  try {
    await env.SF_D1.prepare(
      `INSERT OR REPLACE INTO copilot_outcomes_v1
      (requestId, event, day, occurredAtMs, sessionId, timeToDecisionMs, accountIdHash, workspaceIdHash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        body.requestId,
        body.event,
        day,
        body.occurredAtMs,
        body.sessionId,
        body.timeToDecisionMs ?? null,
        body.accountIdHash ?? null,
        body.workspaceIdHash ?? null,
      )
      .run();
  } catch (err) {
    console.error('[sanfrancisco] outcome insert failed', err);
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Failed to persist outcome' });
  }

  return noStore(json({ ok: true }));
}

async function handleL10nDispatch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const environment = asTrimmedString(env.ENVIRONMENT);
  if (environment !== 'local') {
    throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
  }

  const expected = asTrimmedString(env.PARIS_DEV_JWT);
  if (!expected) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Missing PARIS_DEV_JWT' });
  }

  const auth = asTrimmedString(request.headers.get('Authorization'));
  const [scheme, token] = auth ? auth.split(' ') : [];
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, { code: 'CAPABILITY_DENIED', message: 'Missing auth token' });
  }
  if (token.trim() !== expected) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'Invalid auth token' });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
  }

  let jobs: unknown[] = [];
  if (Array.isArray(payload)) {
    jobs = payload;
  } else if (isRecord(payload)) {
    if (Array.isArray(payload.jobs)) jobs = payload.jobs;
    else if (payload.job) jobs = [payload.job];
    else jobs = [payload];
  }

  if (!jobs.length) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'No jobs provided' });
  }

  const invalid = jobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => !isL10nJob(job))
    .map(({ index }) => ({ path: `jobs[${index}]`, message: 'invalid l10n job' }));
  if (invalid.length) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid l10n jobs', issues: invalid });
  }

  for (const job of jobs as L10nJob[]) {
    ctx.waitUntil(
      executeL10nJob(job, env).catch((err: unknown) => {
        console.error('[sanfrancisco] l10n dispatch failed', err);
      }),
    );
  }

  return noStore(json({ ok: true, queued: jobs.length }));
}

async function handlePragueStringsTranslate(request: Request, env: Env): Promise<Response> {
  if (inflight >= MAX_INFLIGHT_PER_ISOLATE) {
    throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Service concurrency limit reached' });
  }

  inflight++;
  try {
    const environment = asTrimmedString(env.ENVIRONMENT);
    if (environment !== 'local') {
      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    }

    const expected = asTrimmedString(env.PARIS_DEV_JWT);
    if (!expected) {
      throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Missing PARIS_DEV_JWT' });
    }

    const auth = asTrimmedString(request.headers.get('Authorization'));
    const [scheme, token] = auth ? auth.split(' ') : [];
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      throw new HttpError(401, { code: 'CAPABILITY_DENIED', message: 'Missing auth token' });
    }
    if (token.trim() !== expected) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'Invalid auth token' });
    }

    const body = await readJson(request);
    const payload = isRecord(body) && isRecord((body as any).job) ? (body as any).job : body;
    if (!isPragueStringsJob(payload)) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid l10n translate job' });
    }

    const result = await executePragueStringsTranslate(payload, env);
    return noStore(json(result));
  } finally {
    inflight--;
  }
}

async function runPersonalizationPreviewJob(args: { env: Env; jobId: string; grant: AIGrant; input: PersonalizationPreviewInput }): Promise<void> {
  const existing = await loadPreviewJob(args.env, args.jobId);
  const baseRecord: PreviewJobRecord =
    existing ?? ({
      v: 1,
      jobId: args.jobId,
      status: 'queued',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      input: args.input,
    } as PreviewJobRecord);

  const runningRecord: PreviewJobRecord = { ...baseRecord, status: 'running', updatedAtMs: Date.now() };
  await savePreviewJob(args.env, runningRecord);

  try {
    const { result, usage } = await executePersonalizationPreview({ env: args.env, grant: args.grant, input: args.input });
    const completed: PreviewJobRecord = {
      ...runningRecord,
      status: 'completed',
      result,
      usage,
      error: undefined,
      updatedAtMs: Date.now(),
    };
    await savePreviewJob(args.env, completed);
  } catch (err) {
    const message = err instanceof HttpError ? err.error?.message ?? err.message : err instanceof Error ? err.message : 'Unknown error';
    const failed: PreviewJobRecord = {
      ...runningRecord,
      status: 'failed',
      error: { message },
      updatedAtMs: Date.now(),
    };
    await savePreviewJob(args.env, failed);
  }
}

async function handlePersonalizationPreviewCreate(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  assertInternalAuth(request, env);

  const payload = await readJson(request);
  if (!isRecord(payload)) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
  }

  const url = asTrimmedString((payload as any).url);
  if (!url) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing url' });
  }

  const agentId = asTrimmedString((payload as any).agentId) ?? 'agent.personalization.preview.v1';
  if (agentId !== 'agent.personalization.preview.v1') {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Unsupported agentId' });
  }

  const grantRaw = asTrimmedString((payload as any).grant);
  if (!grantRaw) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing grant' });
  }

  const grant = await verifyGrant(grantRaw, env.AI_GRANT_HMAC_SECRET);
  assertCap(grant, `agent:${agentId}`);

  const locale = asTrimmedString((payload as any).locale);
  const templateContext = isRecord((payload as any).templateContext) ? ((payload as any).templateContext as Record<string, unknown>) : undefined;
  const allowedOverrides = normalizeOverrideKeys((payload as any).allowedOverrides);

  const jobId = crypto.randomUUID();
  const now = Date.now();
  const input: PersonalizationPreviewInput = {
    url,
    ...(locale ? { locale } : {}),
    ...(templateContext ? { templateContext } : {}),
    allowedOverrides,
  };

  const record: PreviewJobRecord = {
    v: 1,
    jobId,
    status: 'queued',
    createdAtMs: now,
    updatedAtMs: now,
    input,
  };
  await savePreviewJob(env, record);

  ctx.waitUntil(runPersonalizationPreviewJob({ env, jobId, grant, input }));
  return noStore(json({ jobId }));
}

async function handlePersonalizationPreviewStatus(request: Request, env: Env, jobId: string): Promise<Response> {
  assertInternalAuth(request, env);
  const record = await loadPreviewJob(env, jobId);
  if (!record) {
    throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Job not found' });
  }

  return noStore(
    json({
      jobId: record.jobId,
      status: record.status,
      ...(record.result ? { result: record.result } : {}),
      ...(record.error ? { error: record.error } : {}),
      updatedAtMs: record.updatedAtMs,
    }),
  );
}

async function runPersonalizationOnboardingJob(args: {
  env: Env;
  jobId: string;
  grant: AIGrant;
  input: PersonalizationOnboardingInput;
}): Promise<void> {
  const existing = await loadOnboardingJob(args.env, args.jobId);
  const baseRecord: OnboardingJobRecord =
    existing ?? ({
      v: 1,
      jobId: args.jobId,
      status: 'queued',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      input: args.input,
    } as OnboardingJobRecord);

  const runningRecord: OnboardingJobRecord = { ...baseRecord, status: 'running', updatedAtMs: Date.now() };
  await saveOnboardingJob(args.env, runningRecord);

  try {
    const { result, usage } = await executePersonalizationOnboarding({ env: args.env, grant: args.grant, input: args.input });
    const sourcesMeta: Record<string, unknown> = {
      sourcesUsed: result.sourcesUsed,
      confidence: result.confidence,
      ...(result.recommendations ? { recommendations: result.recommendations } : {}),
      ...(result.notes ? { notes: result.notes } : {}),
      inputUrl: args.input.url,
      locale: args.input.locale ?? null,
      agentId: 'agent.personalization.onboarding.v1',
    };

    const persist = await persistWorkspaceBusinessProfile({
      env: args.env,
      workspaceId: args.input.workspaceId,
      profile: result.businessProfile,
      sources: sourcesMeta,
    });

    const completed: OnboardingJobRecord = {
      ...runningRecord,
      status: 'completed',
      result,
      usage,
      persisted: persist.ok,
      ...(persist.ok ? {} : { persistError: persist.message }),
      updatedAtMs: Date.now(),
    };
    await saveOnboardingJob(args.env, completed);
  } catch (err) {
    const message = err instanceof HttpError ? err.error?.message ?? err.message : err instanceof Error ? err.message : 'Unknown error';
    const failed: OnboardingJobRecord = {
      ...runningRecord,
      status: 'failed',
      error: { message },
      updatedAtMs: Date.now(),
    };
    await saveOnboardingJob(args.env, failed);
  }
}

async function handlePersonalizationOnboardingCreate(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  assertInternalAuth(request, env);

  const payload = await readJson(request);
  if (!isRecord(payload)) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
  }

  const grantRaw = asTrimmedString((payload as any).grant);
  if (!grantRaw) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing grant' });
  }

  const agentId = asTrimmedString((payload as any).agentId) ?? 'agent.personalization.onboarding.v1';
  if (agentId !== 'agent.personalization.onboarding.v1') {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Unsupported agentId' });
  }

  const workspaceId = asTrimmedString((payload as any).workspaceId);
  const url = asTrimmedString((payload as any).url);
  if (!workspaceId || !url) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing workspaceId or url' });
  }

  const grant = await verifyGrant(grantRaw, env.AI_GRANT_HMAC_SECRET);
  assertCap(grant, `agent:${agentId}`);

  const input: PersonalizationOnboardingInput = {
    workspaceId,
    url,
    ...(typeof (payload as any).locale === 'string' ? { locale: (payload as any).locale } : {}),
    ...(typeof (payload as any).websiteDepth === 'number' ? { websiteDepth: (payload as any).websiteDepth } : {}),
    ...(typeof (payload as any).gbpPlaceId === 'string' ? { gbpPlaceId: (payload as any).gbpPlaceId } : {}),
    ...(typeof (payload as any).facebookPageId === 'string' ? { facebookPageId: (payload as any).facebookPageId } : {}),
    ...(typeof (payload as any).instagramHandle === 'string' ? { instagramHandle: (payload as any).instagramHandle } : {}),
  };

  const jobId = crypto.randomUUID();
  const now = Date.now();
  const record: OnboardingJobRecord = {
    v: 1,
    jobId,
    status: 'queued',
    createdAtMs: now,
    updatedAtMs: now,
    input,
  };
  await saveOnboardingJob(env, record);

  ctx.waitUntil(runPersonalizationOnboardingJob({ env, jobId, grant, input }));
  return noStore(json({ jobId }));
}

async function handlePersonalizationOnboardingStatus(request: Request, env: Env, jobId: string): Promise<Response> {
  assertInternalAuth(request, env);
  const record = await loadOnboardingJob(env, jobId);
  if (!record) {
    throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Job not found' });
  }

  return noStore(
    json({
      jobId: record.jobId,
      status: record.status,
      ...(record.result ? { result: record.result } : {}),
      ...(record.error ? { error: record.error } : {}),
      ...(record.persisted === false ? { persistError: record.persistError } : {}),
      updatedAtMs: record.updatedAtMs,
    }),
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/healthz') return okHealth(env);
      if (request.method === 'POST' && url.pathname === '/v1/execute') return await handleExecute(request, env, ctx);
      if (request.method === 'POST' && url.pathname === '/v1/outcome') return await handleOutcome(request, env);
      if (request.method === 'POST' && url.pathname === '/v1/personalization/preview') {
        return await handlePersonalizationPreviewCreate(request, env, ctx);
      }
      const previewStatusMatch = url.pathname.match(/^\/v1\/personalization\/preview\/([^/]+)$/);
      if (previewStatusMatch && request.method === 'GET') {
        const jobId = decodeURIComponent(previewStatusMatch[1]);
        return await handlePersonalizationPreviewStatus(request, env, jobId);
      }
      if (request.method === 'POST' && url.pathname === '/v1/personalization/onboarding') {
        return await handlePersonalizationOnboardingCreate(request, env, ctx);
      }
      const onboardingStatusMatch = url.pathname.match(/^\/v1\/personalization\/onboarding\/([^/]+)$/);
      if (onboardingStatusMatch && request.method === 'GET') {
        const jobId = decodeURIComponent(onboardingStatusMatch[1]);
        return await handlePersonalizationOnboardingStatus(request, env, jobId);
      }
      if (request.method === 'POST' && url.pathname === '/v1/l10n') return await handleL10nDispatch(request, env, ctx);
      if (request.method === 'POST' && url.pathname === '/v1/l10n/translate') return await handlePragueStringsTranslate(request, env);

      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    } catch (err: unknown) {
      if (err instanceof HttpError) return noStore(json({ error: err.error }, { status: err.status }));
      console.error('[sanfrancisco] Unhandled error', err);
      return noStore(json({ error: { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Unhandled error' } }, { status: 500 }));
    }
  },

  async queue(batch: MessageBatch<InteractionEvent | L10nJob>, env: Env): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await ensureD1Schema(env);
    for (const msg of batch.messages) {
      const body = msg.body;
      if (isL10nJob(body)) {
        try {
          await executeL10nJob(body, env);
        } catch (err) {
          console.error('[sanfrancisco] l10n job failed', err);
        }
        continue;
      }
      const e = body as InteractionEvent;
      const key = `logs/${env.ENVIRONMENT ?? 'unknown'}/${e.agentId}/${today}/${e.requestId}.json`;
      await env.SF_R2.put(key, JSON.stringify(e), { httpMetadata: { contentType: 'application/json' } });
      await indexCopilotEvent(env, e);
    }
  },
};

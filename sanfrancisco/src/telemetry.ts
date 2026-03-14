import { HttpError, isRecord } from './http';
import { asTrimmedString } from './internalAuth';
import type { Env, InteractionEvent, OutcomeAttachRequest } from './types';

let d1SchemaReady = false;

const OUTCOME_EVENTS = new Set([
  'signup_started',
  'signup_completed',
  'upgrade_clicked',
  'upgrade_completed',
  'cta_clicked',
  'ux_keep',
  'ux_undo',
]);

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

export function isOutcomeAttachRequest(value: unknown): value is OutcomeAttachRequest {
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

export async function verifyOutcomeSignature(args: { request: Request; env: Env; bodyText: string }): Promise<void> {
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

export async function ensureD1Schema(env: Env): Promise<void> {
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

export async function indexCopilotEvent(env: Env, e: InteractionEvent): Promise<void> {
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

export async function persistOutcomeAttach(env: Env, body: OutcomeAttachRequest): Promise<void> {
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
}

import type { AIGrant, Env, ExecuteRequest, ExecuteResponse, InteractionEvent } from './types';
import { HttpError, json, noStore, readJson, asString, isRecord } from './http';
import { assertCap, verifyGrant } from './grants';
import { executeSdrCopilot } from './agents/sdrCopilot';
import { executeEditorFaqAnswer } from './agents/editorFaqAnswer';
import { executeDebugGrantProbe } from './agents/debugGrantProbe';
import { executeSdrWidgetCopilot } from './agents/sdrWidgetCopilot';

const MAX_INFLIGHT_PER_ISOLATE = 8;
let inflight = 0;

let d1SchemaReady = false;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
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
        provider TEXT,
        model TEXT,
        latencyMs INTEGER
      )`,
    ).run();
    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_agent ON copilot_events_v1(day, agentId)`).run();
    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_stage ON copilot_events_v1(day, envStage)`).run();
    await env.SF_D1.prepare(`CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_widget ON copilot_events_v1(day, widgetType)`).run();
    await env.SF_D1.prepare(
      `CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_intent_outcome ON copilot_events_v1(day, intent, outcome)`,
    ).run();
    d1SchemaReady = true;
  } catch (err) {
    console.error('[sanfrancisco] ensureD1Schema failed', err);
  }
}

async function indexCopilotEvent(env: Env, e: InteractionEvent): Promise<void> {
  const runtimeEnv = asTrimmedString(env.ENVIRONMENT) ?? 'unknown';
  const envStage = isRecord(e.trace) ? asTrimmedString((e.trace as any).envStage) : null;

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

  try {
    await env.SF_D1.prepare(
      `INSERT OR REPLACE INTO copilot_events_v1
      (requestId, day, occurredAtMs, runtimeEnv, envStage, agentId, widgetType, intent, outcome, hasUrl, controlCount, opsCount, uniquePathsTouched, scopesTouched, ctaAction, promptVersion, policyVersion, dictionaryHash, provider, model, latencyMs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        e.requestId,
        day,
        e.occurredAtMs,
        runtimeEnv,
        envStage,
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
    assertCap(grant, `agent:${body.agentId}`);

    const requestId = asString(body.trace?.requestId) ?? crypto.randomUUID();
    const occurredAtMs = Date.now();

    const executed =
      body.agentId === 'sdr.copilot'
        ? await executeSdrCopilot({ grant, input: body.input }, env)
        : body.agentId === 'sdr.widget.copilot.v1'
          ? await executeSdrWidgetCopilot({ grant, input: body.input }, env)
        : body.agentId === 'editor.faq.answer.v1'
          ? await executeEditorFaqAnswer({ grant, input: body.input }, env)
          : body.agentId === 'debug.grantProbe'
            ? await executeDebugGrantProbe({ grant, input: body.input }, env)
          : null;

    if (!executed) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${body.agentId}` });
    }

    const event: InteractionEvent = {
      v: 1,
      requestId,
      agentId: body.agentId,
      occurredAtMs,
      subject: grant.sub,
      trace: grant.trace,
      input: body.input,
      result: executed.result,
      usage: executed.usage,
    };

    ctx.waitUntil(
      env.SF_EVENTS.send(event).catch((err: unknown) => {
        console.error('[sanfrancisco] SF_EVENTS.send failed', err);
      }),
    );

    const response: ExecuteResponse = { requestId, agentId: body.agentId, result: executed.result, usage: executed.usage };
    return noStore(json(response));
  } finally {
    inflight--;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/healthz') return okHealth(env);
      if (request.method === 'POST' && url.pathname === '/v1/execute') return await handleExecute(request, env, ctx);

      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    } catch (err: unknown) {
      if (err instanceof HttpError) return noStore(json({ error: err.error }, { status: err.status }));
      console.error('[sanfrancisco] Unhandled error', err);
      return noStore(json({ error: { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Unhandled error' } }, { status: 500 }));
    }
  },

  async queue(batch: MessageBatch<InteractionEvent>, env: Env): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await ensureD1Schema(env);
    for (const msg of batch.messages) {
      const e = msg.body;
      const key = `logs/${env.ENVIRONMENT ?? 'unknown'}/${e.agentId}/${today}/${e.requestId}.json`;
      await env.SF_R2.put(key, JSON.stringify(e), { httpMetadata: { contentType: 'application/json' } });
      await indexCopilotEvent(env, e);
    }
  },
};

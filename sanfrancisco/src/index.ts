import type { AIGrant, Env, ExecuteRequest, ExecuteResponse, InteractionEvent } from './types';
import { HttpError, json, noStore, readJson, asString, isRecord } from './http';
import { assertCap, verifyGrant } from './grants';
import { executeSdrCopilot } from './agents/sdrCopilot';

const MAX_INFLIGHT_PER_ISOLATE = 8;
let inflight = 0;

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

    if (body.agentId !== 'sdr.copilot') {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${body.agentId}` });
    }

    const { result, usage } = await executeSdrCopilot({ grant, input: body.input }, env);

    const event: InteractionEvent = {
      v: 1,
      requestId,
      agentId: body.agentId,
      occurredAtMs,
      subject: grant.sub,
      trace: grant.trace,
      input: body.input,
      result,
      usage,
    };

    ctx.waitUntil(
      env.SF_EVENTS.send(event).catch((err: unknown) => {
        console.error('[sanfrancisco] SF_EVENTS.send failed', err);
      }),
    );

    const response: ExecuteResponse = { requestId, agentId: body.agentId, result, usage };
    return noStore(json(response));
  } finally {
    inflight--;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/healthz') return okHealth(env);
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
    for (const msg of batch.messages) {
      const e = msg.body;
      const key = `logs/${env.ENVIRONMENT ?? 'unknown'}/${e.agentId}/${today}/${e.requestId}.json`;
      await env.SF_R2.put(key, JSON.stringify(e), { httpMetadata: { contentType: 'application/json' } });
    }
  },
};


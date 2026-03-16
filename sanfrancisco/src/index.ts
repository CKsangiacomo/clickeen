import { listAiAgents, resolveAiAgent } from '@clickeen/ck-policy';
import { executeCsWidgetCopilot } from './agents/csWidgetCopilot';
import { executeDebugGrantProbe } from './agents/debugGrantProbe';
import { executeSdrCopilot } from './agents/sdrCopilot';
import { executeSdrWidgetCopilot } from './agents/sdrWidgetCopilot';
import { withInflightLimit } from './concurrency';
import { assertCap, verifyGrant } from './grants';
import { HttpError, json, noStore, readJson, isRecord } from './http';
import {
  handlePragueStringsTranslate,
} from './l10n-routes';
import { handleAccountL10nOpsGenerate } from './l10n-account-routes';
import {
  handlePersonalizationOnboardingCreate,
  handlePersonalizationOnboardingStatus,
  handleQueuedSanfranciscoCommand,
  isSanfranciscoCommandMessage,
} from './personalization-jobs';
import {
  ensureD1Schema,
  indexCopilotEvent,
  isOutcomeAttachRequest,
  persistOutcomeAttach,
  verifyOutcomeSignature,
} from './telemetry';
import type {
  AIGrant,
  Env,
  ExecuteRequest,
  ExecuteResponse,
  InteractionEvent,
  OutcomeAttachRequest,
  SanfranciscoCommandMessage,
} from './types';

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

type AgentExecutor = (args: { grant: AIGrant; input: unknown }, env: Env) => Promise<{ result: unknown; usage: any }>;

const AGENT_EXECUTORS: Record<string, AgentExecutor> = {
  'sdr.copilot': executeSdrCopilot,
  'sdr.widget.copilot.v1': executeSdrWidgetCopilot,
  'cs.widget.copilot.v1': executeCsWidgetCopilot,
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

async function handleExecute(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return await withInflightLimit(async () => {
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

    const requestId = typeof body.trace?.requestId === 'string' ? body.trace.requestId : crypto.randomUUID();
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

    if (env.SF_EVENTS) {
      ctx.waitUntil(
        env.SF_EVENTS.send(event).catch((err: unknown) => {
          console.error('[sanfrancisco] SF_EVENTS.send failed', err);
        }),
      );
    }

    const response: ExecuteResponse = { requestId, agentId: canonicalId, result: executed.result, usage: executed.usage };
    return noStore(json(response));
  });
}

async function handleOutcome(request: Request, env: Env): Promise<Response> {
  const bodyText = await request.text();
  await verifyOutcomeSignature({ request, env, bodyText });

  let parsedBody: unknown;
  try {
    parsedBody = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
  }

  if (!isSanfranciscoCommandMessage(parsedBody)) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Expected sf.command envelope payload',
    });
  }
  if (parsedBody.command !== 'ai.outcome.attach') {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: `Unsupported command "${parsedBody.command}" (expected "ai.outcome.attach")`,
    });
  }

  const body = parsedBody.payload;
  if (!isOutcomeAttachRequest(body)) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Invalid request',
      issues: [{ path: '', message: 'Expected { requestId, sessionId, event, occurredAtMs }' }],
    });
  }

  await persistOutcomeAttach(env, body as OutcomeAttachRequest);
  return noStore(json({ ok: true }));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/healthz') return okHealth(env);
      if (request.method === 'POST' && url.pathname === '/v1/execute') return await handleExecute(request, env, ctx);
      if (request.method === 'POST' && url.pathname === '/v1/outcome') return await handleOutcome(request, env);
      if (request.method === 'POST' && url.pathname === '/v1/personalization/onboarding') {
        return await handlePersonalizationOnboardingCreate(request, env, ctx);
      }
      const onboardingStatusMatch = url.pathname.match(/^\/v1\/personalization\/onboarding\/([^/]+)$/);
      if (onboardingStatusMatch && request.method === 'GET') {
        const jobId = decodeURIComponent(onboardingStatusMatch[1]);
        return await handlePersonalizationOnboardingStatus(request, env, jobId);
      }
      if (request.method === 'POST' && url.pathname === '/v1/l10n/translate') return await handlePragueStringsTranslate(request, env);
      if (request.method === 'POST' && url.pathname === '/v1/l10n/account/ops/generate') {
        return await handleAccountL10nOpsGenerate(request, env);
      }

      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    } catch (err: unknown) {
      if (err instanceof HttpError) return noStore(json({ error: err.error }, { status: err.status }));
      console.error('[sanfrancisco] Unhandled error', err);
      return noStore(json({ error: { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Unhandled error' } }, { status: 500 }));
    }
  },

  async queue(batch: MessageBatch<InteractionEvent | SanfranciscoCommandMessage>, env: Env): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await ensureD1Schema(env);
    for (const msg of batch.messages) {
      const body = msg.body;
      if (isSanfranciscoCommandMessage(body)) {
        try {
          await handleQueuedSanfranciscoCommand(body, env);
        } catch (err) {
          console.error('[sanfrancisco] command message failed', err);
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

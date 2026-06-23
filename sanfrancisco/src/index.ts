import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { callChatCompletion, type ChatMessage } from './ai/chat';
import { withInflightLimit } from './concurrency';
import { assertCap, verifyGrant } from './grants';
import {
  HttpError,
  createSanFranciscoRequestContext,
  finalizeSanFranciscoObservedResponse,
  isRecord,
  json,
  noStore,
  readJson,
  type SanFranciscoRequestContext,
} from './http';
import {
  handlePragueStringsTranslate,
} from './l10n-routes';
import {
  buildLearningSample,
  indexCopilotEvent,
  isOutcomeAttachRequest,
  persistOutcomeAttach,
  resolveLearningCaptureDecision,
  verifyOutcomeSignature,
} from './telemetry';
import type {
  AIGrant,
  Env,
  InteractionEvent,
  ModelChatRequest,
  ModelChatResponse,
  OutcomeAttachRequest,
  Usage,
} from './types';

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    (value.role === 'system' || value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    value.content.length > 0 &&
    value.content.length <= 80_000
  );
}

function isModelChatRequest(value: unknown): value is ModelChatRequest {
  if (!isRecord(value)) return false;
  return (
    typeof value.grant === 'string' &&
    typeof value.agentId === 'string' &&
    Array.isArray(value.messages) &&
    value.messages.length > 0 &&
    value.messages.length <= 24 &&
    value.messages.every(isChatMessage) &&
    (value.temperature === undefined || (typeof value.temperature === 'number' && Number.isFinite(value.temperature)))
  );
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

function usageForExecutionFailure(grant: AIGrant, startedAtMs: number): Usage {
  const modelRef = grant.ai?.selectedModel ?? grant.ai?.defaultModel;
  return {
    provider: modelRef?.provider ?? 'unknown',
    model: modelRef?.model ?? 'unknown',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: Math.max(0, Date.now() - startedAtMs),
  };
}

async function handleModelChat(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  requestContext: SanFranciscoRequestContext,
): Promise<Response> {
  return await withInflightLimit(async () => {
    const body = await readJson(request);
    if (!isModelChatRequest(body)) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid request', issues: [{ path: '', message: 'Expected { grant, agentId, messages }' }] });
    }

    const grant: AIGrant = await verifyGrant(body.grant, env.AI_GRANT_HMAC_SECRET);
    const resolvedAgent = resolveAiAgent(body.agentId);
    if (!resolvedAgent) {
      throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${body.agentId}` });
    }
    const canonicalId = resolvedAgent.canonicalId;
    if (grant.ai?.agentId !== canonicalId) {
      throw new HttpError(403, {
        code: 'CAPABILITY_DENIED',
        message: `Grant AI policy does not match request agentId: ${canonicalId}`,
      });
    }
    assertCap(grant, `agent:${canonicalId}`);

    const requestId = requestContext.requestId;
    const occurredAtMs = Date.now();

    const baseEvent: Omit<InteractionEvent, 'result' | 'usage'> = {
      v: 1,
      requestId,
      agentId: canonicalId,
      occurredAtMs,
      subject: grant.sub,
      trace: grant.trace,
      ai: {
        policyProfile: grant.ai?.policyProfile,
        policyVersion: grant.ai?.policyVersion,
        learningCapture: grant.ai?.learningCapture,
        taskClass: resolvedAgent.entry.taskClass,
      },
      input: { kind: 'model_chat', messages: body.messages },
    };

    const sendEvent = (event: InteractionEvent) => {
      if (!env.SF_EVENTS) return;
      ctx.waitUntil(
        env.SF_EVENTS.send(event).catch((err: unknown) => {
          console.error('[sanfrancisco] SF_EVENTS.send failed', err);
        }),
      );
    };

    let executed: { content: string; usage: Usage };
    try {
      executed = await callChatCompletion({
        env,
        grant,
        agentId: canonicalId,
        messages: body.messages,
        temperature: body.temperature,
      });
    } catch (err) {
      const message = err instanceof HttpError ? err.error?.message ?? err.message : err instanceof Error ? err.message : 'Unknown execution error';
      sendEvent({
        ...baseEvent,
        result: {
          message,
          error: { message },
          meta: {
            outcome: 'execution_failure',
            validationResult: 'invalid',
            invalidReason: message,
          },
        },
        usage: usageForExecutionFailure(grant, occurredAtMs),
      });
      throw err;
    }

    sendEvent({
      ...baseEvent,
      result: { kind: 'model_chat', content: executed.content },
      usage: executed.usage,
    });

    const response: ModelChatResponse = { requestId, agentId: canonicalId, content: executed.content, usage: executed.usage };
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

  if (!isOutcomeAttachRequest(parsedBody)) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Invalid request',
      issues: [{ path: '', message: 'Expected { requestId, sessionId, event, occurredAtMs } with optional linkage fields' }],
    });
  }

  await persistOutcomeAttach(env, parsedBody as OutcomeAttachRequest);
  return noStore(json({ ok: true }));
}

export default class SanFranciscoWorker extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const requestContext = createSanFranciscoRequestContext(request, this.env);

    try {
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/healthz') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: okHealth(this.env),
          boundary: 'health',
        });
      }
      if (request.method === 'POST' && url.pathname === '/v1/model/chat') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: await handleModelChat(request, this.env, this.ctx, requestContext),
          boundary: 'ai.model.chat',
        });
      }
      if (request.method === 'POST' && url.pathname === '/v1/execute') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: noStore(json({
            error: {
              code: 'BAD_REQUEST',
              message: 'San Francisco no longer executes agent brains. Call the agent home and use /v1/model/chat only for governed model execution.',
            },
          }, { status: 410 })),
          boundary: 'ai.execute.deprecated',
        });
      }
      if (request.method === 'POST' && url.pathname === '/v1/outcome') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: await handleOutcome(request, this.env),
          boundary: 'ai.outcome',
        });
      }
      if (request.method === 'POST' && url.pathname === '/v1/l10n/translate') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: await handlePragueStringsTranslate(request, this.env),
          boundary: 'l10n.translate',
        });
      }
      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: noStore(json({ error: err.error }, { status: err.status })),
          boundary: 'http.error',
          reasonKey: err.error.code,
          detail: err.error.message,
        });
      }
      console.error('[sanfrancisco] Unhandled error', err);
      return finalizeSanFranciscoObservedResponse({
        context: requestContext,
        response: noStore(json({ error: { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Unhandled error' } }, { status: 500 })),
        boundary: 'http.error',
        reasonKey: 'PROVIDER_ERROR',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async queue(batch: MessageBatch<unknown>): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);

    console.log(JSON.stringify({
      event: 'queue.batch.received',
      service: 'sanfrancisco',
      stage: this.env.ENVIRONMENT ?? 'unknown',
      totalMessages: batch.messages.length,
    }));

    for (const msg of batch.messages) {
      const e = msg.body;
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        msg.ack();
        continue;
      }
      const event = e as InteractionEvent;
      await indexCopilotEvent(this.env, event);
      const decision = resolveLearningCaptureDecision(event);
      if (decision.captureRaw) {
        const key = `learning/${this.env.ENVIRONMENT ?? 'unknown'}/${event.agentId}/${today}/${event.requestId}.json`;
        const sample = buildLearningSample(event, decision);
        try {
          await this.env.SF_R2.put(key, JSON.stringify(sample), { httpMetadata: { contentType: 'application/json' } });
        } catch (err) {
          console.error('[sanfrancisco] learning sample write failed', err);
        }
      }
    }
  }
}

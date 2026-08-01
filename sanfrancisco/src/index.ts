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
import { handlePragueStringsTranslate } from './l10n-routes';
import type {
  AIGrant,
  Env,
  ModelChatRequest,
  ModelChatResponse,
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

async function handleModelChat(
  request: Request,
  env: Env,
  requestContext: SanFranciscoRequestContext,
): Promise<Response> {
  return await withInflightLimit(async () => {
    const body = await readJson(request);
    if (!isModelChatRequest(body)) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid request', issues: [{ path: '', message: 'Expected { grant, agentId, messages }' }] });
    }

    const grant: AIGrant = await verifyGrant(body.grant, env.ROMA_AI_GRANT_PUBLIC_KEY_PEM);
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

    const executed = await callChatCompletion({
      env,
      grant,
      agentId: canonicalId,
      messages: body.messages,
      temperature: body.temperature,
    });

    const requestId = requestContext.requestId;
    const response: ModelChatResponse = { requestId, agentId: canonicalId, content: executed.content, usage: executed.usage };
    return noStore(json(response));
  });
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
      if (request.method === 'POST' && url.pathname === '/model/chat') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: await handleModelChat(request, this.env, requestContext),
          boundary: 'ai.model.chat',
        });
      }
      if (request.method === 'POST' && url.pathname === '/execute') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: noStore(json({
            error: {
              code: 'BAD_REQUEST',
              message: 'San Francisco no longer executes agent brains. Call the agent home and use /model/chat only for governed model execution.',
            },
          }, { status: 410 })),
          boundary: 'ai.execute.deprecated',
        });
      }
      if (request.method === 'POST' && url.pathname === '/l10n/translate') {
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
}

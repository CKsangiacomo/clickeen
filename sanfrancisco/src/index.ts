import { WorkerEntrypoint } from 'cloudflare:workers';
import { handleModelTurn } from './ai/model-turn';
import {
  HttpError,
  createSanFranciscoRequestContext,
  finalizeSanFranciscoObservedResponse,
  json,
  noStore,
} from './http';
import { handlePragueStringsTranslate } from './l10n-routes';
import type { Env } from './types';

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
      if (request.method === 'POST' && url.pathname === '/model/turn') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: await handleModelTurn(request, this.env, requestContext),
          boundary: 'ai.model.turn',
        });
      }
      if (request.method === 'POST' && url.pathname === '/execute') {
        return finalizeSanFranciscoObservedResponse({
          context: requestContext,
          response: noStore(json({
            error: {
              code: 'BAD_REQUEST',
              reasonKey: 'BAD_REQUEST',
              message: 'San Francisco no longer executes agent brains. Call the agent home and use /model/turn only for governed model execution.',
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
        response: noStore(json({ error: { code: 'PROVIDER_ERROR', reasonKey: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Unhandled error' } }, { status: 500 })),
        boundary: 'http.error',
        reasonKey: 'PROVIDER_ERROR',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

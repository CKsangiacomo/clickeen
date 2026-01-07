import type { Env } from './types';
import { HttpError, json, noStore } from './http';
import { handlePitchSearch } from './search';
import { handlePitchAnswer } from './answer';
import { handlePitchUpsert } from './upsert';

function okHealth(env: Env): Response {
  return noStore(
    json({
      ok: true,
      service: 'pitch',
      environment: env.ENVIRONMENT ?? 'unknown',
      ts: Date.now(),
    }),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/healthz') return okHealth(env);
      if (request.method === 'GET' && url.pathname === '/v1/pitch/search') return await handlePitchSearch(request, env);
      if (request.method === 'GET' && url.pathname === '/v1/pitch/answer') return await handlePitchAnswer(request, env);
      if (request.method === 'POST' && url.pathname === '/v1/pitch/upsert') return await handlePitchUpsert(request, env);
      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    } catch (err: unknown) {
      if (err instanceof HttpError) return noStore(json({ error: err.error }, { status: err.status }));
      console.error('[pitch] Unhandled error', err);
      return noStore(json({ error: { code: 'PROVIDER_ERROR', provider: 'pitch', message: 'Unhandled error' } }, { status: 500 }));
    }
  },
};



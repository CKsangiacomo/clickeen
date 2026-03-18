import { dispatchTokyoRoute } from './route-dispatch';
import { json } from './http';
import { handleTokyoQueue } from './queue-handler';
import { createTokyoRequestContext, finalizeTokyoObservedResponse } from './request-ops';
import type { Env } from './types';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const requestContext = createTokyoRequestContext(req, env, pathname);
    const respond = (response: Response): Response =>
      finalizeTokyoObservedResponse({ context: requestContext, response });

    try {
      if (req.method === 'OPTIONS') {
        return respond(new Response(null, { status: 204 }));
      }

      return await dispatchTokyoRoute({
        req,
        env,
        pathname,
        url,
        respond,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return finalizeTokyoObservedResponse({
        context: requestContext,
        response: json(
          { error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.internal', detail: message } },
          { status: 500 },
        ),
        errorDetail: message,
      });
    }
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    await handleTokyoQueue(batch, env);
  },
};

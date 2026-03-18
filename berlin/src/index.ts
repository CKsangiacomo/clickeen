import { type Env } from './types';
import {
  attachBerlinRequestHeaders,
  createBerlinRequestContext,
  enforceBerlinRateLimit,
  logBerlinRequestCompletion,
} from './request-ops';
import { BerlinAuthTicketDO, dispatchBerlinRequest, unexpectedBerlinErrorResponse } from './route-dispatch';

export { BerlinAuthTicketDO };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestContext = createBerlinRequestContext(request, env);

    try {
      const limited = await enforceBerlinRateLimit(env, requestContext);
      if (limited) {
        const response = attachBerlinRequestHeaders(limited.response, requestContext, limited.decision);
        logBerlinRequestCompletion({
          context: requestContext,
          response,
          decision: limited.decision,
        });
        return response;
      }

      const response = attachBerlinRequestHeaders(await dispatchBerlinRequest(request, env), requestContext);
      logBerlinRequestCompletion({ context: requestContext, response });
      return response;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const response = attachBerlinRequestHeaders(unexpectedBerlinErrorResponse(error), requestContext);
      logBerlinRequestCompletion({
        context: requestContext,
        response,
        errorDetail: detail,
      });
      return response;
    }
  },
};

import type { Env } from './shared/types';
import { corsPreflight, json } from './shared/http';
import { assertAccountId } from './shared/validation';
import { handleHealthz } from './shared/handlers';
import { ckError, errorDetail } from './shared/errors';
import { handleGetInstance } from './domains/instances';
import {
  handleL10nGenerateReport,
  handleL10nGenerateRetries,
} from './domains/l10n/generate-handlers';
import { handleAccountLocalesAftermath } from './domains/l10n/account-handlers';

function methodNotAllowed(): Response {
  return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.method.notAllowed' }, 405);
}

function routeNotFound(): Response {
  return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'OPTIONS') return corsPreflight(req);
      if (pathname === '/api/healthz') return handleHealthz();

      if (pathname === '/api/l10n/jobs/report') {
        if (req.method !== 'POST') return methodNotAllowed();
        return handleL10nGenerateReport(req, env);
      }

      const internalAccountLocalesAftermathMatch = pathname.match(
        /^\/internal\/accounts\/([^/]+)\/locales\/aftermath$/,
      );
      if (internalAccountLocalesAftermathMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(internalAccountLocalesAftermathMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        if (req.method === 'POST') return handleAccountLocalesAftermath(req, env, accountIdResult.value);
        return methodNotAllowed();
      }

      const instanceMatch = pathname.match(/^\/api\/instance\/([^/]+)$/);
      if (instanceMatch) {
        const publicId = decodeURIComponent(instanceMatch[1]);
        if (req.method === 'GET') return handleGetInstance(req, env, publicId);
        return methodNotAllowed();
      }

      return routeNotFound();
    } catch (err) {
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.internal.serverError',
          detail: errorDetail(err),
        },
        500,
      );
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleL10nGenerateRetries(env));
  },
};

import type { Env } from './shared/types';
import { corsPreflight, json } from './shared/http';
import { assertAccountId } from './shared/validation';
import { handleHealthz } from './shared/handlers';
import { ckError, errorDetail } from './shared/errors';
import {
  handleAiGrant,
  handleAiMinibobGrant,
  handleAiMinibobSession,
  handleAiOutcome,
} from './domains/ai';
import { handleGetInstance } from './domains/instances';
import {
  handleMinibobHandoffComplete,
  handleMinibobHandoffStart,
} from './domains/roma/handoff-account-create';
import {
  handleL10nGenerateReport,
  handleL10nGenerateRetries,
} from './domains/l10n/generate-handlers';
import {
  handleAccountInstanceLayerDelete,
  handleAccountInstanceLayerGet,
  handleAccountInstanceLayerUpsert,
  handleAccountInstanceLayersList,
} from './domains/l10n/layers-handlers';
import {
  handleAccountInstanceL10nStatus,
  handleAccountLocalesAftermath,
} from './domains/l10n/account-handlers';

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

      if (pathname === '/api/minibob/handoff/start') {
        if (req.method !== 'POST') return methodNotAllowed();
        return handleMinibobHandoffStart(req, env);
      }

      if (pathname === '/api/minibob/handoff/complete') {
        if (req.method !== 'POST') return methodNotAllowed();
        return handleMinibobHandoffComplete(req, env);
      }

      if (pathname === '/api/ai/grant') {
        if (req.method !== 'POST') return methodNotAllowed();
        return handleAiGrant(req, env);
      }

      if (pathname === '/api/ai/minibob/grant') {
        if (req.method !== 'POST') return methodNotAllowed();
        return handleAiMinibobGrant(req, env);
      }

      if (pathname === '/api/ai/minibob/session') {
        if (req.method !== 'POST') return methodNotAllowed();
        return handleAiMinibobSession(req, env);
      }

      if (pathname === '/api/ai/outcome') {
        if (req.method !== 'POST') return methodNotAllowed();
        return handleAiOutcome(req, env);
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

      const accountInstanceLayersMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/layers$/,
      );
      if (accountInstanceLayersMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceLayersMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceLayersMatch[2]);
        if (req.method === 'GET') {
          return handleAccountInstanceLayersList(req, env, accountIdResult.value, publicId);
        }
        return methodNotAllowed();
      }

      const accountInstanceLayerMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/layers\/([^/]+)\/([^/]+)$/,
      );
      if (accountInstanceLayerMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceLayerMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceLayerMatch[2]);
        const layer = decodeURIComponent(accountInstanceLayerMatch[3]);
        const layerKey = decodeURIComponent(accountInstanceLayerMatch[4]);
        if (req.method === 'GET') {
          return handleAccountInstanceLayerGet(
            req,
            env,
            accountIdResult.value,
            publicId,
            layer,
            layerKey,
          );
        }
        if (req.method === 'PUT') {
          return handleAccountInstanceLayerUpsert(
            req,
            env,
            accountIdResult.value,
            publicId,
            layer,
            layerKey,
          );
        }
        if (req.method === 'DELETE') {
          return handleAccountInstanceLayerDelete(
            req,
            env,
            accountIdResult.value,
            publicId,
            layer,
            layerKey,
          );
        }
        return methodNotAllowed();
      }

      const accountInstanceL10nMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/l10n\/status$/,
      );
      if (accountInstanceL10nMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceL10nMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceL10nMatch[2]);
        if (req.method === 'GET')
          return handleAccountInstanceL10nStatus(req, env, accountIdResult.value, publicId);
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

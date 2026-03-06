import type { Env } from './shared/types';
import { corsPreflight, json } from './shared/http';
import { assertAccountId } from './shared/validation';
import { handleHealthz } from './shared/handlers';
import { handleAiGrant, handleAiMinibobGrant, handleAiMinibobSession, handleAiOutcome } from './domains/ai';
import {
  handleGetInstance,
} from './domains/instances';
import {
  handleAccountGetInstance,
  handleAccountUpdateInstance,
} from './domains/account-instances';
import {
  handleAccountLifecyclePlanChange,
  handleAccountLifecycleTierDropDismiss,
  handleAccountInstancesUnpublish,
} from './domains/accounts';
import {
  handleAccountCreate,
  handleMinibobHandoffStart,
  handleMinibobHandoffComplete,
  handleRomaBootstrap,
  handleRomaTemplates,
  handleRomaWidgetDelete,
  handleRomaWidgetDuplicate,
  handleRomaWidgets,
} from './domains/roma';
import {
  handleL10nGenerateReport,
  handleL10nGenerateRetries,
  handleAccountInstanceLayerDelete,
  handleAccountInstanceLayerGet,
  handleAccountInstanceLayerUpsert,
  handleAccountInstanceLayersList,
  handleAccountInstanceL10nEnqueueSelected,
  handleAccountInstanceL10nStatus,
  handleAccountLocalesPut,
} from './domains/l10n';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'OPTIONS') return corsPreflight(req);
      if (pathname === '/api/healthz') return handleHealthz();

      if (pathname === '/api/roma/bootstrap') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleRomaBootstrap(req, env);
      }

      if (pathname === '/api/roma/widgets/duplicate') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleRomaWidgetDuplicate(req, env);
      }

      const romaInstanceMatch = pathname.match(/^\/api\/roma\/instances\/([^/]+)$/);
      if (romaInstanceMatch) {
        const publicId = decodeURIComponent(romaInstanceMatch[1]);
        if (req.method === 'DELETE') return handleRomaWidgetDelete(req, env, publicId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      if (pathname === '/api/roma/widgets') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleRomaWidgets(req, env);
      }

      if (pathname === '/api/roma/templates') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleRomaTemplates(req, env);
      }

      if (pathname === '/api/l10n/jobs/report') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleL10nGenerateReport(req, env);
      }

      if (pathname === '/api/accounts') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleAccountCreate(req, env);
      }

      if (pathname === '/api/minibob/handoff/start') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleMinibobHandoffStart(req, env);
      }

      if (pathname === '/api/minibob/handoff/complete') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleMinibobHandoffComplete(req, env);
      }

      if (pathname === '/api/ai/grant') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleAiGrant(req, env);
      }

      if (pathname === '/api/ai/minibob/grant') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleAiMinibobGrant(req, env);
      }

      if (pathname === '/api/ai/minibob/session') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleAiMinibobSession(req, env);
      }

      if (pathname === '/api/ai/outcome') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleAiOutcome(req, env);
      }

      const accountLocalesMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/locales$/);
      if (accountLocalesMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountLocalesMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        if (req.method === 'PUT') return handleAccountLocalesPut(req, env, accountIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountInstanceMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/instance\/([^/]+)$/);
      if (accountInstanceMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceMatch[2]);
        if (req.method === 'GET') return handleAccountGetInstance(req, env, accountIdResult.value, publicId);
        if (req.method === 'PUT') return handleAccountUpdateInstance(req, env, accountIdResult.value, publicId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountInstanceLayersMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/layers$/);
      if (accountInstanceLayersMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceLayersMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceLayersMatch[2]);
        if (req.method === 'GET') {
          return handleAccountInstanceLayersList(req, env, accountIdResult.value, publicId);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountInstanceLayerMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/layers\/([^/]+)\/([^/]+)$/
      );
      if (accountInstanceLayerMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceLayerMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceLayerMatch[2]);
        const layer = decodeURIComponent(accountInstanceLayerMatch[3]);
        const layerKey = decodeURIComponent(accountInstanceLayerMatch[4]);
        if (req.method === 'GET') {
          return handleAccountInstanceLayerGet(req, env, accountIdResult.value, publicId, layer, layerKey);
        }
        if (req.method === 'PUT') {
          return handleAccountInstanceLayerUpsert(req, env, accountIdResult.value, publicId, layer, layerKey);
        }
        if (req.method === 'DELETE') {
          return handleAccountInstanceLayerDelete(req, env, accountIdResult.value, publicId, layer, layerKey);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountInstanceL10nMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/l10n\/status$/
      );
      if (accountInstanceL10nMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceL10nMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceL10nMatch[2]);
        if (req.method === 'GET') return handleAccountInstanceL10nStatus(req, env, accountIdResult.value, publicId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountInstanceL10nEnqueueSelectedMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/l10n\/enqueue-selected$/
      );
      if (accountInstanceL10nEnqueueSelectedMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceL10nEnqueueSelectedMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceL10nEnqueueSelectedMatch[2]);
        if (req.method === 'POST') {
          return handleAccountInstanceL10nEnqueueSelected(req, env, accountIdResult.value, publicId);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountInstancesUnpublishMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/instances\/unpublish$/);
      if (accountInstancesUnpublishMatch) {
        const accountId = decodeURIComponent(accountInstancesUnpublishMatch[1]);
        if (req.method === 'POST') return handleAccountInstancesUnpublish(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountPlanChangeMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/lifecycle\/plan-change$/);
      if (accountPlanChangeMatch) {
        const accountId = decodeURIComponent(accountPlanChangeMatch[1]);
        if (req.method === 'POST') return handleAccountLifecyclePlanChange(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountTierDropDismissMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/lifecycle\/tier-drop\/dismiss$/);
      if (accountTierDropDismissMatch) {
        const accountId = decodeURIComponent(accountTierDropDismissMatch[1]);
        if (req.method === 'POST') return handleAccountLifecycleTierDropDismiss(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const instanceMatch = pathname.match(/^\/api\/instance\/([^/]+)$/);
      if (instanceMatch) {
        const publicId = decodeURIComponent(instanceMatch[1]);
        if (req.method === 'GET') return handleGetInstance(req, env, publicId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      return json({ error: 'NOT_FOUND' }, { status: 404 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: 'SERVER_ERROR', message }, { status: 500 });
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleL10nGenerateRetries(env));
  },
};

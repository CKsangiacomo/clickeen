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
import { handleAccountPublishContainment } from './domains/internal-control/account-publish-containment';
import { handleGetInstance } from './domains/instances';
import {
  handleAccountGetLocalization,
  handleAccountSavePublishedSurfaceSync,
  handleAccountSaveTranslationSync,
} from './domains/account-instances';
import {
  handleMinibobHandoffStart,
  handleMinibobHandoffComplete,
  handleInternalDevstudioWidgets,
  handleRomaTemplates,
  handleRomaWidgetDelete,
  handleRomaWidgets,
} from './domains/roma';
import {
  handleL10nGenerateReport,
  handleL10nGenerateRetries,
  handleAccountInstanceLayerDelete,
  handleAccountInstanceLayerGet,
  handleAccountInstanceLayerUpsert,
  handleAccountInstanceLayersList,
  handleAccountInstanceL10nStatus,
  handleAccountLocalesAftermath,
} from './domains/l10n';
import { handleAccountMemberRemoval } from './domains/internal-control/account-member-removal';
import { handleCustomerEmailRecovery } from './domains/internal-control/customer-email-recovery';
import { handleSessionRevoke } from './domains/internal-control/session-revoke';
import { handleSponsoredAccountCreate } from './domains/internal-control/sponsored-onboarding';
import { handleSupportTargetOpen } from './domains/internal-control/support-target-open';
import { handleSupportUpdateInstance } from './domains/internal-control/support-update-instance';

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

      const romaInstanceMatch = pathname.match(/^\/api\/roma\/instances\/([^/]+)$/);
      if (romaInstanceMatch) {
        const publicId = decodeURIComponent(romaInstanceMatch[1]);
        if (req.method === 'DELETE') return handleRomaWidgetDelete(req, env, publicId);
        return methodNotAllowed();
      }

      if (pathname === '/api/roma/widgets') {
        if (req.method !== 'GET') return methodNotAllowed();
        return handleRomaWidgets(req, env);
      }

      if (pathname === '/internal/devstudio/widgets') {
        if (req.method !== 'GET') return methodNotAllowed();
        return handleInternalDevstudioWidgets(req, env);
      }

      if (pathname === '/api/roma/templates') {
        if (req.method !== 'GET') return methodNotAllowed();
        return handleRomaTemplates(req, env);
      }

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

      if (pathname === '/internal/control/sponsored-accounts') {
        if (req.method === 'POST') return handleSponsoredAccountCreate(req, env);
        return methodNotAllowed();
      }

      if (pathname === '/internal/control/customer-email-recovery') {
        if (req.method === 'POST') return handleCustomerEmailRecovery(req, env);
        return methodNotAllowed();
      }

      if (pathname === '/internal/control/account-member-removal') {
        if (req.method === 'POST') return handleAccountMemberRemoval(req, env);
        return methodNotAllowed();
      }

      if (pathname === '/internal/control/revoke-user-sessions') {
        if (req.method === 'POST') return handleSessionRevoke(req, env);
        return methodNotAllowed();
      }

      if (pathname === '/internal/control/account-publish-containment') {
        if (req.method === 'POST') return handleAccountPublishContainment(req, env);
        return methodNotAllowed();
      }

      if (pathname === '/internal/control/support-open-target') {
        if (req.method === 'POST') return handleSupportTargetOpen(req, env);
        return methodNotAllowed();
      }

      if (pathname === '/internal/control/support-update-instance') {
        if (req.method === 'POST') return handleSupportUpdateInstance(req, env);
        return methodNotAllowed();
      }

      const accountInstanceLocalizationMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/localization$/,
      );
      if (accountInstanceLocalizationMatch) {
        const accountIdResult = assertAccountId(
          decodeURIComponent(accountInstanceLocalizationMatch[1]),
        );
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceLocalizationMatch[2]);
        if (req.method === 'GET') {
          return handleAccountGetLocalization(req, env, accountIdResult.value, publicId);
        }
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

      const accountInstanceTranslationSyncMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/sync-translations$/,
      );
      if (accountInstanceTranslationSyncMatch) {
        const accountIdResult = assertAccountId(
          decodeURIComponent(accountInstanceTranslationSyncMatch[1]),
        );
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceTranslationSyncMatch[2]);
        if (req.method === 'POST') {
          return handleAccountSaveTranslationSync(req, env, accountIdResult.value, publicId);
        }
        return methodNotAllowed();
      }

      const accountInstancePublishedSurfaceSyncMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/sync-published-surface$/,
      );
      if (accountInstancePublishedSurfaceSyncMatch) {
        const accountIdResult = assertAccountId(
          decodeURIComponent(accountInstancePublishedSurfaceSyncMatch[1]),
        );
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstancePublishedSurfaceSyncMatch[2]);
        if (req.method === 'POST') {
          return handleAccountSavePublishedSurfaceSync(req, env, accountIdResult.value, publicId);
        }
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

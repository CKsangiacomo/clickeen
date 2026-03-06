import type { Env } from './shared/types';
import { corsPreflight, json } from './shared/http';
import { assertAccountId } from './shared/validation';
import { handleHealthz, handleNotImplemented, handleSchemaHealthz } from './shared/handlers';
import { handleAiGrant, handleAiMinibobGrant, handleAiMinibobSession, handleAiOutcome } from './domains/ai';
import {
  handlePersonalizationOnboardingCreate,
  handlePersonalizationOnboardingStatus,
  handlePersonalizationPreviewCreate,
  handlePersonalizationPreviewStatus,
} from './domains/personalization';
import {
  handleCuratedInstances,
  handleGetInstance,
  handleListWidgets,
} from './domains/instances';
import {
  handleAccountBusinessProfileGet,
  handleAccountBusinessProfileUpsert,
  handleAccountCreateInstance,
  handleAccountEnsureWebsiteCreative,
  handleAccountGetInstance,
  handleAccountInstancePublishStatus,
  handleAccountInstanceRenderSnapshot,
  handleAccountInstancesList,
  handleAccountUpdateInstance,
} from './domains/account-instances';
import {
  handleAccountAssetDelete,
  handleAccountAssetGet,
  handleAccountAssetsList,
  handleAccountAssetsPurge,
  handleAccountLifecyclePlanChange,
  handleAccountLifecycleTierDropDismiss,
  handleAccountInstancesUnpublish,
} from './domains/accounts';
import {
  handleAccountCreate,
  handleAccountBillingCheckoutSession,
  handleAccountBillingPortalSession,
  handleAccountBillingSummary,
  handleAccountGet,
  handleAccountUsage,
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
import { handleUsageEvent } from './domains/usage';
import { handleMe } from './domains/identity';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'OPTIONS') return corsPreflight(req);
      if (pathname === '/api/healthz') return handleHealthz();
      if (pathname === '/api/healthz/schema') return handleSchemaHealthz(env);
      if (pathname === '/api/me') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleMe(req, env);
      }

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

      if (pathname === '/api/usage') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleUsageEvent(req, env);
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

      const submitMatch = pathname.match(/^\/api\/submit\/([^/]+)$/);
      if (submitMatch) {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleNotImplemented(req, env, 'submit');
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

      if (pathname === '/api/personalization/preview') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handlePersonalizationPreviewCreate(req, env);
      }
      const previewStatusMatch = pathname.match(/^\/api\/personalization\/preview\/([^/]+)$/);
      if (previewStatusMatch) {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handlePersonalizationPreviewStatus(req, env, decodeURIComponent(previewStatusMatch[1]));
      }
      if (pathname === '/api/personalization/onboarding') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handlePersonalizationOnboardingCreate(req, env);
      }
      const onboardingStatusMatch = pathname.match(/^\/api\/personalization\/onboarding\/([^/]+)$/);
      if (onboardingStatusMatch) {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handlePersonalizationOnboardingStatus(req, env, decodeURIComponent(onboardingStatusMatch[1]));
      }

      const accountLocalesMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/locales$/);
      if (accountLocalesMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountLocalesMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        if (req.method === 'PUT') return handleAccountLocalesPut(req, env, accountIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountInstancesMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/instances$/);
      if (accountInstancesMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstancesMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        if (req.method === 'GET') return handleAccountInstancesList(req, env, accountIdResult.value);
        if (req.method === 'POST') return handleAccountCreateInstance(req, env, accountIdResult.value);
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

      const accountInstancePublishStatusMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/publish\/status$/
      );
      if (accountInstancePublishStatusMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstancePublishStatusMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstancePublishStatusMatch[2]);
        if (req.method === 'GET') {
          return handleAccountInstancePublishStatus(req, env, accountIdResult.value, publicId);
        }
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

      const accountInstanceRenderSnapshotMatch = pathname.match(
        /^\/api\/accounts\/([^/]+)\/instances\/([^/]+)\/render-snapshot$/
      );
      if (accountInstanceRenderSnapshotMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountInstanceRenderSnapshotMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        const publicId = decodeURIComponent(accountInstanceRenderSnapshotMatch[2]);
        if (req.method === 'POST') {
          return handleAccountInstanceRenderSnapshot(req, env, accountIdResult.value, publicId);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountWebsiteCreativeMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/website-creative$/);
      if (accountWebsiteCreativeMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountWebsiteCreativeMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        if (req.method === 'POST') return handleAccountEnsureWebsiteCreative(req, env, accountIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountBusinessProfileMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/business-profile$/);
      if (accountBusinessProfileMatch) {
        const accountIdResult = assertAccountId(decodeURIComponent(accountBusinessProfileMatch[1]));
        if (!accountIdResult.ok) return accountIdResult.response;
        if (req.method === 'GET') return handleAccountBusinessProfileGet(req, env, accountIdResult.value);
        if (req.method === 'POST') return handleAccountBusinessProfileUpsert(req, env, accountIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountUsageMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/usage$/);
      if (accountUsageMatch) {
        const accountId = decodeURIComponent(accountUsageMatch[1]);
        if (req.method === 'GET') return handleAccountUsage(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountBillingSummaryMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/billing\/summary$/);
      if (accountBillingSummaryMatch) {
        const accountId = decodeURIComponent(accountBillingSummaryMatch[1]);
        if (req.method === 'GET') return handleAccountBillingSummary(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountBillingCheckoutMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/billing\/checkout-session$/);
      if (accountBillingCheckoutMatch) {
        const accountId = decodeURIComponent(accountBillingCheckoutMatch[1]);
        if (req.method === 'POST') return handleAccountBillingCheckoutSession(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountBillingPortalMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/billing\/portal-session$/);
      if (accountBillingPortalMatch) {
        const accountId = decodeURIComponent(accountBillingPortalMatch[1]);
        if (req.method === 'POST') return handleAccountBillingPortalSession(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountAssetsMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/assets$/);
      if (accountAssetsMatch) {
        const accountId = decodeURIComponent(accountAssetsMatch[1]);
        if (req.method === 'GET') return handleAccountAssetsList(req, env, accountId);
        if (req.method === 'DELETE') return handleAccountAssetsPurge(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountMembersMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/members$/);
      if (accountMembersMatch) {
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

      const accountAssetMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/assets\/([^/]+)$/);
      if (accountAssetMatch) {
        const accountId = decodeURIComponent(accountAssetMatch[1]);
        const assetId = decodeURIComponent(accountAssetMatch[2]);
        if (req.method === 'GET') return handleAccountAssetGet(req, env, accountId, assetId);
        if (req.method === 'DELETE') return handleAccountAssetDelete(req, env, accountId, assetId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountMatch = pathname.match(/^\/api\/accounts\/([^/]+)$/);
      if (accountMatch) {
        const accountId = decodeURIComponent(accountMatch[1]);
        if (req.method === 'GET') return handleAccountGet(req, env, accountId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      if (pathname === '/api/widgets') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleListWidgets(req, env);
      }

      if (pathname === '/api/curated-instances') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleCuratedInstances(req, env);
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

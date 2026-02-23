import type { Env } from './shared/types';
import { corsPreflight, json } from './shared/http';
import { assertWorkspaceId } from './shared/validation';
import { handleHealthz, handleNotImplemented } from './shared/handlers';
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
  handleWorkspaceBusinessProfileGet,
  handleWorkspaceBusinessProfileUpsert,
  handleWorkspaceCreateInstance,
  handleWorkspaceEnsureWebsiteCreative,
  handleWorkspaceGetInstance,
  handleWorkspaceInstancePublishStatus,
  handleWorkspaceInstanceRenderSnapshot,
  handleWorkspaceInstances,
  handleWorkspaceUpdateInstance,
} from './domains/workspaces';
import {
  handleAccountAssetDelete,
  handleAccountAssetGet,
  handleAccountAssetReplaceContent,
  handleAccountAssetsList,
} from './domains/accounts';
import {
  handleAccountCreate,
  handleAccountBillingCheckoutSession,
  handleAccountBillingPortalSession,
  handleAccountBillingSummary,
  handleAccountGet,
  handleAccountCreateWorkspace,
  handleAccountUsage,
  handleAccountWorkspaces,
  handleMinibobHandoffStart,
  handleMinibobHandoffComplete,
  handleWorkspaceAiLimits,
  handleWorkspaceAiOutcomes,
  handleWorkspaceAiProfile,
  handleWorkspaceEntitlements,
  handleWorkspaceGet,
  handleWorkspaceMembers,
  handleWorkspacePolicy,
  handleRomaBootstrap,
  handleRomaTemplates,
  handleRomaWidgetDelete,
  handleRomaWidgetDuplicate,
  handleRomaWidgets,
} from './domains/roma';
import {
  handleL10nGenerateReport,
  handleL10nGenerateRetries,
  handleWorkspaceInstanceLayerDelete,
  handleWorkspaceInstanceLayerGet,
  handleWorkspaceInstanceLayerUpsert,
  handleWorkspaceInstanceLayersList,
  handleWorkspaceInstanceL10nEnqueueSelected,
  handleWorkspaceInstanceL10nStatus,
  handleWorkspaceLocalesGet,
  handleWorkspaceLocalesPut,
} from './domains/l10n';
import { handleFrozenResets, handleUsageEvent } from './domains/usage';
import { handleMe } from './domains/identity';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'OPTIONS') return corsPreflight(req);
      if (pathname === '/api/healthz') return handleHealthz();
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

      const workspaceLocalesMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/locales$/);
      if (workspaceLocalesMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceLocalesMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        if (req.method === 'GET') return handleWorkspaceLocalesGet(req, env, workspaceIdResult.value);
        if (req.method === 'PUT') return handleWorkspaceLocalesPut(req, env, workspaceIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstancesMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/instances$/);
      if (workspaceInstancesMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstancesMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        if (req.method === 'GET') return handleWorkspaceInstances(req, env, workspaceIdResult.value);
        if (req.method === 'POST') return handleWorkspaceCreateInstance(req, env, workspaceIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstanceMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/instance\/([^/]+)$/);
      if (workspaceInstanceMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstanceMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        const publicId = decodeURIComponent(workspaceInstanceMatch[2]);
        if (req.method === 'GET') return handleWorkspaceGetInstance(req, env, workspaceIdResult.value, publicId);
        if (req.method === 'PUT') return handleWorkspaceUpdateInstance(req, env, workspaceIdResult.value, publicId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstanceLayersMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/instances\/([^/]+)\/layers$/);
      if (workspaceInstanceLayersMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstanceLayersMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        const publicId = decodeURIComponent(workspaceInstanceLayersMatch[2]);
        if (req.method === 'GET') {
          return handleWorkspaceInstanceLayersList(req, env, workspaceIdResult.value, publicId);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstanceLayerMatch = pathname.match(
        /^\/api\/workspaces\/([^/]+)\/instances\/([^/]+)\/layers\/([^/]+)\/([^/]+)$/
      );
      if (workspaceInstanceLayerMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstanceLayerMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        const publicId = decodeURIComponent(workspaceInstanceLayerMatch[2]);
        const layer = decodeURIComponent(workspaceInstanceLayerMatch[3]);
        const layerKey = decodeURIComponent(workspaceInstanceLayerMatch[4]);
        if (req.method === 'GET') {
          return handleWorkspaceInstanceLayerGet(req, env, workspaceIdResult.value, publicId, layer, layerKey);
        }
        if (req.method === 'PUT') {
          return handleWorkspaceInstanceLayerUpsert(req, env, workspaceIdResult.value, publicId, layer, layerKey);
        }
        if (req.method === 'DELETE') {
          return handleWorkspaceInstanceLayerDelete(req, env, workspaceIdResult.value, publicId, layer, layerKey);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstanceL10nMatch = pathname.match(
        /^\/api\/workspaces\/([^/]+)\/instances\/([^/]+)\/l10n\/status$/
      );
      if (workspaceInstanceL10nMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstanceL10nMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        const publicId = decodeURIComponent(workspaceInstanceL10nMatch[2]);
        if (req.method === 'GET') return handleWorkspaceInstanceL10nStatus(req, env, workspaceIdResult.value, publicId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstancePublishStatusMatch = pathname.match(
        /^\/api\/workspaces\/([^/]+)\/instances\/([^/]+)\/publish\/status$/
      );
      if (workspaceInstancePublishStatusMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstancePublishStatusMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        const publicId = decodeURIComponent(workspaceInstancePublishStatusMatch[2]);
        if (req.method === 'GET') {
          return handleWorkspaceInstancePublishStatus(req, env, workspaceIdResult.value, publicId);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstanceL10nEnqueueSelectedMatch = pathname.match(
        /^\/api\/workspaces\/([^/]+)\/instances\/([^/]+)\/l10n\/enqueue-selected$/
      );
      if (workspaceInstanceL10nEnqueueSelectedMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstanceL10nEnqueueSelectedMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        const publicId = decodeURIComponent(workspaceInstanceL10nEnqueueSelectedMatch[2]);
        if (req.method === 'POST') {
          return handleWorkspaceInstanceL10nEnqueueSelected(req, env, workspaceIdResult.value, publicId);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstanceRenderSnapshotMatch = pathname.match(
        /^\/api\/workspaces\/([^/]+)\/instances\/([^/]+)\/render-snapshot$/
      );
      if (workspaceInstanceRenderSnapshotMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstanceRenderSnapshotMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        const publicId = decodeURIComponent(workspaceInstanceRenderSnapshotMatch[2]);
        if (req.method === 'POST') {
          return handleWorkspaceInstanceRenderSnapshot(req, env, workspaceIdResult.value, publicId);
        }
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceWebsiteCreativeMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/website-creative$/);
      if (workspaceWebsiteCreativeMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceWebsiteCreativeMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        if (req.method === 'POST') return handleWorkspaceEnsureWebsiteCreative(req, env, workspaceIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceBusinessProfileMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/business-profile$/);
      if (workspaceBusinessProfileMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceBusinessProfileMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        if (req.method === 'GET') return handleWorkspaceBusinessProfileGet(req, env, workspaceIdResult.value);
        if (req.method === 'POST') return handleWorkspaceBusinessProfileUpsert(req, env, workspaceIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceMembersMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/members$/);
      if (workspaceMembersMatch) {
        const workspaceId = decodeURIComponent(workspaceMembersMatch[1]);
        if (req.method === 'GET') return handleWorkspaceMembers(req, env, workspaceId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspacePolicyMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/policy$/);
      if (workspacePolicyMatch) {
        const workspaceId = decodeURIComponent(workspacePolicyMatch[1]);
        if (req.method === 'GET') return handleWorkspacePolicy(req, env, workspaceId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceEntitlementsMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/entitlements$/);
      if (workspaceEntitlementsMatch) {
        const workspaceId = decodeURIComponent(workspaceEntitlementsMatch[1]);
        if (req.method === 'GET') return handleWorkspaceEntitlements(req, env, workspaceId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceAiProfileMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/ai\/profile$/);
      if (workspaceAiProfileMatch) {
        const workspaceId = decodeURIComponent(workspaceAiProfileMatch[1]);
        if (req.method === 'GET') return handleWorkspaceAiProfile(req, env, workspaceId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceAiLimitsMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/ai\/limits$/);
      if (workspaceAiLimitsMatch) {
        const workspaceId = decodeURIComponent(workspaceAiLimitsMatch[1]);
        if (req.method === 'GET') return handleWorkspaceAiLimits(req, env, workspaceId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceAiOutcomesMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/ai\/outcomes$/);
      if (workspaceAiOutcomesMatch) {
        const workspaceId = decodeURIComponent(workspaceAiOutcomesMatch[1]);
        if (req.method === 'GET') return handleWorkspaceAiOutcomes(req, env, workspaceId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceMatch = pathname.match(/^\/api\/workspaces\/([^/]+)$/);
      if (workspaceMatch) {
        const workspaceId = decodeURIComponent(workspaceMatch[1]);
        if (req.method === 'GET') return handleWorkspaceGet(req, env, workspaceId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const accountWorkspacesMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/workspaces$/);
      if (accountWorkspacesMatch) {
        const accountId = decodeURIComponent(accountWorkspacesMatch[1]);
        if (req.method === 'GET') return handleAccountWorkspaces(req, env, accountId);
        if (req.method === 'POST') return handleAccountCreateWorkspace(req, env, accountId);
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

      const accountAssetContentMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/assets\/([^/]+)\/content$/);
      if (accountAssetContentMatch) {
        const accountId = decodeURIComponent(accountAssetContentMatch[1]);
        const assetId = decodeURIComponent(accountAssetContentMatch[2]);
        if (req.method === 'PUT') return handleAccountAssetReplaceContent(req, env, accountId, assetId);
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
    ctx.waitUntil(handleFrozenResets(env));
  },
};

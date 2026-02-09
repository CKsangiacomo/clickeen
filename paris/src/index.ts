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
  handleCreateInstance,
  handleCuratedInstances,
  handleGetInstance,
  handleInstances,
  handleListWidgets,
  handleUpdateInstance,
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'OPTIONS') return corsPreflight(req);
      if (pathname === '/api/healthz') return handleHealthz();

      if (pathname === '/api/l10n/jobs/report') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleL10nGenerateReport(req, env);
      }

      if (pathname === '/api/usage') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleUsageEvent(req, env);
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

      if (pathname === '/api/widgets') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleListWidgets(req, env);
      }

      if (pathname === '/api/instances') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleInstances(req, env);
      }

      if (pathname === '/api/curated-instances') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleCuratedInstances(req, env);
      }

      if (pathname === '/api/instance') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleCreateInstance(req, env);
      }

      const instanceMatch = pathname.match(/^\/api\/instance\/([^/]+)$/);
      if (instanceMatch) {
        const publicId = decodeURIComponent(instanceMatch[1]);
        if (req.method === 'GET') return handleGetInstance(req, env, publicId);
        if (req.method === 'PUT') return handleUpdateInstance(req, env, publicId);
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

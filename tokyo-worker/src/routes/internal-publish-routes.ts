import { normalizeStorageId } from '../asset-utils';
import {
  publishAccountInstanceTransition,
  restorePaidTierServing,
  unpublishAccountInstanceTransition,
} from '../domains/render';
import { json } from '../http';
import {
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
  requireDevAuth,
} from '../auth';
import {
  isValidScopedInstance,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import {
  authorizeRomaEditorTransition,
  normalizeAccountPublicId,
  transitionErrorResponse,
} from './internal-render-route-utils';

export async function tryHandleInternalPublishRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalAccountRestorePaidServingMatch = pathname.match(/^\/__internal\/accounts\/([^/]+)\/serving\/restore-paid$/);
  if (internalAccountRestorePaidServingMatch) {
    const pathAccountId = normalizeAccountPublicId(decodeURIComponent(internalAccountRestorePaidServingMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !pathAccountId || pathAccountId !== accountId) {
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const authErr = requireDevAuth(req, env, {
      allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
    });
    if (authErr) return respond(authErr);

    try {
      const restored = await restorePaidTierServing({ env, accountId });
      return respond(json({ ok: true, ...restored }));
    } catch (error) {
      return respond(transitionErrorResponse(error));
    }
  }

  const internalInstancePublishMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/(publish|unpublish)$/);
  if (internalInstancePublishMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalInstancePublishMatch[1] || ''));
    const action = internalInstancePublishMatch[2] === 'publish' ? 'publish' : 'unpublish';
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    try {
      const transition = action === 'publish'
        ? await publishAccountInstanceTransition({ env, accountId, instanceId })
        : await unpublishAccountInstanceTransition({ env, accountId, instanceId });
      return respond(json({ ok: true, ...transition }));
    } catch (error) {
      return respond(transitionErrorResponse(error));
    }
  }

  return null;
}

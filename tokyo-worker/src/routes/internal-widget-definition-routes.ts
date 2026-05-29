import { listWidgetDefinitions } from '../domains/widget-catalog';
import { json } from '../http';
import {
  authorizeRomaAccountScopedRequest,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import {
  normalizeAccountPublicId,
} from './internal-render-route-utils';

export async function tryHandleInternalWidgetDefinitionRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  if (pathname === '/__internal/widgets/definitions') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'GET') {
      return respondMethodNotAllowed(respond);
    }
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);
    return respond(json({ ok: true, widgetDefinitions: listWidgetDefinitions() }));
  }

  return null;
}

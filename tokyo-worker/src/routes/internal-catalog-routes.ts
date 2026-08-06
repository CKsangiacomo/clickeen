import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import {
  CatalogReadError,
  listClickeenWidgetCatalog,
  readClickeenWidgetCatalogTemplate,
} from '../domains/catalog';
import { json } from '../http';
import {
  authorizeRomaAccountScopedRequest,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import { normalizeAccountPublicId } from './internal-product-route-utils';

function catalogFailure(error: unknown): Response {
  if (error instanceof CatalogReadError) {
    return json({ error: { kind: 'VALIDATION', reasonKey: error.reasonKey } }, { status: error.status });
  }
  return json({ error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'tokyo.errors.catalog.readFailed' } }, { status: 502 });
}

export async function tryHandleInternalCatalogRoutes(args: TokyoRouteArgs): Promise<Response | null> {
  const { req, env, pathname, respond } = args;
  const widgetOpen = pathname.match(/^\/__internal\/catalog\/widgets\/([^/]+)$/);
  if (pathname !== '/__internal/catalog/widgets' && !widgetOpen) return null;
  if (req.method !== 'GET') return respondMethodNotAllowed(respond);
  const callerAccountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
  if (!callerAccountId) return respondValidation(respond, 'coreui.errors.accountId.invalid');
  const authError = await authorizeRomaAccountScopedRequest({
    req,
    env,
    accountId: callerAccountId,
    minRole: 'viewer',
  });
  if (authError) return respond(authError);

  try {
    if (pathname === '/__internal/catalog/widgets') {
      return respond(json({ ok: true, templates: await listClickeenWidgetCatalog(env) }));
    }
    if (widgetOpen) {
      const templateId = decodeURIComponent(widgetOpen[1] || '');
      if (!isCompactInstanceId(templateId)) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
      const template = await readClickeenWidgetCatalogTemplate(env, templateId);
      return template
        ? respond(json({ ok: true, template }))
        : respond(json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } }, { status: 404 }));
    }
    return null;
  } catch (error) {
    return respond(catalogFailure(error));
  }
}

import { isCompactInstanceId, isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import {
  CatalogReadError,
  listClickeenPageCatalog,
  listClickeenWidgetCatalog,
  readClickeenPageCatalogTemplate,
  readClickeenWidgetCatalogTemplate,
} from '../domains/catalog';
import { PageOperationError } from '../domains/pages/types';
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
  if (error instanceof PageOperationError) {
    return json({ error: { kind: error.kind, reasonKey: error.reasonKey } }, { status: error.status });
  }
  return json({ error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'tokyo.errors.catalog.readFailed' } }, { status: 502 });
}

export async function tryHandleInternalCatalogRoutes(args: TokyoRouteArgs): Promise<Response | null> {
  const { req, env, pathname, respond } = args;
  const widgetOpen = pathname.match(/^\/__internal\/catalog\/widgets\/([^/]+)$/);
  const pageOpen = pathname.match(/^\/__internal\/catalog\/pages\/([^/]+)$/);
  if (pathname !== '/__internal/catalog/widgets' && pathname !== '/__internal/catalog/pages' && !widgetOpen && !pageOpen) return null;
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
    if (pathname === '/__internal/catalog/pages') {
      return respond(json({ ok: true, templates: await listClickeenPageCatalog(env) }));
    }
    if (widgetOpen) {
      const templateId = decodeURIComponent(widgetOpen[1] || '');
      if (!isCompactInstanceId(templateId)) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
      const template = await readClickeenWidgetCatalogTemplate(env, templateId);
      return template
        ? respond(json({ ok: true, template }))
        : respond(json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } }, { status: 404 }));
    }
    const pageId = decodeURIComponent(pageOpen?.[1] || '');
    if (!isCompactPageId(pageId)) return respondValidation(respond, 'tokyo.errors.page.invalidPageId');
    const template = await readClickeenPageCatalogTemplate(env, pageId);
    return template
      ? respond(json({ ok: true, template }))
      : respond(json({ error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' } }, { status: 404 }));
  } catch (error) {
    return respond(catalogFailure(error));
  }
}

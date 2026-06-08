import { isRecord } from '@clickeen/ck-contracts';
import {
  readOrSeedAccountWidgetDefaults,
  writeAccountWidgetDefaults,
  type AccountWidgetDefaultsDocument,
} from '../domains/account-widget-defaults';
import { json } from '../http';
import {
  authorizeRomaAccountScopedRequest,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import {
  normalizeAccountPublicId,
  readInternalProductJsonBody,
} from './internal-product-route-utils';

function widgetDefaultsErrorResponse(error: unknown): Response {
  const detail = error instanceof Error ? error.message : String(error);
  return json(
    {
      error: {
        kind: 'VALIDATION',
        reasonKey: detail,
        detail,
      },
    },
    { status: 422 },
  );
}

export async function tryHandleInternalWidgetDefaultRoutes(args: TokyoRouteArgs): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const match = pathname.match(/^\/__internal\/accounts\/([^/]+)\/widget-defaults$/);
  if (!match) return null;

  const pathAccountId = normalizeAccountPublicId(decodeURIComponent(match[1] || ''));
  const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
  if (!accountId || !pathAccountId || pathAccountId !== accountId) {
    return respondValidation(respond, 'coreui.errors.instance.invalidPayload', accountId ? 403 : 422);
  }

  if (req.method === 'GET') {
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);

    try {
      const widgetDefaults = await readOrSeedAccountWidgetDefaults({ env, accountId });
      return respond(json({ ok: true, accountId, widgetDefaults }));
    } catch (error) {
      return respond(widgetDefaultsErrorResponse(error));
    }
  }

  if (req.method === 'PUT') {
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);

    const body = await readInternalProductJsonBody({
      req,
      env,
      boundary: 'internal.widgetDefaults.save.body',
      accountId,
    });
    const widgetDefaults = isRecord(body) && isRecord(body.widgetDefaults) ? body.widgetDefaults : body;
    if (!isRecord(widgetDefaults)) {
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    }

    try {
      const saved = await writeAccountWidgetDefaults({
        env,
        accountId,
        widgetDefaults: widgetDefaults as AccountWidgetDefaultsDocument,
      });
      return respond(json({ ok: true, accountId, widgetDefaults: saved }));
    } catch (error) {
      return respond(widgetDefaultsErrorResponse(error));
    }
  }

  return respondMethodNotAllowed(respond);
}

import { normalizeStorageId } from '../asset-utils';
import {
  deleteAccountInstanceTranslatedLocaleValues,
  listAccountInstanceTranslatedLocaleValues,
  readAccountInstanceTranslatedLocaleValues,
  writeAccountInstanceTranslatedLocaleValues,
} from '../domains/account-translations/values';
import { readAccountInstanceDocument } from '../domains/account-instances/source';
import { json } from '../http';
import {
  authorizeAccountInstanceControlRequest,
  isValidScopedInstance,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import {
  authorizeTranslatedLocaleWriteTransition,
  normalizeAccountPublicId,
  normalizeTranslatedValues,
  readInternalProductJsonBody,
} from './internal-product-route-utils';

export async function tryHandleInternalTranslationRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalTranslationsListMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/translations$/);
  if (internalTranslationsListMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalTranslationsListMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload', accountId ? 403 : 422);
    }
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const authErr = await authorizeAccountInstanceControlRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);

    const instance = await readAccountInstanceDocument({ env, accountId, instanceId });
    if (!instance.ok) {
      return respond(
        json(
          { error: { kind: instance.kind, reasonKey: instance.reasonKey } },
          { status: instance.kind === 'NOT_FOUND' ? 404 : 422 },
        ),
      );
    }
    const translations = await listAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId });
    return respond(json({
      ok: true,
      v: 1,
      baseLocale: instance.value.baseLocale,
      translations,
    }));
  }

  const internalTranslationValuesMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/translations\/([^/]+)$/);
  if (internalTranslationValuesMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalTranslationValuesMatch[1] || ''));
    const locale = String(decodeURIComponent(internalTranslationValuesMatch[2] || '')).trim();
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !locale || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload', accountId ? 403 : 422);
    }

    if (req.method === 'GET') {
      const authErr = await authorizeAccountInstanceControlRequest({
        req,
        env,
        accountId,
        minRole: 'viewer',
      });
      if (authErr) return respond(authErr);

      const translation = await readAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId, locale });
      if (!translation.ok) {
        return respond(json({ error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' } }, { status: 404 }));
      }
      return respond(json({ ok: true, v: 1, ...translation.value }));
    }

    if (req.method === 'PUT') {
      const auth = await authorizeTranslatedLocaleWriteTransition({ req, env, accountId, instanceId, locale });
      if (!auth.ok) return respond(auth.response);

      const body = (await readInternalProductJsonBody({
        req,
        env,
        boundary: 'internal.instance.translationValues.body',
        accountId,
      })) as Record<string, unknown> | null;
      const values = normalizeTranslatedValues(body?.values);
      if (!values) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');

      try {
        const translation = await writeAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId, locale, values });
        return respond(json({ ok: true, v: 1, locale: translation.locale }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return respond(json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }));
      }
    }

    if (req.method === 'DELETE') {
      const authErr = await authorizeAccountInstanceControlRequest({
        req,
        env,
        accountId,
        minRole: 'admin',
      });
      if (authErr) return respond(authErr);

      try {
        const translation = await deleteAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId, locale });
        return respond(json({ ok: true, v: 1, locale: translation.locale }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return respond(json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }));
      }
    }

    return respondMethodNotAllowed(respond);
  }

  return null;
}

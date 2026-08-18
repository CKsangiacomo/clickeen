import { normalizeLocale, normalizeStorageId } from '../asset-utils';
import {
  deleteAccountInstanceTranslatedLocaleValues,
  listAccountInstanceTranslatedLocaleValues,
  readAccountInstanceTranslatedLocaleValues,
  writeAccountInstanceTranslatedLocaleValues,
} from '../domains/account-translations/values';
import { json } from '../http';
import {
  authorizeAccountInstanceControlRequest,
  isValidScopedInstance,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import {
  authorizeRomaEditorTransition,
  authorizeTranslatedLocaleWriteTransition,
  normalizeAccountPublicId,
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

    const translations = await listAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId });
    if (!translations.ok) {
      return respond(
        json(
          { error: { kind: translations.kind, reasonKey: translations.reasonKey } },
          { status: translations.kind === 'NOT_FOUND' ? 404 : 422 },
        ),
      );
    }
    return respond(json({
      ok: true,
      ...translations.value,
    }));
  }

  const internalTranslationValuesMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/translations\/([^/]+)$/);
  if (internalTranslationValuesMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalTranslationValuesMatch[1] || ''));
    const locale = normalizeLocale(decodeURIComponent(internalTranslationValuesMatch[2] || ''));
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
        return respond(
          json(
            { error: { kind: translation.kind, reasonKey: translation.reasonKey } },
            { status: translation.kind === 'NOT_FOUND' ? 404 : 422 },
          ),
        );
      }
      return respond(json({ ok: true, ...translation.value }));
    }

    if (req.method === 'PUT') {
      const auth = await authorizeTranslatedLocaleWriteTransition({ req, env, accountId, instanceId, locale });
      if (!auth.ok) return respond(auth.response);

      const body = (await readInternalProductJsonBody({
        req,
        env,
        boundary: 'internal.instance.translationValues.body',
        accountId,
      })) as { values: Record<string, string> };

      try {
        const translation = await writeAccountInstanceTranslatedLocaleValues({
          env,
          accountId,
          instanceId,
          locale,
          values: body.values,
        });
        return respond(json({ ok: true, locale: translation.locale }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return respond(json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }));
      }
    }

    if (req.method === 'DELETE') {
      const auth = await authorizeRomaEditorTransition({ req, env, accountId });
      if (!auth.ok) return respond(auth.response);

      try {
        const translation = await deleteAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId, locale });
        return respond(json({ ok: true, locale: translation.locale }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return respond(json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }));
      }
    }

    return respondMethodNotAllowed(respond);
  }

  return null;
}

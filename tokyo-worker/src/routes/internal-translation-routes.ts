import { CK_REQUEST_ID_HEADER } from '@clickeen/ck-contracts';
import { normalizeStorageId } from '../asset-utils';
import {
  completeLocaleTranslation,
  failLocaleTranslation,
  generateInstanceTranslations,
  readInstanceTranslationGeneration,
} from '../domains/account-translations/operations';
import {
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
  authorizeRomaEditorTransition,
  authorizeTranslatedLocaleWriteTransition,
  authorizeTranslationCompletionTransition,
  normalizeAccountPublicId,
  normalizeTranslatedValues,
  readInternalProductJsonBody,
} from './internal-product-route-utils';

export async function tryHandleInternalTranslationRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalTranslationsGenerateMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/translations\/generate$/);
  if (internalTranslationsGenerateMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalTranslationsGenerateMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload', accountId ? 403 : 422);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    const body = (await readInternalProductJsonBody({
      req,
      env,
      boundary: 'internal.instance.translationGenerate.body',
      accountId,
      instanceId,
    })) as Record<string, unknown> | null;
    const translation = await generateInstanceTranslations({
      env,
      accountId,
      instanceId,
      authz: auth.capsule,
      baseLocale: body?.baseLocale,
      targetLocales: body?.targetLocales,
      requestId: req.headers.get(CK_REQUEST_ID_HEADER),
    });
    if (!translation.ok) {
      return respond(
        json(
          {
            ok: false,
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: translation.reasonKey,
              detail: translation.detail,
            },
            translation,
          },
          { status: 502 },
        ),
      );
    }
    return respond(json({ ok: true, translation }, { status: translation.accepted ? 202 : 200 }));
  }

  const internalTranslationsGenerationMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/translations\/generation$/);
  if (internalTranslationsGenerationMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalTranslationsGenerationMatch[1] || ''));
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

    const generation = await readInstanceTranslationGeneration({ env, accountId, instanceId });
    if (!generation.ok) {
      return respond(
        json(
          {
            ok: false,
            error: {
              kind: 'VALIDATION',
              reasonKey: generation.reasonKey,
              detail: generation.detail,
            },
            generation,
          },
          { status: 422 },
        ),
      );
    }
    return respond(json({ ok: true, generation: generation.generation }));
  }

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

  const internalTranslationCompletionMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/translations\/([^/]+)\/complete$/);
  if (internalTranslationCompletionMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalTranslationCompletionMatch[1] || ''));
    const locale = String(decodeURIComponent(internalTranslationCompletionMatch[2] || '')).trim();
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !locale || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload', accountId ? 403 : 422);
    }
    if (req.method !== 'PUT') return respondMethodNotAllowed(respond);
    const authErr = authorizeTranslationCompletionTransition(req);
    if (authErr) return respond(authErr);

    const body = (await readInternalProductJsonBody({
      req,
      env,
      boundary: 'internal.instance.translationComplete.body',
      accountId,
      instanceId,
    })) as Record<string, unknown> | null;
    const values = normalizeTranslatedValues(body?.values);
    if (!values) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');

    const completion = await completeLocaleTranslation({
      env,
      accountId,
      instanceId,
      locale,
      job: body?.job,
      values,
    });
    if (!completion.ok) {
      return respond(
        json(
          {
            ok: false,
            error: {
              kind: 'VALIDATION',
              reasonKey: completion.reasonKey,
              detail: completion.detail,
            },
            completion,
          },
          { status: 422 },
        ),
      );
    }
    return respond(json({ ok: true, completion }));
  }

  const internalTranslationFailureMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/translations\/([^/]+)\/fail$/);
  if (internalTranslationFailureMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalTranslationFailureMatch[1] || ''));
    const locale = String(decodeURIComponent(internalTranslationFailureMatch[2] || '')).trim();
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !locale || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload', accountId ? 403 : 422);
    }
    if (req.method !== 'PUT') return respondMethodNotAllowed(respond);
    const authErr = authorizeTranslationCompletionTransition(req);
    if (authErr) return respond(authErr);

    const body = (await readInternalProductJsonBody({
      req,
      env,
      boundary: 'internal.instance.translationFail.body',
      accountId,
      instanceId,
    })) as Record<string, unknown> | null;
    const failure = await failLocaleTranslation({
      env,
      accountId,
      instanceId,
      locale,
      job: body?.job,
      reasonKey: body?.reasonKey,
      detail: body?.detail,
    });
    if (!failure.ok) {
      return respond(
        json(
          {
            ok: false,
            error: {
              kind: 'VALIDATION',
              reasonKey: failure.reasonKey,
              detail: failure.detail,
            },
            failure,
          },
          { status: 422 },
        ),
      );
    }
    return respond(json({ ok: true, failure }));
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
      const auth = await authorizeTranslatedLocaleWriteTransition({ req, env, accountId });
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

    return respondMethodNotAllowed(respond);
  }

  return null;
}

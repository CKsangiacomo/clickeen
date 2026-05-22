import { CK_REQUEST_ID_HEADER, isRecord, serializeCkLogEvent } from '@clickeen/ck-contracts';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  normalizeStorageId,
} from '../asset-utils';
import {
  INTERNAL_SERVICE_HEADER,
  TOKYO_INTERNAL_SERVICE_SANFRANCISCO_TRANSLATION,
  assertRomaAccountCapsuleAuth,
  TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
} from '../auth';
import { json } from '../http';
import {
  AccountInstanceTransitionError,
  deleteAccountInstanceSubtree,
  duplicateAccountInstanceTransition,
  createAccountInstanceFromDefaults,
  listTranslatedLocales,
  completeLocaleTranslation,
  failLocaleTranslation,
  generateInstanceTranslations,
  listAccountInstances,
  publishAccountInstanceTransition,
  readAccountInstanceDocument,
  readInstanceTranslationGeneration,
  readTranslatedLocaleValues,
  renameAccountInstanceDisplay,
  saveAccountInstanceTransition,
  unpublishAccountInstanceTransition,
  writeTranslatedLocaleValues,
} from '../domains/render';
import {
  listWidgetDefinitions,
} from '../domains/widget-catalog';
import {
  authorizeRomaAccountScopedRequest,
  authorizeAccountInstanceControlRequest,
  isValidScopedInstance,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import { roleRank } from '../domains/assets';
import type { Env } from '../types';

function normalizeAccountPublicId(value: unknown): string {
  const accountId = String(value || '').trim().toUpperCase();
  return isCompactAccountPublicId(accountId) ? accountId : '';
}

function normalizeTranslatedValues(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const values: Record<string, string> = {};
  for (const [path, text] of Object.entries(value)) {
    if (!path || typeof text !== 'string') return null;
    values[path] = text;
  }
  return values;
}

function normalizeReasonText(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function transitionErrorResponse(error: unknown): Response {
  if (error instanceof AccountInstanceTransitionError) {
    return json(
      {
        error: {
          kind: error.kind,
          reasonKey: error.reasonKey,
          detail: error.message,
          ...(error.paths?.length ? { paths: error.paths } : {}),
        },
      },
      { status: error.status },
    );
  }
  const detail = error instanceof Error ? error.message : String(error);
  return json(
    {
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail,
      },
    },
    { status: 502 },
  );
}

function logInternalRenderWarning(args: {
  req: Request;
  env: Env;
  boundary: string;
  detail: string;
  instanceId?: string | null;
  accountId?: string | null;
}): void {
  console.warn(
    serializeCkLogEvent({
      event: 'boundary.parse_failed',
      service: 'tokyo-worker',
      stage: typeof args.env.ENV_STAGE === 'string' && args.env.ENV_STAGE.trim() ? args.env.ENV_STAGE.trim() : 'unknown',
      requestId: String(args.req.headers.get(CK_REQUEST_ID_HEADER) || '').trim() || crypto.randomUUID(),
      boundary: args.boundary,
      method: args.req.method,
      path: new URL(args.req.url).pathname,
      detail: args.detail,
      ...(args.instanceId ? { instanceId: args.instanceId } : {}),
      ...(args.accountId ? { accountId: args.accountId } : {}),
    }),
  );
}

async function readInternalRenderJsonBody(args: {
  req: Request;
  env: Env;
  boundary: string;
  instanceId?: string | null;
  accountId?: string | null;
}): Promise<unknown | null> {
  try {
    return await args.req.json();
  } catch (error) {
    logInternalRenderWarning({
      req: args.req,
      env: args.env,
      boundary: args.boundary,
      instanceId: args.instanceId,
      accountId: args.accountId,
      detail: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function authorizeRomaEditorTransition(args: {
  req: Request;
  env: Env;
  accountId: string;
}): Promise<
  | { ok: true; capsule: RomaAccountAuthzCapsulePayload }
  | { ok: false; response: Response }
> {
  const auth = await assertRomaAccountCapsuleAuth(args.req, args.env, {
    requiredInternalServiceId: TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
  });
  if (!auth.ok) return auth;
  const capsule = auth.principal.accountAuthz;
  if (capsule.accountPublicId !== args.accountId || roleRank(capsule.role) < roleRank('editor')) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
        { status: 403 },
      ),
    };
  }
  return { ok: true, capsule };
}

async function authorizeTranslatedLocaleWriteTransition(args: {
  req: Request;
  env: Env;
  accountId: string;
}): Promise<
  | { ok: true }
  | { ok: false; response: Response }
> {
  const internalServiceId = String(args.req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId === TOKYO_INTERNAL_SERVICE_SANFRANCISCO_TRANSLATION) {
    return { ok: true };
  }
  const auth = await authorizeRomaEditorTransition(args);
  return auth.ok ? { ok: true } : auth;
}

function authorizeTranslationCompletionTransition(req: Request): Response | null {
  const internalServiceId = String(req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId === TOKYO_INTERNAL_SERVICE_SANFRANCISCO_TRANSLATION) return null;
  return json(
    { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
    { status: 403 },
  );
}

export async function tryHandleInternalRenderRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalAccountInstancesListMatch = pathname.match(/^\/__internal\/accounts\/([^/]+)\/instances$/);
  if (internalAccountInstancesListMatch) {
    const pathAccountId = normalizeAccountPublicId(decodeURIComponent(internalAccountInstancesListMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !pathAccountId || pathAccountId !== accountId) {
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const authErr = await authorizeAccountInstanceControlRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);

    try {
      const accountInstances = await listAccountInstances({ env, accountId });
      return respond(
        json({
          ok: true,
          accountId,
          accountInstances,
          publishedCount: accountInstances.filter((entry) => entry.publishStatus === 'published').length,
        }),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }));
    }
  }

  if (pathname === '/__internal/instances') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) return respondValidation(respond, 'tokyo.errors.render.invalid');
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);

    const authErr = await authorizeAccountInstanceControlRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);

    const rawBody = await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.instance.create.body',
      accountId,
    });
    if (!isRecord(rawBody)) return respondValidation(respond, 'tokyo.errors.render.invalid');
    const widgetType = typeof rawBody.widgetType === 'string' ? rawBody.widgetType.trim() : '';
    if (!widgetType) return respondValidation(respond, 'tokyo.errors.render.invalid');

    try {
      const created = await createAccountInstanceFromDefaults({
        env,
        accountId,
        widgetType,
        displayName: rawBody.displayName,
      });
      return respond(
        json(
          {
            ok: true,
            accountId,
            instanceId: created.pointer.id,
            widgetCode: created.pointer.widgetCode,
            widgetType: created.pointer.widgetType,
            displayName: created.pointer.displayName,
            publishStatus: created.pointer.publishStatus,
            updatedAt: created.pointer.updatedAt,
            config: created.config,
          },
          { status: 201 },
        ),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(
        json(
          {
            error: {
              kind: detail === 'tokyo.errors.widget.unsupported' ? 'VALIDATION' : 'UPSTREAM_UNAVAILABLE',
              reasonKey: detail,
              detail,
            },
          },
          { status: detail === 'tokyo.errors.widget.unsupported' ? 422 : 502 },
        ),
      );
    }
  }

  const internalInstanceRenameMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/rename$/);
  if (internalInstanceRenameMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalInstanceRenameMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    const body = (await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.instance.rename.body',
      accountId,
      instanceId,
    })) as Record<string, unknown> | null;
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    if (!displayName) return respondValidation(respond, 'tokyo.errors.render.invalid');
    try {
      const renamed = await renameAccountInstanceDisplay({
        env,
        accountId,
        instanceId,
        displayName,
      });
      return respond(json({ ok: true, ...renamed }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(
        json(
          {
            error: {
              kind: detail === 'tokyo.errors.render.notFound' ? 'NOT_FOUND' : 'VALIDATION',
              reasonKey: detail,
              detail,
            },
          },
          { status: detail === 'tokyo.errors.render.notFound' ? 404 : 422 },
        ),
      );
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

  const internalInstanceDuplicateMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/duplicate$/);
  if (internalInstanceDuplicateMatch) {
    const sourceInstanceId = normalizeStorageId(decodeURIComponent(internalInstanceDuplicateMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !sourceInstanceId || !isValidScopedInstance(sourceInstanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    try {
      const duplicated = await duplicateAccountInstanceTransition({
        env,
        accountId,
        sourceInstanceId,
      });
      return respond(json({ ok: true, ...duplicated }, { status: 201 }));
    } catch (error) {
      return respond(transitionErrorResponse(error));
    }
  }

  const internalInstanceMatch = pathname.match(/^\/__internal\/instances\/([^/]+)$/);
  if (internalInstanceMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalInstanceMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }

    if (req.method === 'GET') {
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
      return respond(
        json({
          ok: true,
          accountId,
          instanceId: instance.value.id,
          widgetCode: instance.value.widgetCode,
          widgetType: instance.value.widgetType,
          displayName: instance.value.displayName,
          publishStatus: instance.value.publishStatus,
          updatedAt: instance.value.updatedAt,
          meta: instance.value.meta ?? null,
          config: instance.value.config,
        }),
      );
    }

    if (req.method === 'PUT') {
      const auth = await authorizeRomaEditorTransition({ req, env, accountId });
      if (!auth.ok) return respond(auth.response);

      const body = (await readInternalRenderJsonBody({
        req,
        env,
        boundary: 'internal.instance.save.body',
        instanceId,
        accountId,
      })) as Record<string, unknown> | null;
      if (!isRecord(body) || !isRecord(body.config)) {
        return respondValidation(respond, 'tokyo.errors.render.invalid');
      }
      try {
        const result = await saveAccountInstanceTransition({
          env,
          accountId,
          instanceId,
          submittedWidgetType: body.widgetType as string,
          config: body.config,
          displayName: body.displayName,
          hasDisplayName: Object.prototype.hasOwnProperty.call(body, 'displayName'),
          meta: body.meta,
          hasMeta: Object.prototype.hasOwnProperty.call(body, 'meta'),
        });
        return respond(
          json({
            ok: true,
            instanceId,
            widgetType: result.pointer.widgetType,
            displayName: result.pointer.displayName,
            publishStatus: result.pointer.publishStatus,
            updatedAt: result.pointer.updatedAt,
            live: result.live,
          }),
        );
      } catch (error) {
        return respond(transitionErrorResponse(error));
      }
    }

    if (req.method === 'DELETE') {
      const auth = await authorizeRomaEditorTransition({ req, env, accountId });
      if (!auth.ok) return respond(auth.response);
      const deleted = await deleteAccountInstanceSubtree(env, instanceId, accountId);
      return respond(json({ ok: true, deleted: deleted.existed, existed: deleted.existed }));
    }

    return respondMethodNotAllowed(respond);
  }

  const internalTranslationsGenerateMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/translations\/generate$/);
  if (internalTranslationsGenerateMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalTranslationsGenerateMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    const body = (await readInternalRenderJsonBody({
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
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
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
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
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
    const translations = await listTranslatedLocales({ env, accountId, instanceId });
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
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }
    if (req.method !== 'PUT') return respondMethodNotAllowed(respond);
    const authErr = authorizeTranslationCompletionTransition(req);
    if (authErr) return respond(authErr);

    const body = (await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.instance.translationComplete.body',
      accountId,
      instanceId,
    })) as Record<string, unknown> | null;
    const values = normalizeTranslatedValues(body?.values);
    if (!values) return respondValidation(respond, 'tokyo.errors.render.invalid');

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
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }
    if (req.method !== 'PUT') return respondMethodNotAllowed(respond);
    const authErr = authorizeTranslationCompletionTransition(req);
    if (authErr) return respond(authErr);

    const body = (await readInternalRenderJsonBody({
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
      reasonKey: normalizeReasonText(body?.reasonKey, 'instance.translation.failed'),
      detail: normalizeReasonText(body?.detail, 'Translation generation failed.'),
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
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
    }

    if (req.method === 'GET') {
      const authErr = await authorizeAccountInstanceControlRequest({
        req,
        env,
        accountId,
        minRole: 'viewer',
      });
      if (authErr) return respond(authErr);

      const translation = await readTranslatedLocaleValues({ env, accountId, instanceId, locale });
      if (!translation) {
        return respond(json({ error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' } }, { status: 404 }));
      }
      return respond(json({ ok: true, v: 1, ...translation }));
    }

    if (req.method === 'PUT') {
      const auth = await authorizeTranslatedLocaleWriteTransition({ req, env, accountId });
      if (!auth.ok) return respond(auth.response);

      const body = (await readInternalRenderJsonBody({
        req,
        env,
        boundary: 'internal.instance.translationValues.body',
        accountId,
      })) as Record<string, unknown> | null;
      const values = normalizeTranslatedValues(body?.values);
      if (!values) return respondValidation(respond, 'tokyo.errors.render.invalid');

      try {
        const translation = await writeTranslatedLocaleValues({ env, accountId, instanceId, locale, values });
        return respond(json({ ok: true, v: 1, locale: translation.locale }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return respond(json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }));
      }
    }

    return respondMethodNotAllowed(respond);
  }

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

import { isRecord } from '@clickeen/ck-contracts';
import { normalizeLocale, normalizeStorageId } from '../asset-utils';
import {
  createAccountInstanceFromSubmittedSource,
  publishAccountInstanceTransition,
  saveAccountInstanceTransition,
  unpublishAccountInstanceTransition,
} from '../domains/account-instances/operations';
import { deleteAccountInstanceSubtree } from '../domains/account-instances/delete';
import {
  readInstancePublicPackage,
  readSubmittedInstancePublicPackage,
} from '../domains/account-instances/package-files';
import {
  listAccountInstances,
  readAccountInstanceDocument,
  renameAccountInstanceDisplay,
} from '../domains/account-instances/source';
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
  normalizeAccountPublicId,
  readInternalProductJsonBody,
  transitionErrorResponse,
} from './internal-product-route-utils';

function normalizeSubmittedMeta(value: unknown): Record<string, unknown> | null {
  if (value == null) return {};
  return isRecord(value) ? { ...value } : null;
}

function normalizeSubmittedTargetLocales(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const locales: string[] = [];
  for (const entry of value) {
    const locale = normalizeLocale(entry);
    if (!locale) return null;
    if (!locales.includes(locale)) locales.push(locale);
  }
  return locales;
}

export async function tryHandleInternalInstanceRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalAccountInstancesListMatch = pathname.match(/^\/__internal\/accounts\/([^/]+)\/instances$/);
  if (internalAccountInstancesListMatch) {
    const pathAccountId = normalizeAccountPublicId(decodeURIComponent(internalAccountInstancesListMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !pathAccountId || pathAccountId !== accountId) {
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
    if (!accountId) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);

    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    const rawBody = await readInternalProductJsonBody({
      req,
      env,
      boundary: 'internal.instance.create.body',
      accountId,
    });
    if (!isRecord(rawBody)) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    const widgetType = typeof rawBody.widgetType === 'string' ? rawBody.widgetType.trim() : '';
    if (!widgetType) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    const source = isRecord(rawBody.source) ? rawBody.source : null;
    const config = isRecord(source?.config) ? source.config : null;
    const instanceId = normalizeStorageId(rawBody.instanceId);
    const publicPackage = readSubmittedInstancePublicPackage(rawBody.publicPackage);
    const submittedMeta = normalizeSubmittedMeta(rawBody.meta);
    if (!submittedMeta) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    const baseLocale = normalizeLocale(rawBody.baseLocale ?? submittedMeta.baseLocale);
    const targetLocales = normalizeSubmittedTargetLocales(
      Object.prototype.hasOwnProperty.call(rawBody, 'targetLocales')
        ? rawBody.targetLocales
        : submittedMeta.targetLocales,
    );
    if (!instanceId || !config || !publicPackage || !baseLocale || !targetLocales) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    const meta = {
      ...submittedMeta,
      baseLocale,
      targetLocales,
    };

    try {
      const created = await createAccountInstanceFromSubmittedSource({
        env,
        accountId,
        instanceId,
        widgetType,
        displayName: rawBody.displayName,
        config,
        meta,
        publicPackage,
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
      return respond(transitionErrorResponse(error));
    }
  }

  const internalInstanceRenameMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/rename$/);
  if (internalInstanceRenameMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalInstanceRenameMatch[1] || ''));
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
      boundary: 'internal.instance.rename.body',
      accountId,
      instanceId,
    })) as Record<string, unknown> | null;
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    if (!displayName) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
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
              kind: detail === 'coreui.errors.instance.notFound' ? 'NOT_FOUND' : 'VALIDATION',
              reasonKey: detail,
              detail,
            },
          },
          { status: detail === 'coreui.errors.instance.notFound' ? 404 : 422 },
        ),
      );
    }
  }

  const internalInstanceDuplicateMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/duplicate$/);
  if (internalInstanceDuplicateMatch) {
    const sourceInstanceId = normalizeStorageId(decodeURIComponent(internalInstanceDuplicateMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !sourceInstanceId || !isValidScopedInstance(sourceInstanceId, accountId)) {
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload', accountId ? 403 : 422);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    return respondValidation(respond, 'coreui.errors.instance.duplicateUnsupported', 410);
  }

  const internalInstancePublishMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/(publish|unpublish)$/);
  if (internalInstancePublishMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalInstancePublishMatch[1] || ''));
    const action = internalInstancePublishMatch[2] === 'publish' ? 'publish' : 'unpublish';
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload', accountId ? 403 : 422);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    try {
      const transition = action === 'publish'
        ? await publishAccountInstanceTransition({
            env,
            accountId,
            instanceId,
          })
        : await unpublishAccountInstanceTransition({ env, accountId, instanceId });
      return respond(json({ ok: true, ...transition }));
    } catch (error) {
      return respond(transitionErrorResponse(error));
    }
  }

  const internalInstancePackageMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/package$/);
  if (internalInstancePackageMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalInstancePackageMatch[1] || ''));
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

    try {
      const publicPackage = await readInstancePublicPackage({ env, accountId, instanceId });
      if (!publicPackage) {
        return respond(
          json(
            { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.publicPackageNotFound' } },
            { status: 404 },
          ),
        );
      }
      return respond(json({ ok: true, accountId, instanceId, publicPackage }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(
        json(
          {
            error: {
              kind: 'VALIDATION',
              reasonKey: 'coreui.errors.instance.embedNotReady',
              detail,
            },
          },
          { status: 409 },
        ),
      );
    }
  }

  const internalInstanceMatch = pathname.match(/^\/__internal\/instances\/([^/]+)$/);
  if (internalInstanceMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalInstanceMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
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
          baseLocale: instance.value.baseLocale,
          targetLocales: instance.value.targetLocales,
          meta: instance.value.meta ?? null,
          config: instance.value.config,
        }),
      );
    }

    if (req.method === 'PUT') {
      const auth = await authorizeRomaEditorTransition({ req, env, accountId });
      if (!auth.ok) return respond(auth.response);

      const body = (await readInternalProductJsonBody({
        req,
        env,
        boundary: 'internal.instance.save.body',
        instanceId,
        accountId,
      })) as Record<string, unknown> | null;
      const publicPackage = isRecord(body) ? readSubmittedInstancePublicPackage(body.publicPackage) : null;
      if (!isRecord(body) || !isRecord(body.config) || !publicPackage) {
        return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
      }
      try {
        const result = await saveAccountInstanceTransition({
          env,
          accountId,
          instanceId,
          submittedWidgetType: body.widgetType as string,
          config: body.config,
          publicPackage,
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

  return null;
}

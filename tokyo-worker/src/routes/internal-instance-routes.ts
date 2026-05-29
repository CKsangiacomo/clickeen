import { isRecord } from '@clickeen/ck-contracts';
import { normalizeStorageId } from '../asset-utils';
import {
  createAccountInstanceFromDefaults,
  deleteAccountInstanceSubtree,
  duplicateAccountInstanceTransition,
  listAccountInstances,
  readAccountInstanceDocument,
  renameAccountInstanceDisplay,
  saveAccountInstanceTransition,
} from '../domains/render';
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
  readInternalRenderJsonBody,
  transitionErrorResponse,
} from './internal-render-route-utils';

export async function tryHandleInternalInstanceRoutes(
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

  return null;
}

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
  verifyInstancePublicPackageReady,
} from '../domains/account-instances/package-files';
import {
  listAccountInstances,
  readAccountInstanceSource,
  readAccountInstanceSourcePointer,
  renameAccountInstanceDisplay,
} from '../domains/account-instances/source';
import { normalizeAccountInstanceContentDocument } from '../domains/account-instances/normalize';
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
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = {};
  const allowedKeys = new Set(['baseLocale', 'styleName', 'name', 'title']);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) return null;
  }
  for (const key of ['baseLocale', 'styleName', 'name', 'title']) {
    const entry = value[key];
    if (typeof entry === 'string' && entry.trim()) out[key] = entry.trim();
  }
  return out;
}

export async function tryHandleInternalInstanceRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalAccountInstanceFactsMatch = pathname.match(
    /^\/__internal\/accounts\/([^/]+)\/instances\/facts$/,
  );
  if (internalAccountInstanceFactsMatch) {
    const pathAccountId = normalizeAccountPublicId(
      decodeURIComponent(internalAccountInstanceFactsMatch[1] || ''),
    );
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !pathAccountId || pathAccountId !== accountId) {
      return respondValidation(
        respond,
        'coreui.errors.instance.invalidPayload',
        accountId ? 403 : 422,
      );
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
      const hasInstances = (await listAccountInstances({ env, accountId })).length > 0;
      return respond(json({ ok: true, accountId, hasInstances }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(
        json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: 'coreui.errors.db.readFailed',
              detail,
            },
          },
          { status: 502 },
        ),
      );
    }
  }

  const internalAccountInstancesListMatch = pathname.match(
    /^\/__internal\/accounts\/([^/]+)\/instances$/,
  );
  if (internalAccountInstancesListMatch) {
    const pathAccountId = normalizeAccountPublicId(
      decodeURIComponent(internalAccountInstancesListMatch[1] || ''),
    );
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !pathAccountId || pathAccountId !== accountId) {
      return respondValidation(
        respond,
        'coreui.errors.instance.invalidPayload',
        accountId ? 403 : 422,
      );
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
          publishedCount: accountInstances.filter((entry) => entry.publishStatus === 'published')
            .length,
        }),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(
        json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }),
      );
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
    if (!isRecord(rawBody))
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    const widgetType = typeof rawBody.widgetType === 'string' ? rawBody.widgetType.trim() : '';
    if (!widgetType) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    const source = isRecord(rawBody.source) ? rawBody.source : null;
    const config = isRecord(source?.config) ? source.config : null;
    const content = normalizeAccountInstanceContentDocument(source?.content);
    const instanceId = normalizeStorageId(rawBody.instanceId);
    const publicPackage = readSubmittedInstancePublicPackage(rawBody.publicPackage);
    const submittedMeta = normalizeSubmittedMeta(rawBody.meta);
    if (!submittedMeta) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    const baseLocale = normalizeLocale(rawBody.baseLocale);
    if (!instanceId || !config || !content || !publicPackage || !baseLocale)
      return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    const meta = {
      ...submittedMeta,
      baseLocale,
    };

    try {
      const created = await createAccountInstanceFromSubmittedSource({
        env,
        accountId,
        instanceId,
        widgetType,
        displayName: rawBody.displayName,
        config,
        content,
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
            source: {
              config: created.config,
              content: created.content,
            },
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
      return respondValidation(
        respond,
        'coreui.errors.instance.invalidPayload',
        accountId ? 403 : 422,
      );
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

  const internalInstancePublishMatch = pathname.match(
    /^\/__internal\/instances\/([^/]+)\/(publish|unpublish)$/,
  );
  if (internalInstancePublishMatch) {
    const instanceId = normalizeStorageId(
      decodeURIComponent(internalInstancePublishMatch[1] || ''),
    );
    const action = internalInstancePublishMatch[2] === 'publish' ? 'publish' : 'unpublish';
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(
        respond,
        'coreui.errors.instance.invalidPayload',
        accountId ? 403 : 422,
      );
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    try {
      const transition =
        action === 'publish'
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

  const internalInstancePackageMatch = pathname.match(
    /^\/__internal\/instances\/([^/]+)\/package$/,
  );
  if (internalInstancePackageMatch) {
    const instanceId = normalizeStorageId(
      decodeURIComponent(internalInstancePackageMatch[1] || ''),
    );
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(
        respond,
        'coreui.errors.instance.invalidPayload',
        accountId ? 403 : 422,
      );
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
      const pointer = await readAccountInstanceSourcePointer({ env, accountId, instanceId });
      if (!pointer.ok) {
        return respond(
          json(
            { error: { kind: pointer.kind, reasonKey: pointer.reasonKey } },
            { status: pointer.kind === 'NOT_FOUND' ? 404 : 422 },
          ),
        );
      }
      const packageReady = await verifyInstancePublicPackageReady({
        env,
        accountId,
        instanceId,
        expectedFingerprint: pointer.value.publicPackageFingerprint ?? null,
      });
      if (!packageReady.ok) {
        return respond(
          json(
            {
              error: {
                kind: 'VALIDATION',
                reasonKey: 'coreui.errors.instance.embedNotReady',
                detail: packageReady.detail,
              },
            },
            { status: 409 },
          ),
        );
      }
      const publicPackage = await readInstancePublicPackage({
        env,
        accountId,
        instanceId,
        expectedFingerprint: pointer.value.publicPackageFingerprint ?? null,
      });
      if (!publicPackage) {
        return respond(
          json(
            {
              error: {
                kind: 'NOT_FOUND',
                reasonKey: 'coreui.errors.instance.publicPackageNotFound',
              },
            },
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
      return respondValidation(
        respond,
        'coreui.errors.instance.invalidPayload',
        accountId ? 403 : 422,
      );
    }

    if (req.method === 'GET') {
      const authErr = await authorizeAccountInstanceControlRequest({
        req,
        env,
        accountId,
        minRole: 'viewer',
      });
      if (authErr) return respond(authErr);
      const source = await readAccountInstanceSource({ env, accountId, instanceId });
      if (!source.ok) {
        return respond(
          json(
            { error: { kind: source.kind, reasonKey: source.reasonKey } },
            { status: source.kind === 'NOT_FOUND' ? 404 : 422 },
          ),
        );
      }
      const { pointer } = source.value;
      return respond(
        json({
          ok: true,
          accountId,
          instanceId: pointer.id,
          widgetCode: pointer.widgetCode,
          widgetType: pointer.widgetType,
          displayName: pointer.displayName,
          publishStatus: pointer.publishStatus,
          updatedAt: pointer.updatedAt,
          baseLocale: pointer.baseLocale,
          meta: pointer.meta ?? null,
          source: {
            config: source.value.config,
            content: source.value.content,
          },
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
      const source = isRecord(body?.source) ? body.source : null;
      const config = isRecord(source?.config) ? source.config : null;
      const content = normalizeAccountInstanceContentDocument(source?.content);
      const publicPackage = isRecord(body)
        ? readSubmittedInstancePublicPackage(body.publicPackage)
        : null;
      const baseLocale = normalizeLocale(body?.baseLocale);
      const hasMeta = isRecord(body) && Object.prototype.hasOwnProperty.call(body, 'meta');
      const submittedMeta = hasMeta ? normalizeSubmittedMeta(body.meta) : {};
      if (
        !isRecord(body) ||
        !config ||
        !content ||
        !publicPackage ||
        !baseLocale ||
        !submittedMeta
      ) {
        return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
      }
      try {
        const result = await saveAccountInstanceTransition({
          env,
          accountId,
          instanceId,
          submittedWidgetType: body.widgetType as string,
          config,
          content,
          publicPackage,
          baseLocale,
          displayName: body.displayName,
          hasDisplayName: Object.prototype.hasOwnProperty.call(body, 'displayName'),
          meta: submittedMeta,
          hasMeta,
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
      try {
        const deleted = await deleteAccountInstanceSubtree(env, instanceId, accountId);
        if (!deleted.existed) {
          return respond(
            json(
              { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } },
              { status: 404 },
            ),
          );
        }
        return respond(json({ ok: true, deleted: deleted.existed, existed: deleted.existed }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return respond(
          json(
            {
              error: {
                kind: 'UPSTREAM_UNAVAILABLE',
                reasonKey: 'coreui.errors.db.writeFailed',
                detail,
              },
            },
            { status: 502 },
          ),
        );
      }
    }

    return respondMethodNotAllowed(respond);
  }

  return null;
}

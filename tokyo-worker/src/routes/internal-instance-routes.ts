import { normalizeStorageId } from '../asset-utils';
import {
  createAccountInstanceFromSubmittedSource,
  deleteAccountInstanceTransition,
  saveAccountInstanceSource,
  unpublishAccountInstanceTransition,
} from '../domains/account-instances/operations';
import { coordinateAccountInstancePublish } from '../domains/account-instances/publication-coordinator';
import type { SubmittedInstancePublicPackage } from '../domains/account-instances/package-files';
import type { AccountInstanceContentDocument } from '../domains/account-instances/types';
import {
  AccountInstanceCoordinateError,
  listAccountInstanceIds,
  readAccountInstanceSource,
  readAccountInstanceSourcePointer,
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

export async function tryHandleInternalInstanceRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

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
      const instanceIds = await listAccountInstanceIds({ env, accountId });
      return respond(
        json({
          ok: true,
          accountId,
          instanceIds,
        }),
      );
    } catch (error) {
      if (error instanceof AccountInstanceCoordinateError) {
        return respond(
          json(
            {
              error: {
                kind: 'VALIDATION',
                reasonKey: 'tokyo.errors.instance.malformedCoordinate',
                detail: error.detail,
                phase: 'account-instance-coordinate-enumeration',
              },
            },
            { status: 422 },
          ),
        );
      }
      const detail = error instanceof Error ? error.message : String(error);
      return respond(
        json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }),
      );
    }
  }

  const internalInstanceListFactsMatch = pathname.match(/^\/__internal\/instances\/([^/]+)\/list-facts$/);
  if (internalInstanceListFactsMatch) {
    const instanceId = normalizeStorageId(
      decodeURIComponent(internalInstanceListFactsMatch[1] || ''),
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

    const pointer = await readAccountInstanceSourcePointer({
      env,
      accountId,
      instanceId,
    });
    if (!pointer.ok) {
      return respond(
        json(
          {
            error: {
              kind: pointer.kind,
              reasonKey: pointer.reasonKey,
            },
          },
          { status: pointer.kind === 'NOT_FOUND' ? 404 : 422 },
        ),
      );
    }

    return respond(
      json({
        ok: true,
        accountId: pointer.value.accountId,
        instanceId: pointer.value.id,
        widgetType: pointer.value.widgetType,
        displayName: pointer.value.displayName,
        updatedAt: pointer.value.updatedAt,
        publishStatus: pointer.value.publishStatus,
      }),
    );
  }

  if (pathname === '/__internal/instances') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) return respondValidation(respond, 'coreui.errors.instance.invalidPayload');
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);

    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    const body = (await req.json()) as {
      instanceId: string;
      widgetType: string;
      displayName: string | null;
      source: {
        config: Record<string, unknown>;
        content: AccountInstanceContentDocument;
      };
      baseLocale: string;
    };

    try {
      const created = await createAccountInstanceFromSubmittedSource({
        env,
        accountId,
        instanceId: body.instanceId,
        widgetType: body.widgetType,
        displayName: body.displayName,
        config: body.source.config,
        content: body.source.content,
        baseLocale: body.baseLocale,
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

    const body = (await req.json()) as { displayName: string };
    try {
      const renamed = await renameAccountInstanceDisplay({
        env,
        accountId,
        instanceId,
        displayName: body.displayName,
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
      let transition;
      if (action === 'publish') {
        const body = (await readInternalProductJsonBody({
          req,
          env,
          boundary: 'internal.instance.publish.body',
          accountId,
          instanceId,
        })) as {
          publishedLimit: number;
          publicPackage: SubmittedInstancePublicPackage;
        };
        return respond(await coordinateAccountInstancePublish({
          env,
          accountId,
          instanceId,
          publishedLimit: body.publishedLimit,
          publicPackage: body.publicPackage,
        }));
      } else {
        transition = await unpublishAccountInstanceTransition({ env, accountId, instanceId });
      }
      return respond(json({ ok: true, ...transition }));
    } catch (error) {
      return respond(transitionErrorResponse(error));
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

      const body = (await req.json()) as {
        source: {
          config: Record<string, unknown>;
          content: AccountInstanceContentDocument;
        };
      };
      try {
        const result = await saveAccountInstanceSource({
          env,
          accountId,
          instanceId,
          config: body.source.config,
          content: body.source.content,
        });
        return respond(
          json({
            ok: true,
            instanceId,
            widgetType: result.pointer.widgetType,
            displayName: result.pointer.displayName,
            publishStatus: result.pointer.publishStatus,
            updatedAt: result.pointer.updatedAt,
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
        const deleted = await deleteAccountInstanceTransition({ env, instanceId, accountId });
        return respond(json({ ok: true, existed: deleted.existed }));
      } catch (error) {
        return respond(transitionErrorResponse(error));
      }
    }

    return respondMethodNotAllowed(respond);
  }

  return null;
}

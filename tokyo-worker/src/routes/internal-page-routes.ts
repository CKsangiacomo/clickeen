import { isRecord } from '@clickeen/ck-contracts';
import {
  deleteAccountPageSource,
  listAccountPages,
  normalizePageId,
  PageOperationError,
  purgeAccountPagePublicCache,
  createAccountPageServeState,
  createAccountPageSource,
  readAccountPageServeState,
  readAccountPageSource,
  verifyAccountPagePublicPackageReady,
  saveAccountPageSource,
  writeAccountPageServeState,
} from '../domains/pages';
import { json } from '../http';
import {
  authorizeAccountInstanceControlRequest,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import {
  normalizeAccountPublicId,
  readInternalProductJsonBody,
} from './internal-product-route-utils';

function pageErrorResponse(error: unknown): Response {
  if (error instanceof PageOperationError) {
    return json(
      {
        error: {
          kind: error.kind,
          reasonKey: error.reasonKey,
          detail: error.message,
          ...(error.paths.length ? { paths: error.paths } : {}),
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
        reasonKey: 'tokyo.errors.page.operationFailed',
        detail,
      },
    },
    { status: 502 },
  );
}

export async function tryHandleInternalPageRoutes(args: TokyoRouteArgs): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalAccountPagesListMatch = pathname.match(/^\/__internal\/accounts\/([^/]+)\/pages$/);
  if (internalAccountPagesListMatch) {
    const pathAccountId = normalizeAccountPublicId(decodeURIComponent(internalAccountPagesListMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !pathAccountId || pathAccountId !== accountId) {
      return respondValidation(respond, 'tokyo.errors.page.invalidAccount', accountId ? 403 : 422);
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
      const index = await listAccountPages({ env, accountId });
      return respond(json({ ok: true, accountId, pages: index.pages }));
    } catch (error) {
      return respond(pageErrorResponse(error));
    }
  }

  if (pathname === '/__internal/pages') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) return respondValidation(respond, 'tokyo.errors.page.invalidAccount');
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const authErr = await authorizeAccountInstanceControlRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);

    const body = await readInternalProductJsonBody({
      req,
      env,
      boundary: 'internal.page.create.body',
      accountId,
    });
    if (!isRecord(body) || !isRecord(body.source)) {
      return respondValidation(respond, 'tokyo.errors.page.sourceInvalid');
    }
    const pageId = normalizePageId(body.source.pageId);
    if (!pageId) return respondValidation(respond, 'tokyo.errors.page.invalidPageId');

    try {
      const created = await createAccountPageSource({
        env,
        accountId,
        pageId,
        source: body.source,
      });
      const publishStatus = await createAccountPageServeState({ env, accountId, pageId });
      return respond(json({ ok: true, accountId, pageId, ...created, publishStatus }, { status: 201 }));
    } catch (error) {
      return respond(pageErrorResponse(error));
    }
  }

  const internalPagePublishMatch = pathname.match(/^\/__internal\/pages\/([^/]+)\/(publish|unpublish)$/);
  if (internalPagePublishMatch) {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    const pageId = normalizePageId(decodeURIComponent(internalPagePublishMatch[1] || ''));
    const action = internalPagePublishMatch[2] === 'publish' ? 'publish' : 'unpublish';
    if (!accountId || !pageId) {
      return respondValidation(respond, 'tokyo.errors.page.invalidPageId', accountId ? 422 : 403);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const authErr = await authorizeAccountInstanceControlRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);

    try {
      const source = await readAccountPageSource({ env, accountId, pageId });
      if (!source) {
        return respond(
          json(
            { error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' } },
            { status: 404 },
          ),
        );
      }
      if (action === 'publish') {
        const ready = await verifyAccountPagePublicPackageReady({ env, accountId, pageId });
        if (!ready.ok) {
          return respond(
            json(
              {
                error: {
                  kind: 'VALIDATION',
                  reasonKey: ready.reasonKey,
                  detail: ready.detail,
                },
              },
              { status: 409 },
            ),
          );
        }
        const serveState = await writeAccountPageServeState({
          env,
          accountId,
          pageId,
          status: 'published',
        });
        await purgeAccountPagePublicCache({ env, accountId, pageId });
        return respond(json({ ok: true, accountId, pageId, publishStatus: serveState.status, changed: serveState.changed }));
      }

      const serveState = await writeAccountPageServeState({
        env,
        accountId,
        pageId,
        status: 'unpublished',
      });
      await purgeAccountPagePublicCache({ env, accountId, pageId });
      return respond(json({ ok: true, accountId, pageId, publishStatus: serveState.status, changed: serveState.changed }));
    } catch (error) {
      return respond(pageErrorResponse(error));
    }
  }

  const internalPageMatch = pathname.match(/^\/__internal\/pages\/([^/]+)$/);
  if (internalPageMatch) {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    const pageId = normalizePageId(decodeURIComponent(internalPageMatch[1] || ''));
    if (!accountId || !pageId) {
      return respondValidation(respond, 'tokyo.errors.page.invalidPageId', accountId ? 422 : 403);
    }

    if (req.method === 'GET') {
      const authErr = await authorizeAccountInstanceControlRequest({
        req,
        env,
        accountId,
        minRole: 'viewer',
      });
      if (authErr) return respond(authErr);
      try {
        const source = await readAccountPageSource({ env, accountId, pageId });
        if (!source) {
          return respond(
            json(
              { error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' } },
              { status: 404 },
            ),
          );
        }
        const publishStatus = await readAccountPageServeState({ env, accountId, pageId });
        return respond(json({ ok: true, accountId, pageId, source, publishStatus }));
      } catch (error) {
        return respond(pageErrorResponse(error));
      }
    }

    if (req.method === 'PUT') {
      const authErr = await authorizeAccountInstanceControlRequest({
        req,
        env,
        accountId,
        minRole: 'editor',
      });
      if (authErr) return respond(authErr);
      const body = await readInternalProductJsonBody({
        req,
        env,
        boundary: 'internal.page.save.body',
        accountId,
      });
      if (!isRecord(body) || !isRecord(body.source)) {
        return respondValidation(respond, 'tokyo.errors.page.sourceInvalid');
      }
      try {
        const saved = await saveAccountPageSource({
          env,
          accountId,
          pageId,
          source: body.source,
        });
        if (await readAccountPageServeState({ env, accountId, pageId }) === 'published') {
          await purgeAccountPagePublicCache({ env, accountId, pageId });
        }
        return respond(json({ ok: true, accountId, pageId, source: saved.source, summary: saved.summary }));
      } catch (error) {
        return respond(pageErrorResponse(error));
      }
    }

    if (req.method === 'DELETE') {
      const authErr = await authorizeAccountInstanceControlRequest({
        req,
        env,
        accountId,
        minRole: 'editor',
      });
      if (authErr) return respond(authErr);
      try {
        const deleted = await deleteAccountPageSource({ env, accountId, pageId });
        return respond(json({ ok: true, accountId, pageId, deleted: deleted.existed, existed: deleted.existed }));
      } catch (error) {
        return respond(pageErrorResponse(error));
      }
    }

    return respondMethodNotAllowed(respond);
  }

  return null;
}

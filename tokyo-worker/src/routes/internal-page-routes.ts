import { isRecord } from '@clickeen/ck-contracts';
import {
  createAccountPageSource,
  deleteAccountPageSource,
  listAccountPageSources,
  normalizePageId,
  PageOperationError,
  readAccountPageSource,
  saveAccountPageSource,
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
    return json({
      error: {
        kind: error.kind,
        reasonKey: error.reasonKey,
        detail: error.message,
        ...(error.paths.length ? { paths: error.paths } : {}),
      },
    }, { status: error.status });
  }
  return json({
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.page.operationFailed',
      detail: error instanceof Error ? error.message : String(error),
    },
  }, { status: 502 });
}

export async function tryHandleInternalPageRoutes(args: TokyoRouteArgs): Promise<Response | null> {
  const { req, env, pathname, respond } = args;
  const listMatch = pathname.match(/^\/__internal\/accounts\/([^/]+)\/pages$/);
  if (listMatch) {
    const pathAccountId = normalizeAccountPublicId(decodeURIComponent(listMatch[1] || ''));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || !pathAccountId || accountId !== pathAccountId) {
      return respondValidation(respond, 'tokyo.errors.page.invalidAccount', accountId ? 403 : 422);
    }
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const authError = await authorizeAccountInstanceControlRequest({ req, env, accountId, minRole: 'viewer' });
    if (authError) return respond(authError);
    try {
      const pages = await listAccountPageSources({ env, accountId });
      return respond(json({ ok: true, accountId, sources: pages.sources }));
    } catch (error) {
      return respond(pageErrorResponse(error));
    }
  }

  if (pathname === '/__internal/pages') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) return respondValidation(respond, 'tokyo.errors.page.invalidAccount');
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const authError = await authorizeAccountInstanceControlRequest({ req, env, accountId, minRole: 'editor' });
    if (authError) return respond(authError);
    const body = await readInternalProductJsonBody({ req, env, boundary: 'internal.page.create.body', accountId });
    if (!isRecord(body) || !isRecord(body.source)) return respondValidation(respond, 'tokyo.errors.page.sourceInvalid');
    const pageId = normalizePageId(body.source.pageId);
    if (!pageId) return respondValidation(respond, 'tokyo.errors.page.invalidPageId');
    try {
      const created = await createAccountPageSource({ env, accountId, pageId, source: body.source });
      return respond(json({ ok: true, accountId, pageId, source: created.source }, { status: 201 }));
    } catch (error) {
      return respond(pageErrorResponse(error));
    }
  }

  const pageMatch = pathname.match(/^\/__internal\/pages\/([^/]+)$/);
  if (!pageMatch) return null;
  const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
  const pageId = normalizePageId(decodeURIComponent(pageMatch[1] || ''));
  if (!accountId || !pageId) return respondValidation(respond, 'tokyo.errors.page.invalidPageId', accountId ? 422 : 403);

  const minRole = req.method === 'GET' ? 'viewer' : 'editor';
  const authError = await authorizeAccountInstanceControlRequest({ req, env, accountId, minRole });
  if (authError) return respond(authError);
  try {
    if (req.method === 'GET') {
      const source = await readAccountPageSource({ env, accountId, pageId });
      if (!source) throw new PageOperationError({ kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' });
      return respond(json({ ok: true, accountId, pageId, source }));
    }
    if (req.method === 'PUT') {
      const body = await readInternalProductJsonBody({ req, env, boundary: 'internal.page.save.body', accountId });
      if (!isRecord(body) || !isRecord(body.source)) return respondValidation(respond, 'tokyo.errors.page.sourceInvalid');
      const saved = await saveAccountPageSource({ env, accountId, pageId, source: body.source });
      return respond(json({ ok: true, accountId, pageId, source: saved.source }));
    }
    if (req.method === 'DELETE') {
      const deleted = await deleteAccountPageSource({ env, accountId, pageId });
      if (!deleted.existed) throw new PageOperationError({ kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' });
      return respond(json({ ok: true, accountId, pageId, deleted: true }));
    }
    return respondMethodNotAllowed(respond);
  } catch (error) {
    return respond(pageErrorResponse(error));
  }
}

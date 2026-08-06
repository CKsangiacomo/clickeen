import { isRecord } from '@clickeen/ck-contracts';
import {
  createAccountPageSource,
  deleteAccountPageSource,
  listAccountPageInventory,
  normalizePageId,
  PageOperationError,
  publishAccountPage,
  readAccountPageLocaleOverlay,
  readAccountPageRecord,
  renameAccountPage,
  saveAccountPageSource,
  unpublishAccountPage,
  writeAccountPageLocaleOverlay,
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
      const inventory = await listAccountPageInventory({ env, accountId });
      return respond(json({ ok: true, accountId, sources: inventory.sources, pages: inventory.pages }));
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
      const created = await createAccountPageSource({
        env,
        accountId,
        pageId,
        source: body.source,
        files: body.files,
        overlaysJson: body.overlaysJson,
      });
      return respond(json({ ok: true, accountId, pageId, ...created }, { status: 201 }));
    } catch (error) {
      return respond(pageErrorResponse(error));
    }
  }

  const renameMatch = pathname.match(/^\/__internal\/pages\/([^/]+)\/rename$/);
  if (renameMatch) {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    const pageId = normalizePageId(decodeURIComponent(renameMatch[1] || ''));
    if (!accountId || !pageId) {
      return respondValidation(respond, 'tokyo.errors.page.invalidPageId', accountId ? 422 : 403);
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const authError = await authorizeAccountInstanceControlRequest({ req, env, accountId, minRole: 'editor' });
    if (authError) return respond(authError);
    const body = await readInternalProductJsonBody({
      req,
      env,
      boundary: 'internal.page.rename.body',
      accountId,
    });
    const displayName = isRecord(body) && typeof body.displayName === 'string' ? body.displayName : '';
    if (!displayName || displayName !== displayName.trim() || displayName.length > 120) {
      return respondValidation(respond, 'tokyo.errors.page.sourceInvalid');
    }
    try {
      const renamed = await renameAccountPage({ env, accountId, pageId, displayName });
      return respond(json({ ok: true, accountId, ...renamed }));
    } catch (error) {
      return respond(pageErrorResponse(error));
    }
  }

  const transitionMatch = pathname.match(/^\/__internal\/pages\/([^/]+)\/(publish|unpublish)$/);
  if (transitionMatch) {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    const pageId = normalizePageId(decodeURIComponent(transitionMatch[1] || ''));
    if (!accountId || !pageId) return respondValidation(respond, 'tokyo.errors.page.invalidPageId', accountId ? 422 : 403);
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const authError = await authorizeAccountInstanceControlRequest({ req, env, accountId, minRole: 'editor' });
    if (authError) return respond(authError);
    try {
      const transition = transitionMatch[2] === 'publish'
        ? await publishAccountPage({ env, accountId, pageId })
        : await unpublishAccountPage({ env, accountId, pageId });
      return respond(json({ ok: true, accountId, pageId, ...transition }));
    } catch (error) {
      return respond(pageErrorResponse(error));
    }
  }

  const localeOverlayMatch = pathname.match(/^\/__internal\/pages\/([^/]+)\/translations\/([^/]+)$/);
  if (localeOverlayMatch) {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    const pageId = normalizePageId(decodeURIComponent(localeOverlayMatch[1] || ''));
    const locale = String(decodeURIComponent(localeOverlayMatch[2] || ''));
    if (!accountId || !pageId || !locale || locale !== locale.trim()) {
      return respondValidation(respond, 'tokyo.errors.page.overlayInvalid', accountId ? 422 : 403);
    }
    if (req.method !== 'GET' && req.method !== 'PUT') return respondMethodNotAllowed(respond);
    const authError = await authorizeAccountInstanceControlRequest({
      req,
      env,
      accountId,
      minRole: req.method === 'GET' ? 'viewer' : 'editor',
    });
    if (authError) return respond(authError);
    try {
      if (req.method === 'GET') {
        const overlay = await readAccountPageLocaleOverlay({ env, accountId, pageId, locale });
        if (!overlay) {
          throw new PageOperationError({ kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.overlayNotFound' });
        }
        return respond(json({ ok: true, accountId, pageId, locale, overlay }));
      }
      const body = await readInternalProductJsonBody({
        req,
        env,
        boundary: 'internal.page.translation.body',
        accountId,
      });
      const saved = await writeAccountPageLocaleOverlay({
        env,
        accountId,
        pageId,
        locale,
        overlay: body,
      });
      return respond(json({ ok: true, accountId, pageId, locale, overlay: saved.overlay }));
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
      const page = await readAccountPageRecord({ env, accountId, pageId });
      if (!page) throw new PageOperationError({ kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.page.notFound' });
      return respond(json({ ok: true, accountId, pageId, ...page }));
    }
    if (req.method === 'PUT') {
      const body = await readInternalProductJsonBody({ req, env, boundary: 'internal.page.save.body', accountId });
      if (
        !isRecord(body) ||
        !isRecord(body.source) ||
        (body.operation !== 'save' && body.operation !== 'update')
      ) return respondValidation(respond, 'tokyo.errors.page.sourceInvalid');
      const saved = await saveAccountPageSource({
        env,
        accountId,
        pageId,
        source: body.source,
        files: body.files,
        overlaysJson: body.overlaysJson,
        operation: body.operation,
      });
      return respond(json({ ok: true, accountId, pageId, ...saved }));
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

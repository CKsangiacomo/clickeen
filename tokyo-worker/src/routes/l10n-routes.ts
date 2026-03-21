import { isUuid } from '@clickeen/ck-contracts';
import { normalizeLocale, normalizePublicId, normalizeSha256Hex } from '../asset-utils';
import {
  handleGetAccountTranslationsPanel,
  handleDeleteAccountUserLayer,
  handleGetAccountLocalizationSnapshot,
  handleGetAccountL10nStatus,
  handleUpsertAccountUserLayer,
} from '../domains/account-localization';
import { handleGetL10nAsset } from '../domains/l10n-read';
import {
  handleDeleteL10nOverlay,
  handleUpsertL10nOverlay,
  handleWriteL10nBaseSnapshot,
} from '../domains/l10n-authoring';
import { authorizeRomaAccountScopedRequest, respondMethodNotAllowed, respondValidation, type TokyoRouteArgs } from '../route-helpers';

export async function tryHandleInternalL10nRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalL10nBaseSnapshotMatch = pathname.match(
    /^\/__internal\/l10n\/instances\/([^/]+)\/bases\/([^/]+)$/,
  );
  if (internalL10nBaseSnapshotMatch) {
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const publicId = normalizePublicId(decodeURIComponent(internalL10nBaseSnapshotMatch[1]));
    const baseFingerprint = normalizeSha256Hex(
      decodeURIComponent(internalL10nBaseSnapshotMatch[2]),
    );
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!publicId || !isUuid(accountId) || !baseFingerprint) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
    }
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);
    return respond(
      await handleWriteL10nBaseSnapshot(req, env, publicId, baseFingerprint),
    );
  }

  const internalL10nSnapshotMatch = pathname.match(
    /^\/__internal\/l10n\/instances\/([^/]+)\/snapshot$/,
  );
  if (internalL10nSnapshotMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalL10nSnapshotMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!publicId || !isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
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
    return respond(await handleGetAccountLocalizationSnapshot(req, env, publicId, accountId));
  }

  const internalL10nStatusMatch = pathname.match(
    /^\/__internal\/l10n\/instances\/([^/]+)\/status$/,
  );
  if (internalL10nStatusMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalL10nStatusMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!publicId || !isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
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
    return respond(await handleGetAccountL10nStatus(req, env, publicId, accountId));
  }

  const internalL10nTranslationsMatch = pathname.match(
    /^\/__internal\/l10n\/instances\/([^/]+)\/translations$/,
  );
  if (internalL10nTranslationsMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalL10nTranslationsMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!publicId || !isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
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
    return respond(await handleGetAccountTranslationsPanel(req, env, publicId, accountId));
  }

  const internalL10nUserLayerMatch = pathname.match(
    /^\/__internal\/l10n\/instances\/([^/]+)\/user\/([^/]+)$/,
  );
  if (internalL10nUserLayerMatch && (req.method === 'POST' || req.method === 'DELETE')) {
    const publicId = normalizePublicId(decodeURIComponent(internalL10nUserLayerMatch[1]));
    const layerKeyRaw = decodeURIComponent(internalL10nUserLayerMatch[2]);
    const locale = normalizeLocale(layerKeyRaw) || (layerKeyRaw === 'global' ? 'global' : null);
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!publicId || !isUuid(accountId) || !locale) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
    }
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);
    if (req.method === 'POST') {
      return respond(
        await handleUpsertAccountUserLayer(req, env, publicId, accountId, locale),
      );
    }
    return respond(
      await handleDeleteAccountUserLayer(req, env, publicId, accountId, locale),
    );
  }

  const internalL10nOverlayMatch = pathname.match(
    /^\/__internal\/l10n\/instances\/([^/]+)\/([^/]+)\/([^/]+)$/,
  );
  if (internalL10nOverlayMatch && (req.method === 'POST' || req.method === 'DELETE')) {
    const publicId = normalizePublicId(decodeURIComponent(internalL10nOverlayMatch[1]));
    const layerRaw = decodeURIComponent(internalL10nOverlayMatch[2]);
    const layer = layerRaw === 'locale' || layerRaw === 'user' ? layerRaw : null;
    const layerKeyRaw = decodeURIComponent(internalL10nOverlayMatch[3]);
    const layerKey =
      layer === 'locale'
        ? normalizeLocale(layerKeyRaw)
        : normalizeLocale(layerKeyRaw) || (layerKeyRaw === 'global' ? 'global' : null);
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!publicId || !isUuid(accountId) || !layer || !layerKey) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
    }
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);
    if (req.method === 'POST') {
      return respond(await handleUpsertL10nOverlay(req, env, publicId, layer, layerKey));
    }
    return respond(await handleDeleteL10nOverlay(req, env, publicId, layer, layerKey));
  }

  const l10nVersionedMatch = pathname.match(/^\/l10n\/v\/[^/]+\/(.+)$/);
  if (l10nVersionedMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const rest = l10nVersionedMatch[1];
    const key = `l10n/${rest}`;
    return respond(await handleGetL10nAsset(env, key));
  }

  const l10nBaseSnapshotMatch = pathname.match(
    /^\/l10n\/instances\/([^/]+)\/bases\/([^/]+)$/,
  );
  if (l10nBaseSnapshotMatch) {
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    const publicId = normalizePublicId(decodeURIComponent(l10nBaseSnapshotMatch[1]));
    const baseFingerprint = normalizeSha256Hex(
      decodeURIComponent(l10nBaseSnapshotMatch[2]),
    );
    const accountId = String(
      args.url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
    ).trim();
    if (!publicId || !isUuid(accountId) || !baseFingerprint) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
    }
    return respond(
      new Response(
        JSON.stringify({
          error: {
            kind: 'VALIDATION',
            reasonKey: 'tokyo.errors.internalOnly',
            detail: 'Use the private Roma-bound l10n control route.',
          },
        }),
        {
          status: 410,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        },
      ),
    );
  }

  const l10nOverlayMatch = pathname.match(
    /^\/l10n\/instances\/([^/]+)\/([^/]+)\/([^/]+)$/,
  );
  if (l10nOverlayMatch && (req.method === 'POST' || req.method === 'DELETE')) {
    const publicId = normalizePublicId(decodeURIComponent(l10nOverlayMatch[1]));
    const layerRaw = decodeURIComponent(l10nOverlayMatch[2]);
    const layer = layerRaw === 'locale' || layerRaw === 'user' ? layerRaw : null;
    const layerKeyRaw = decodeURIComponent(l10nOverlayMatch[3]);
    const layerKey =
      layer === 'locale'
        ? normalizeLocale(layerKeyRaw)
        : normalizeLocale(layerKeyRaw) || (layerKeyRaw === 'global' ? 'global' : null);
    const accountId = String(
      args.url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
    ).trim();
    if (!publicId || !isUuid(accountId) || !layer || !layerKey) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
    }
    return respond(
      new Response(
        JSON.stringify({
          error: {
            kind: 'VALIDATION',
            reasonKey: 'tokyo.errors.internalOnly',
            detail: 'Use the private Roma-bound l10n control route.',
          },
        }),
        {
          status: 410,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        },
      ),
    );
  }

  if (pathname.startsWith('/l10n/')) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const key = pathname.replace(/^\//, '');
    return respond(await handleGetL10nAsset(env, key));
  }

  return null;
}

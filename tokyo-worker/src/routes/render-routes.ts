import { isUuid, parseAccountAssetRef } from '@clickeen/ck-contracts';
import { normalizeLocale, normalizePublicId, normalizeSha256Hex } from '../asset-utils';
import { handleGetTokyoFontAsset } from '../asset-utils';
import { handleGetAccountAsset } from '../domains/assets';
import { handleGetPublicInstance } from '../domains/public-instance';
import {
  handleGetR2Object,
  publicProjectionRenderConfigPackKey,
  publicProjectionRenderLivePointerKey,
  publicProjectionRenderMetaLivePointerKey,
  publicProjectionRenderMetaPackKey,
} from '../domains/render';
import {
  respondInternalOnly,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';

export async function tryHandlePublicRenderRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, url, respond } = args;

  const renderLivePointerMatch = pathname.match(
    /^\/renders\/instances\/([^/]+)\/live\/r\.json$/,
  );
  if (renderLivePointerMatch) {
    const publicId = normalizePublicId(decodeURIComponent(renderLivePointerMatch[1]));
    if (!publicId) {
      return respondValidation(respond, 'tokyo.errors.render.invalidPublicId');
    }
    if (req.method === 'GET') {
      return respond(
        await handleGetR2Object(env, publicProjectionRenderLivePointerKey(publicId), 'no-store'),
      );
    }
    if (req.method === 'POST') {
      return respondInternalOnly(
        respond,
        'Use the private Roma-bound render control route.',
      );
    }
    return respondMethodNotAllowed(respond);
  }

  const renderPublicInstanceMatch = pathname.match(
    /^\/renders\/instances\/([^/]+)\/live\/public-instance\.json$/,
  );
  if (renderPublicInstanceMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const publicId = normalizePublicId(decodeURIComponent(renderPublicInstanceMatch[1]));
    if (!publicId) {
      return respondValidation(respond, 'tokyo.errors.render.invalidPublicId');
    }
    return respond(await handleGetPublicInstance(env, publicId));
  }

  const renderLiveSurfaceMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/live\.json$/);
  if (renderLiveSurfaceMatch) {
    const publicId = normalizePublicId(decodeURIComponent(renderLiveSurfaceMatch[1]));
    const accountId = String(
      url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
    ).trim();
    if (!publicId || !isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method === 'DELETE') {
      return respondInternalOnly(
        respond,
        'Use the private Roma-bound render control route.',
      );
    }
    return respondMethodNotAllowed(respond);
  }

  const renderSavedMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/saved\.json$/);
  if (renderSavedMatch) {
    const publicId = normalizePublicId(decodeURIComponent(renderSavedMatch[1]));
    const accountId = String(
      url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
    ).trim();
    if (!publicId || !isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method === 'GET' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      return respondInternalOnly(
        respond,
        'Use the private Roma-bound render control route.',
      );
    }
    return respondMethodNotAllowed(respond);
  }

  const renderMetaLivePointerMatch = pathname.match(
    /^\/renders\/instances\/([^/]+)\/live\/meta\/([^/]+)\.json$/,
  );
  if (renderMetaLivePointerMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const publicId = normalizePublicId(decodeURIComponent(renderMetaLivePointerMatch[1]));
    const locale = normalizeLocale(decodeURIComponent(renderMetaLivePointerMatch[2]));
    if (!publicId || !locale) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    return respond(
        await handleGetR2Object(env, publicProjectionRenderMetaLivePointerKey(publicId, locale), 'no-store'),
    );
  }

  const renderConfigPackWriteMatch = pathname.match(
    /^\/renders\/instances\/([^/]+)\/config-pack$/,
  );
  if (renderConfigPackWriteMatch) {
    const publicId = normalizePublicId(decodeURIComponent(renderConfigPackWriteMatch[1]));
    const accountId = String(
      url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
    ).trim();
    if (!publicId || !isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    return respondInternalOnly(
      respond,
      'Use the private Roma-bound render control route.',
    );
  }

  const renderConfigPackMatch = pathname.match(
    /^\/renders\/instances\/([^/]+)\/config\/([^/]+)\/config\.json$/,
  );
  if (renderConfigPackMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const publicId = normalizePublicId(decodeURIComponent(renderConfigPackMatch[1]));
    const configFp = normalizeSha256Hex(decodeURIComponent(renderConfigPackMatch[2]));
    if (!publicId || !configFp) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    return respond(
      await handleGetR2Object(
        env,
        publicProjectionRenderConfigPackKey(publicId, configFp),
        'public, max-age=31536000, immutable',
      ),
    );
  }

  const renderMetaPackMatch = pathname.match(
    /^\/renders\/instances\/([^/]+)\/meta\/([^/]+)\/([^/]+)\.json$/,
  );
  if (renderMetaPackMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const publicId = normalizePublicId(decodeURIComponent(renderMetaPackMatch[1]));
    const locale = normalizeLocale(decodeURIComponent(renderMetaPackMatch[2]));
    const metaFp = normalizeSha256Hex(decodeURIComponent(renderMetaPackMatch[3]));
    if (!publicId || !locale || !metaFp) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    return respond(
      await handleGetR2Object(
        env,
        publicProjectionRenderMetaPackKey(publicId, locale, metaFp),
        'public, max-age=31536000, immutable',
      ),
    );
  }

  const legacyRenderSurfaceMatch = pathname.match(
    /^\/renders\/instances\/[^/]+\/(published|revisions|snapshot)(?:\/|$)/,
  );
  if (legacyRenderSurfaceMatch) {
    return respond(
      new Response(
        JSON.stringify({
          error: {
            kind: 'VALIDATION',
            reasonKey: 'tokyo.errors.render.legacyUnsupported',
            detail:
              'Legacy render snapshot endpoints are removed. Use /renders/instances/{publicId}/live/r.json + config/text packs.',
          },
        }),
        {
          status: 410,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        },
      ),
    );
  }

  const accountAsset = parseAccountAssetRef(pathname);
  if (accountAsset) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return respondMethodNotAllowed(respond);
    }
    const response = await handleGetAccountAsset(env, accountAsset.key);
    if (req.method === 'HEAD') {
      return respond(
        new Response(null, { status: response.status, headers: response.headers }),
      );
    }
    return respond(response);
  }

  if (pathname.startsWith('/fonts/')) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    return respond(await handleGetTokyoFontAsset(env, pathname));
  }

  return null;
}

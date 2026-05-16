import { parseAccountAssetRef } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isOverlayId,
  parseOverlayId,
} from '@clickeen/ck-contracts/overlay-identity';
import { handleGetTokyoDeployAsset, handleGetTokyoFontAsset, normalizeStorageId } from '../asset-utils';
import { handleGetAccountAsset } from '../domains/assets';
import {
  accountInstancePublishedConfigKey,
  accountInstanceRenderMetaLivePointerKey,
  accountInstanceRenderMetaPackKey,
  accountInstancePublishKey,
  buildLiveRenderPointer,
  loadJson,
  normalizePublishDocument,
  readOverlayObject,
  resolveAccountInstanceLocation,
} from '../domains/render';
import {
  isValidScopedInstance,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';

function jsonRenderResponse(payload: unknown): Response {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'public, max-age=60, s-maxage=300');
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(payload), { status: 200, headers });
}

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

async function resolvePublishedRenderLocation(args: {
  env: TokyoRouteArgs['env'];
  accountId: string;
  instanceId: string;
}) {
  if (!isCompactAccountPublicId(args.accountId) || !isValidScopedInstance(args.instanceId, args.accountId)) {
    return null;
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!location) return null;
  const publish = normalizePublishDocument(
    await loadJson(args.env, accountInstancePublishKey(location.accountId, location.widgetCode, location.instanceId)),
  );
  if (!publish || publish.status !== 'published') return null;
  return { location, publish };
}

export async function tryHandlePublicRenderRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const accountRenderLivePointerMatch = pathname.match(
    /^\/renders\/accounts\/([0-9A-Z]{8})\/instances\/([^/]+)\/live\/r\.json$/,
  );
  if (accountRenderLivePointerMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const accountId = decodeURIComponent(accountRenderLivePointerMatch[1]);
    const instanceId = normalizeStorageId(decodeURIComponent(accountRenderLivePointerMatch[2]));
    if (!instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    }
    const resolved = await resolvePublishedRenderLocation({ env, accountId, instanceId });
    if (!resolved) return respond(notFound());
    const pointer = buildLiveRenderPointer({
      id: resolved.location.instanceId,
      widgetType: resolved.location.widgetType,
      publish: resolved.publish,
    });
    return respond(pointer ? jsonRenderResponse(pointer) : notFound());
  }

  const accountRenderConfigMatch = pathname.match(
    /^\/renders\/accounts\/([0-9A-Z]{8})\/instances\/([^/]+)\/config\.json$/,
  );
  if (accountRenderConfigMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const accountId = decodeURIComponent(accountRenderConfigMatch[1]);
    const instanceId = normalizeStorageId(decodeURIComponent(accountRenderConfigMatch[2]));
    if (!instanceId || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    }
    const resolved = await resolvePublishedRenderLocation({ env, accountId, instanceId });
    if (!resolved) return respond(notFound());
    const config = await loadJson(
      env,
      accountInstancePublishedConfigKey(resolved.location.accountId, resolved.location.widgetCode, resolved.location.instanceId),
    );
    return respond(config ? jsonRenderResponse(config) : notFound());
  }

  const accountRenderOverlayMatch = pathname.match(
    /^\/renders\/accounts\/([0-9A-Z]{8})\/instances\/([^/]+)\/overlays\/([^/]+)\.json$/,
  );
  if (accountRenderOverlayMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const accountId = decodeURIComponent(accountRenderOverlayMatch[1]);
    const instanceId = normalizeStorageId(decodeURIComponent(accountRenderOverlayMatch[2]));
    const overlayId = decodeURIComponent(accountRenderOverlayMatch[3]);
    const parsed = parseOverlayId(overlayId);
    if (
      !instanceId ||
      !isValidScopedInstance(instanceId, accountId) ||
      !parsed.ok ||
      parsed.value.accountPublicId !== accountId ||
      parsed.value.instanceId !== instanceId
    ) {
      return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    }
    const resolved = await resolvePublishedRenderLocation({ env, accountId, instanceId });
    if (!resolved) return respond(notFound());
    const isPublishedOverlay = Object.values(resolved.publish.overlays?.languages ?? {}).includes(overlayId);
    if (!isPublishedOverlay) return respond(notFound());
    const overlay = await readOverlayObject({ env, overlayId });
    return respond(overlay ? jsonRenderResponse(overlay) : notFound());
  }

  const accountRenderMetaLiveMatch = pathname.match(
    /^\/renders\/accounts\/([0-9A-Z]{8})\/instances\/([^/]+)\/meta\/live\/([^/]+)\.json$/,
  );
  if (accountRenderMetaLiveMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const accountId = decodeURIComponent(accountRenderMetaLiveMatch[1]);
    const instanceId = normalizeStorageId(decodeURIComponent(accountRenderMetaLiveMatch[2]));
    const locale = decodeURIComponent(accountRenderMetaLiveMatch[3]).trim().toLowerCase();
    if (!instanceId || !locale || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    }
    const resolved = await resolvePublishedRenderLocation({ env, accountId, instanceId });
    if (!resolved || !resolved.publish.seoGeo) return respond(notFound());
    const pointer = await loadJson(
      env,
      accountInstanceRenderMetaLivePointerKey(resolved.location.accountId, resolved.location.widgetCode, resolved.location.instanceId, locale),
    );
    return respond(pointer ? jsonRenderResponse(pointer) : notFound());
  }

  const accountRenderMetaPackMatch = pathname.match(
    /^\/renders\/accounts\/([0-9A-Z]{8})\/instances\/([^/]+)\/meta\/([^/]+)\/([0-9a-f]{64})\.json$/,
  );
  if (accountRenderMetaPackMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const accountId = decodeURIComponent(accountRenderMetaPackMatch[1]);
    const instanceId = normalizeStorageId(decodeURIComponent(accountRenderMetaPackMatch[2]));
    const locale = decodeURIComponent(accountRenderMetaPackMatch[3]).trim().toLowerCase();
    const metaFp = accountRenderMetaPackMatch[4];
    if (!instanceId || !locale || !metaFp || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    }
    const resolved = await resolvePublishedRenderLocation({ env, accountId, instanceId });
    if (!resolved || !resolved.publish.seoGeo) return respond(notFound());
    const pack = await loadJson(
      env,
      accountInstanceRenderMetaPackKey(resolved.location.accountId, resolved.location.widgetCode, resolved.location.instanceId, locale, metaFp),
    );
    return respond(pack ? jsonRenderResponse(pack) : notFound());
  }

  const renderLivePointerMatch = pathname.match(
    /^\/renders\/widgets\/([^/]+)\/live\/r\.json$/,
  );
  if (renderLivePointerMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderLivePointerMatch[1]));
    if (!instanceId) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    return respond(notFound());
  }

  const renderConfigMatch = pathname.match(/^\/renders\/widgets\/([^/]+)\/config\.json$/);
  if (renderConfigMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderConfigMatch[1]));
    if (!instanceId) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    return respond(notFound());
  }

  const renderOverlayMatch = pathname.match(/^\/renders\/widgets\/([^/]+)\/overlays\/([^/]+)\.json$/);
  if (renderOverlayMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderOverlayMatch[1]));
    const overlayId = decodeURIComponent(renderOverlayMatch[2]);
    if (!instanceId || !isOverlayId(overlayId)) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    return respond(notFound());
  }

  const renderMetaLiveMatch = pathname.match(/^\/renders\/widgets\/([^/]+)\/meta\/live\/([^/]+)\.json$/);
  if (renderMetaLiveMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderMetaLiveMatch[1]));
    const locale = decodeURIComponent(renderMetaLiveMatch[2]).trim().toLowerCase();
    if (!instanceId || !locale) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    return respond(notFound());
  }

  const renderMetaPackMatch = pathname.match(/^\/renders\/widgets\/([^/]+)\/meta\/([^/]+)\/([0-9a-f]{64})\.json$/);
  if (renderMetaPackMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderMetaPackMatch[1]));
    const locale = decodeURIComponent(renderMetaPackMatch[2]).trim().toLowerCase();
    const metaFp = renderMetaPackMatch[3];
    if (!instanceId || !locale || !metaFp) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    return respond(notFound());
  }

  const accountAsset = parseAccountAssetRef(pathname);
  if (accountAsset) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return respondMethodNotAllowed(respond);
    const response = await handleGetAccountAsset(env, accountAsset.key);
    if (req.method === 'HEAD') {
      return respond(new Response(null, { status: response.status, headers: response.headers }));
    }
    return respond(response);
  }

  const deployAsset = await handleGetTokyoDeployAsset(env, pathname);
  if (deployAsset) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return respondMethodNotAllowed(respond);
    if (req.method === 'HEAD') {
      return respond(new Response(null, { status: deployAsset.status, headers: deployAsset.headers }));
    }
    return respond(deployAsset);
  }

  if (pathname.startsWith('/fonts/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return respondMethodNotAllowed(respond);
    const response = await handleGetTokyoFontAsset(env, pathname);
    if (req.method === 'HEAD') {
      return respond(new Response(null, { status: response.status, headers: response.headers }));
    }
    return respond(response);
  }

  return null;
}

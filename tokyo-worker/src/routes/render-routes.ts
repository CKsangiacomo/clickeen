import { parseAccountAssetRef } from '@clickeen/ck-contracts';
import { handleGetTokyoFontAsset, normalizeStorageId } from '../asset-utils';
import { handleGetAccountAsset } from '../domains/assets';
import {
  accountInstancePublishedConfigKey,
  accountInstanceRenderMetaLivePointerKey,
  accountInstanceRenderMetaPackKey,
  accountInstancePublishKey,
  buildLiveRenderPointer,
  handleGetR2Object,
  loadJson,
  normalizePublishDocument,
  normalizePublishedWidgetLookupDocument,
  publishedWidgetLookupKey,
} from '../domains/render';
import {
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';

async function readPublishedLookup(env: TokyoRouteArgs['env'], instanceId: string) {
  const lookup = normalizePublishedWidgetLookupDocument(
    await loadJson(env, publishedWidgetLookupKey(instanceId)),
  );
  return lookup?.status === 'published' ? lookup : null;
}

export async function tryHandlePublicRenderRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const renderLivePointerMatch = pathname.match(
    /^\/renders\/widgets\/([^/]+)\/live\/r\.json$/,
  );
  if (renderLivePointerMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderLivePointerMatch[1]));
    if (!instanceId) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    const lookup = await readPublishedLookup(env, instanceId);
    if (!lookup) return respond(new Response('Not found', { status: 404 }));
    const publish = normalizePublishDocument(
      await loadJson(env, accountInstancePublishKey(lookup.accountId, lookup.widgetType, lookup.id)),
    );
    if (!publish || publish.status !== 'published') return respond(new Response('Not found', { status: 404 }));
    const pointer = buildLiveRenderPointer({ id: lookup.id, widgetType: lookup.widgetType, publish });
    if (!pointer) return respond(new Response('Not found', { status: 404 }));
    return respond(
      new Response(JSON.stringify(pointer), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      }),
    );
  }

  const renderConfigMatch = pathname.match(/^\/renders\/widgets\/([^/]+)\/config\.json$/);
  if (renderConfigMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderConfigMatch[1]));
    if (!instanceId) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    const lookup = await readPublishedLookup(env, instanceId);
    if (!lookup) return respond(new Response('Not found', { status: 404 }));
    return respond(
      await handleGetR2Object(
        env,
        accountInstancePublishedConfigKey(lookup.accountId, lookup.widgetType, lookup.id),
        'public, max-age=60',
      ),
    );
  }

  const renderMetaLiveMatch = pathname.match(/^\/renders\/widgets\/([^/]+)\/meta\/live\/([^/]+)\.json$/);
  if (renderMetaLiveMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderMetaLiveMatch[1]));
    const locale = decodeURIComponent(renderMetaLiveMatch[2]).trim().toLowerCase();
    if (!instanceId || !locale) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    const lookup = await readPublishedLookup(env, instanceId);
    if (!lookup) return respond(new Response('Not found', { status: 404 }));
    return respond(
      await handleGetR2Object(
        env,
        accountInstanceRenderMetaLivePointerKey(lookup.accountId, lookup.widgetType, lookup.id, locale),
        'no-store',
      ),
    );
  }

  const renderMetaPackMatch = pathname.match(/^\/renders\/widgets\/([^/]+)\/meta\/([^/]+)\/([0-9a-f]{64})\.json$/);
  if (renderMetaPackMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const instanceId = normalizeStorageId(decodeURIComponent(renderMetaPackMatch[1]));
    const locale = decodeURIComponent(renderMetaPackMatch[2]).trim().toLowerCase();
    const metaFp = renderMetaPackMatch[3];
    if (!instanceId || !locale || !metaFp) return respondValidation(respond, 'tokyo.errors.render.invalidInstanceId');
    const lookup = await readPublishedLookup(env, instanceId);
    if (!lookup) return respond(new Response('Not found', { status: 404 }));
    return respond(
      await handleGetR2Object(
        env,
        accountInstanceRenderMetaPackKey(lookup.accountId, lookup.widgetType, lookup.id, locale, metaFp),
        'public, max-age=300',
      ),
    );
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

  if (pathname.startsWith('/fonts/')) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    return respond(await handleGetTokyoFontAsset(env, pathname));
  }

  return null;
}

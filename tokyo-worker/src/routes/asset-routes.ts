import {
  parseAccountAssetRef,
} from '@clickeen/ck-contracts';
import { handleGetTokyoDeployAsset, handleGetTokyoFontAsset } from '../asset-utils';
import {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetUsage,
  handleListAccountAssetMetadata,
  handleResolveAccountAssetMetadata,
  handleUploadAccountAsset,
} from '../domains/assets-handlers';
import { respondMethodNotAllowed, type TokyoRouteArgs } from '../route-helpers';

const ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT = '([0-9A-Z]{8})';
const ASSET_REF_ROUTE_SEGMENT = '(.+)';

export async function tryHandleAssetRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

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

  const accountAsset = parseAccountAssetRef(pathname);
  if (accountAsset) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return respondMethodNotAllowed(respond);
    const response = await handleGetAccountAsset(env, accountAsset.key);
    if (req.method === 'HEAD') {
      return respond(new Response(null, { status: response.status, headers: response.headers }));
    }
    return respond(response);
  }

  if (pathname === '/__internal/assets/upload') {
    if (req.method !== 'POST') return respondMethodNotAllowed(respond);
    return respond(await handleUploadAccountAsset(req, env));
  }

  const accountAssetsListMatch = pathname.match(
    new RegExp(`^/__internal/assets/account/${ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT}$`),
  );
  if (accountAssetsListMatch) {
    const accountId = decodeURIComponent(accountAssetsListMatch[1] || '');
    if (req.method === 'GET') {
      return respond(await handleListAccountAssetMetadata(req, env, accountId));
    }
    return respondMethodNotAllowed(respond);
  }

  const accountAssetsUsageMatch = pathname.match(
    new RegExp(`^/__internal/assets/account/${ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT}/usage$`),
  );
  if (accountAssetsUsageMatch) {
    const accountId = decodeURIComponent(accountAssetsUsageMatch[1] || '');
    if (req.method === 'GET') {
      return respond(await handleGetAccountAssetUsage(req, env, accountId));
    }
    return respondMethodNotAllowed(respond);
  }

  const accountAssetsResolveMatch = pathname.match(
    new RegExp(`^/__internal/assets/account/${ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT}/resolve$`),
  );
  if (accountAssetsResolveMatch) {
    const accountId = decodeURIComponent(accountAssetsResolveMatch[1] || '');
    if (req.method === 'POST') {
      return respond(await handleResolveAccountAssetMetadata(req, env, accountId));
    }
    return respondMethodNotAllowed(respond);
  }

  const accountAssetMatch = pathname.match(
    new RegExp(`^/__internal/assets/account/${ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT}/asset/${ASSET_REF_ROUTE_SEGMENT}$`, 'i'),
  );
  if (accountAssetMatch) {
    const accountId = decodeURIComponent(accountAssetMatch[1] || '');
    const assetRef = decodeURIComponent(accountAssetMatch[2] || '');
    if (req.method === 'DELETE') {
      return respond(await handleDeleteAccountAsset(req, env, accountId, assetRef));
    }
    return respondMethodNotAllowed(respond);
  }

  return null;
}

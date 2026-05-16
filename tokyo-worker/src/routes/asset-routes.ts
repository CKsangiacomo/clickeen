import {
  handleDeleteAccountAsset,
  handleGetAccountAssetIdentityIntegrity,
  handleGetAccountAssetMirrorIntegrity,
  handleGetAccountAssetUsage,
  handleListAccountAssetMetadata,
  handleResolveAccountAssetMetadata,
  handleUploadAccountAsset,
} from '../domains/assets';
import { respondMethodNotAllowed, type TokyoRouteArgs } from '../route-helpers';

const ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT = '([0-9A-Z]{8})';
const ASSET_ID_ROUTE_SEGMENT = '([0-9a-f-]{36})';

export async function tryHandleAssetRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

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
    new RegExp(`^/__internal/assets/${ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT}/${ASSET_ID_ROUTE_SEGMENT}$`, 'i'),
  );
  if (accountAssetMatch) {
    const accountId = decodeURIComponent(accountAssetMatch[1] || '');
    const assetId = decodeURIComponent(accountAssetMatch[2] || '');
    if (req.method === 'DELETE') {
      return respond(await handleDeleteAccountAsset(req, env, accountId, assetId));
    }
    return respondMethodNotAllowed(respond);
  }

  const accountAssetIntegrityMatch = pathname.match(
    new RegExp(`^/assets/integrity/${ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT}$`),
  );
  if (accountAssetIntegrityMatch) {
    const accountId = decodeURIComponent(accountAssetIntegrityMatch[1] || '');
    if (req.method === 'GET') {
      return respond(await handleGetAccountAssetMirrorIntegrity(req, env, accountId));
    }
    return respondMethodNotAllowed(respond);
  }

  const accountAssetIdentityIntegrityMatch = pathname.match(
    new RegExp(`^/assets/integrity/${ACCOUNT_PUBLIC_ID_ROUTE_SEGMENT}/${ASSET_ID_ROUTE_SEGMENT}$`, 'i'),
  );
  if (accountAssetIdentityIntegrityMatch) {
    const accountId = decodeURIComponent(accountAssetIdentityIntegrityMatch[1] || '');
    const assetId = decodeURIComponent(accountAssetIdentityIntegrityMatch[2] || '');
    if (req.method === 'GET') {
      return respond(
        await handleGetAccountAssetIdentityIntegrity(req, env, accountId, assetId),
      );
    }
    return respondMethodNotAllowed(respond);
  }

  return null;
}

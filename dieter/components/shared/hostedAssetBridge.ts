type HostedAssetBridge = {
  listAssets: () => Promise<unknown>;
  resolveAssets: (assetIds: string[]) => Promise<unknown>;
  uploadAsset: (file: Blob, headers?: Record<string, string>) => Promise<unknown>;
};

const HOSTED_ASSET_BRIDGE_KEY = '__CK_CLICKEEN_HOSTED_ACCOUNT_ASSET_BRIDGE__';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function resolveHostedAssetBridge(): HostedAssetBridge | null {
  const root = globalThis as Record<string, unknown>;
  const candidate = root[HOSTED_ASSET_BRIDGE_KEY];
  if (!isRecord(candidate)) return null;

  const listAssets = candidate.listAssets;
  const resolveAssets = candidate.resolveAssets;
  const uploadAsset = candidate.uploadAsset;

  if (
    typeof listAssets !== 'function' ||
    typeof resolveAssets !== 'function' ||
    typeof uploadAsset !== 'function'
  ) {
    return null;
  }

  return {
    listAssets: listAssets as HostedAssetBridge['listAssets'],
    resolveAssets: resolveAssets as HostedAssetBridge['resolveAssets'],
    uploadAsset: uploadAsset as HostedAssetBridge['uploadAsset'],
  };
}

export { HOSTED_ASSET_BRIDGE_KEY };

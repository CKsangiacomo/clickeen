import type { ResolvedAccountAsset } from '@clickeen/ck-contracts';
import type { AccountAssetsClient } from './account-assets';

type ResolveSingleAccountAssetArgs = {
  accountAssets: AccountAssetsClient;
  getAssetId: () => string;
  beginRequest: () => number;
  isCurrent: (requestId: number, assetId: string) => boolean;
  onStart?: () => void;
  onMissing: () => void;
  onResolved: (asset: ResolvedAccountAsset) => void;
  onError: (message: string) => void;
};

export async function resolveSingleAccountAsset(args: ResolveSingleAccountAssetArgs): Promise<void> {
  const assetId = String(args.getAssetId() || '').trim();
  const requestId = args.beginRequest();
  args.onStart?.();
  if (!assetId) return;

  try {
    const { assetsById, missingAssetIds } = await args.accountAssets.resolveAssets([assetId]);
    if (!args.isCurrent(requestId, assetId)) return;
    if (missingAssetIds.includes(assetId)) {
      args.onMissing();
      return;
    }
    const asset = assetsById.get(assetId);
    if (!asset) {
      args.onMissing();
      return;
    }
    args.onResolved(asset);
  } catch (error) {
    if (!args.isCurrent(requestId, assetId)) return;
    args.onError(error instanceof Error ? error.message : 'coreui.errors.db.readFailed');
  }
}

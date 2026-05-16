import type { ResolvedAccountAsset } from '@clickeen/ck-contracts';
import type { AccountAssetsClient } from './account-assets';

type ResolveSingleAccountAssetArgs = {
  accountAssets: AccountAssetsClient;
  getAssetRef: () => string;
  beginRequest: () => number;
  isCurrent: (requestId: number, assetRef: string) => boolean;
  onStart?: () => void;
  onMissing: () => void;
  onResolved: (asset: ResolvedAccountAsset) => void;
  onError: (message: string) => void;
};

export async function resolveSingleAccountAsset(args: ResolveSingleAccountAssetArgs): Promise<void> {
  const assetRef = String(args.getAssetRef() || '').trim();
  const requestId = args.beginRequest();
  args.onStart?.();
  if (!assetRef) return;

  try {
    const { assetsByRef, missingAssetRefs } = await args.accountAssets.resolveAssets([assetRef]);
    if (!args.isCurrent(requestId, assetRef)) return;
    if (missingAssetRefs.includes(assetRef)) {
      args.onMissing();
      return;
    }
    const asset = assetsByRef.get(assetRef);
    if (!asset) {
      args.onMissing();
      return;
    }
    args.onResolved(asset);
  } catch (error) {
    if (!args.isCurrent(requestId, assetRef)) return;
    args.onError(error instanceof Error ? error.message : 'coreui.errors.db.readFailed');
  }
}

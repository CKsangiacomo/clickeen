import type { ResolvedAccountAsset } from '@clickeen/ck-contracts';
import type { AccountAssetsClient } from './account-assets';

type ResolveSingleAccountAssetArgs = {
  accountAssets: AccountAssetsClient;
  getAssetRef: () => string;
  beginRequest: () => number;
  isCurrent: (requestId: number, assetRef: string) => boolean;
  onStart?: () => void;
  onResolved: (asset: ResolvedAccountAsset) => void;
  onError: () => void;
};

export async function resolveSingleAccountAsset(args: ResolveSingleAccountAssetArgs): Promise<void> {
  const assetRef = args.getAssetRef();
  const requestId = args.beginRequest();
  args.onStart?.();
  if (!assetRef) return;

  try {
    const resolved = await args.accountAssets.resolveAssets([assetRef]);
    if (!args.isCurrent(requestId, assetRef)) return;
    const asset = resolved.assetsByRef.get(assetRef);
    if (!asset) {
      args.onError();
      return;
    }
    args.onResolved(asset);
  } catch {
    if (!args.isCurrent(requestId, assetRef)) return;
    args.onError();
  }
}

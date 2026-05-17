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
    const resolved = await args.accountAssets.resolveAssets([assetRef]);
    const assetsByRef = resolved?.assetsByRef instanceof Map ? resolved.assetsByRef : new Map<string, ResolvedAccountAsset>();
    const missingAssetRefs = Array.isArray(resolved?.missingAssetRefs) ? resolved.missingAssetRefs : [];
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

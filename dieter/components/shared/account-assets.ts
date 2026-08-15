import type { AccountAssetRecord, ResolvedAccountAsset } from '@clickeen/ck-contracts';

export type { AccountAssetRecord, ResolvedAccountAsset } from '@clickeen/ck-contracts';

export type AccountAssetsClient = {
  listAssets: () => Promise<AccountAssetRecord[]>;
  resolveAssets: (assetRefsRaw: string[]) => Promise<{
    assetsByRef: Map<string, ResolvedAccountAsset>;
  }>;
  uploadAsset: (file: File, source: string) => Promise<AccountAssetRecord>;
  resolveUploadUpsellReason: (error: unknown) => string | null;
};

export function dispatchAccountAssetUpsell(root: HTMLElement, reasonKey: string): void {
  root.dispatchEvent(
    new CustomEvent('dieter-upsell', {
      detail: { reasonKey },
      bubbles: true,
    }),
  );
}

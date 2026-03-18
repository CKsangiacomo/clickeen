import { afterEach, describe, expect, it, vi } from 'vitest';
import { toCanonicalAssetVersionPath } from '../../packages/ck-contracts/src/index.js';
import {
  HOSTED_ASSET_BRIDGE_KEY,
  resolveHostedAssetBridge,
} from '../../dieter/components/shared/hostedAssetBridge';
import { uploadEditorAsset } from '../../dieter/components/shared/assetUpload';
import { resolveEditorAssetChoices } from '../../dieter/components/shared/assetResolve';

const ACCOUNT_ID = '11111111-1111-1111-1111-111111111111';
const PUBLIC_ID = 'wgt_faq_u_testcase';
const ASSET_ID = '22222222-2222-2222-2222-222222222222';
const ASSET_VERSION_KEY = `assets/versions/${ACCOUNT_ID}/${ASSET_ID}/hero.png`;
const ASSET_REF = toCanonicalAssetVersionPath(ASSET_VERSION_KEY)!;

const originalDocument = (globalThis as Record<string, unknown>).document;

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[HOSTED_ASSET_BRIDGE_KEY];
  if (typeof originalDocument === 'undefined') {
    delete (globalThis as Record<string, unknown>).document;
  } else {
    (globalThis as Record<string, unknown>).document = originalDocument;
  }
});

describe('Dieter hosted asset bridge contract', () => {
  it('resolves only valid hosted asset bridges', () => {
    (globalThis as Record<string, unknown>)[HOSTED_ASSET_BRIDGE_KEY] = { uploadAsset: 'nope' };
    expect(resolveHostedAssetBridge()).toBeNull();

    const bridge = {
      listAssets: vi.fn(async () => []),
      resolveAssets: vi.fn(async () => ({ assets: [] })),
      uploadAsset: vi.fn(async () => ({})),
    };
    (globalThis as Record<string, unknown>)[HOSTED_ASSET_BRIDGE_KEY] = bridge;

    expect(resolveHostedAssetBridge()).toEqual(bridge);
  });

  it('lets Dieter asset primitives use the hosted bridge without Bob owning the primitive logic', async () => {
    const uploadAsset = vi.fn(async () => ({
      assetId: ASSET_ID,
      assetRef: ASSET_REF,
      url: ASSET_REF,
      assetType: 'image',
      contentType: 'image/png',
      sizeBytes: 4,
      filename: 'hero.png',
      createdAt: '2026-03-18T00:00:00.000Z',
    }));
    const resolveAssets = vi.fn(async () => ({
      assets: [{ assetId: ASSET_ID, assetRef: ASSET_VERSION_KEY, url: ASSET_REF }],
    }));

    (globalThis as Record<string, unknown>)[HOSTED_ASSET_BRIDGE_KEY] = {
      listAssets: vi.fn(async () => []),
      resolveAssets,
      uploadAsset,
    };
    (globalThis as Record<string, unknown>).document = {
      documentElement: {
        dataset: {
          ckOwnerAccountId: ACCOUNT_ID,
        },
      },
    };

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'hero.png', { type: 'image/png' });
    const uploaded = await uploadEditorAsset({
      file,
      context: {
        accountId: ACCOUNT_ID,
        publicId: PUBLIC_ID,
        widgetType: 'faq',
      },
    });

    expect(uploaded.assetId).toBe(ASSET_ID);
    expect(uploaded.assetRef).toBe(ASSET_VERSION_KEY);
    expect(uploaded.url).toBe(ASSET_REF);
    expect(uploadAsset).toHaveBeenCalledTimes(1);

    const resolved = await resolveEditorAssetChoices([ASSET_ID]);
    expect(resolveAssets).toHaveBeenCalledWith([ASSET_ID]);
    expect(resolved.get(ASSET_ID)).toEqual({
      assetId: ASSET_ID,
      assetRef: ASSET_VERSION_KEY,
      url: ASSET_REF,
    });
  });
});

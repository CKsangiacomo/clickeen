import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseAccountAssetBlobKey,
  parseAccountAssetRef,
} from '@clickeen/ck-contracts';

const ASSET_ID = '11111111-1111-4111-8111-111111111111';

test('account asset references use account public IDs and uuid asset IDs', () => {
  assert.deepEqual(
    parseAccountAssetRef(`/assets/account/A1B2C3D4/${ASSET_ID}/hero.png`),
    {
      accountId: 'A1B2C3D4',
      assetId: ASSET_ID,
      filename: 'hero.png',
      key: `accounts/A1B2C3D4/assets/${ASSET_ID}/blob/hero.png`,
      kind: 'account',
      pathname: `/assets/account/A1B2C3D4/${ASSET_ID}/hero.png`,
    },
  );
  assert.deepEqual(
    parseAccountAssetBlobKey(`accounts/A1B2C3D4/assets/${ASSET_ID}/blob/hero.png`),
    {
      accountId: 'A1B2C3D4',
      assetId: ASSET_ID,
      filename: 'hero.png',
      key: `accounts/A1B2C3D4/assets/${ASSET_ID}/blob/hero.png`,
      kind: 'account',
      pathname: `/assets/account/A1B2C3D4/${ASSET_ID}/hero.png`,
    },
  );
});

test('account asset references reject uuid account folders', () => {
  const uuidAccountId = '00000000-0000-0000-0000-000000000100';
  assert.equal(parseAccountAssetRef(`/assets/account/${uuidAccountId}/${ASSET_ID}/hero.png`), null);
  assert.equal(parseAccountAssetBlobKey(`accounts/${uuidAccountId}/assets/${ASSET_ID}/blob/hero.png`), null);
});

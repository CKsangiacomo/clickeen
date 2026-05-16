import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseAccountAssetKey,
  parseAccountAssetRef,
} from '@clickeen/ck-contracts';

const ASSET_REF = 'hero.png';

test('account asset references use account public IDs and stable asset refs', () => {
  assert.deepEqual(
    parseAccountAssetRef(`/assets/account/A1B2C3D4/${ASSET_REF}`),
    {
      accountId: 'A1B2C3D4',
      assetRef: ASSET_REF,
      filename: 'hero.png',
      key: `accounts/A1B2C3D4/assets/${ASSET_REF}`,
      kind: 'account',
      pathname: `/assets/account/A1B2C3D4/${ASSET_REF}`,
    },
  );
  assert.deepEqual(
    parseAccountAssetKey(`accounts/A1B2C3D4/assets/${ASSET_REF}`),
    {
      accountId: 'A1B2C3D4',
      assetRef: ASSET_REF,
      filename: 'hero.png',
      key: `accounts/A1B2C3D4/assets/${ASSET_REF}`,
      kind: 'account',
      pathname: `/assets/account/A1B2C3D4/${ASSET_REF}`,
    },
  );
});

test('account asset references reject uuid account folders', () => {
  const uuidAccountId = '00000000-0000-0000-0000-000000000100';
  assert.equal(parseAccountAssetRef(`/assets/account/${uuidAccountId}/${ASSET_REF}`), null);
  assert.equal(parseAccountAssetKey(`accounts/${uuidAccountId}/assets/${ASSET_REF}`), null);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function main(): Promise<void> {
  const romaUpload = await readFile(
    new URL('../app/api/account/assets/upload/route.ts', import.meta.url),
    'utf8',
  );
  const tokyoAssets = await readFile(
    new URL('../../tokyo-worker/src/domains/assets-handlers.ts', import.meta.url),
    'utf8',
  );

  const statusGate = "gateway.value.authzPayload.accountStatus !== 'active'";
  const statusGateIndex = romaUpload.indexOf(statusGate);
  const policyIndex = romaUpload.indexOf('resolvePolicyFromEntitlementsSnapshot({');
  const tokyoCallIndex = romaUpload.indexOf('fetchTokyoAssetControl({');

  assert.ok(statusGateIndex > 0, 'Roma upload applies the account-status policy');
  assert.ok(policyIndex > statusGateIndex, 'account status is gated before upload entitlement work');
  assert.ok(tokyoCallIndex > statusGateIndex, 'account status is gated before Tokyo receives the upload');
  assert.match(romaUpload, /kind: 'DENY', reasonKey: 'coreui\.errors\.account\.disabled'/);
  assert.match(romaUpload, /\{ status: 403 \}/);
  assert.doesNotMatch(tokyoAssets, /accountAuthz\.accountStatus|accountStatus !== 'active'/);
}

void main();

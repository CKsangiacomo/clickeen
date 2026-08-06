import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAccountAssetRef } from '../lib/account-asset-record';

async function main() {
const route = await readFile(new URL('../app/api/account/catalog-assets/copy/route.ts', import.meta.url), 'utf8');
assert.match(route, /resolveCurrentAccountAssetGatewayContext\(\{ request, minRole: 'editor' \}\)/);
assert.match(route, /path: '\/__internal\/assets\/catalog-copy'/);
assert.match(route, /policy\.limits\['uploads\.size\.max'\]/);
assert.match(route, /policy\.limits\['storage\.bytes\.max'\]/);
assert.match(route, /assetRefs\.some\(\(value\) => !isAccountAssetRef\(value\)\)/);
assert.match(route, /Object\.keys\(raw\)\.length !== 1/);
assert.doesNotMatch(route, /sourceAccountId|ownerAccountId/);

assert.equal(isAccountAssetRef('hero.png'), true, 'Copy input uses the same account-local ref stored in templates');
assert.equal(isAccountAssetRef('folder/hero.png'), true);
assert.equal(isAccountAssetRef('/assets/account/CLICKEEN/hero.png'), false);

const gateway = await readFile(new URL('../lib/account-assets-gateway.ts', import.meta.url), 'utf8');
assert.match(gateway, /buildTokyoAssetControlHeaders\([\s\S]*headers: args\.headers/);

console.log('Roma Catalog asset copy boundary verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

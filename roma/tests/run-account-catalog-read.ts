import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeWidgetCatalogTemplate } from '../lib/account-catalog';

async function main() {
const presentation = { thumbnailAssetRef: '/assets/account/CLICKEEN/catalog.png', description: 'Catalog item', category: 'Featured', displayOrder: 1 };
const files = { indexHtml: '<html>catalog</html>', stylesCss: '.catalog{}', runtimeJs: 'void 0;' };

assert.deepEqual(decodeWidgetCatalogTemplate({
  templateId: 'CATW123456', templateName: 'Catalog widget', widgetType: 'cards', updatedAt: '2026-08-06T00:00:00.000Z',
  isTemplate: true, catalogPresentation: presentation, source: { config: { reusable: true }, content: { fields: {} } }, publicPackage: files,
}), {
  templateId: 'CATW123456', templateName: 'Catalog widget', widgetType: 'cards', updatedAt: '2026-08-06T00:00:00.000Z',
  isTemplate: true, catalogPresentation: presentation, source: { config: { reusable: true }, content: { fields: {} } }, publicPackage: files,
});
assert.equal(decodeWidgetCatalogTemplate({ isTemplate: false }), null);
assert.equal(decodeWidgetCatalogTemplate({ templateId: 'CATW123456', isTemplate: true }), null);

for (const path of [
  '../app/api/account/widget-catalog/route.ts',
  '../app/api/account/widget-catalog/[templateId]/route.ts',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(source, /resolveCurrentAccountRouteContext\(\{ request, minRole: 'viewer' \}\)/);
  assert.match(source, /export async function GET/);
  assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(source, /CLICKEEN|ownerAccountId|sourceAccountId|destinationAccountId/);
}

const helper = await readFile(new URL('../lib/account-catalog.ts', import.meta.url), 'utf8');
assert.match(helper, /path: '\/__internal\/catalog\/widgets'/);
assert.doesNotMatch(helper, /accountId:\s*'CLICKEEN'|ownerAccountId|sourceAccountId|destinationAccountId/);

console.log('Roma account Catalog read contract verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

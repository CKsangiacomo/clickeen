import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CLICKEEN_CATALOG_ACCOUNT_ID,
  listClickeenPageCatalog,
  listClickeenWidgetCatalog,
  readClickeenPageCatalogTemplate,
  readClickeenWidgetCatalogTemplate,
} from '../src/domains/catalog';
import { createAccountInstanceFromSubmittedSource } from '../src/domains/account-instances/operations';
import { createAccountPageSource } from '../src/domains/pages/source';
import { tryHandleInternalCatalogRoutes } from '../src/routes/internal-catalog-routes';

function createEnv() {
  const objects = new Map<string, { body: string; httpMetadata?: { contentType?: string } }>();
  return {
    TOKYO_R2: {
      async put(key: string, body: string | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
        objects.set(key, { body: typeof body === 'string' ? body : new TextDecoder().decode(body), httpMetadata: options?.httpMetadata });
        return {};
      },
      async get(key: string) {
        const stored = objects.get(key);
        return stored ? { body: new Response(stored.body).body, httpMetadata: stored.httpMetadata, async text() { return stored.body; }, async json() { return JSON.parse(stored.body); } } : null;
      },
      async list(options?: { prefix?: string }) {
        const prefix = options?.prefix ?? '';
        return { objects: [...objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })), truncated: false };
      },
      async delete(keys: string | string[]) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); },
    },
  } as any;
}

const env = createEnv();
const files = { indexHtml: '<html>catalog</html>', stylesCss: '.catalog{}', runtimeJs: 'void 0;' };
const presentation = { thumbnailAssetRef: '/assets/account/CLICKEEN/catalog.png', description: 'Catalog item', category: 'Featured', displayOrder: 1 };

await createAccountInstanceFromSubmittedSource({
  env, accountId: CLICKEEN_CATALOG_ACCOUNT_ID, instanceId: 'CATW123456', widgetType: 'cards', displayName: 'Catalog widget',
  config: { reusable: true }, content: { id: 'CATW123456', accountId: CLICKEEN_CATALOG_ACCOUNT_ID, widgetType: 'cards', fields: {}, updatedAt: '2026-08-06T00:00:00.000Z' },
  isTemplate: true, catalogPresentation: presentation, publicPackage: files,
});
await createAccountInstanceFromSubmittedSource({
  env, accountId: CLICKEEN_CATALOG_ACCOUNT_ID, instanceId: 'LIVE123456', widgetType: 'cards', displayName: 'Ordinary widget',
  config: {}, content: { id: 'LIVE123456', accountId: CLICKEEN_CATALOG_ACCOUNT_ID, widgetType: 'cards', fields: {}, updatedAt: '2026-08-06T00:00:00.000Z' },
  isTemplate: false, baseLocale: 'en', publicPackage: files,
});
assert.deepEqual((await listClickeenWidgetCatalog(env)).map((item) => item.templateId), ['CATW123456']);
assert.equal(await readClickeenWidgetCatalogTemplate(env, 'LIVE123456'), null);
const widget = await readClickeenWidgetCatalogTemplate(env, 'CATW123456');
assert.deepEqual(widget?.catalogPresentation, presentation);
assert.deepEqual(widget?.source.config, { reusable: true });
assert.deepEqual(widget?.publicPackage, files);

const pageSource = { pageId: 'CATP123456', displayName: 'Catalog page', isTemplate: true as const, values: { title: 'Page' }, robots: 'noindex-follow' as const, placements: [], catalogPresentation: presentation };
await createAccountPageSource({ env, accountId: CLICKEEN_CATALOG_ACCOUNT_ID, pageId: pageSource.pageId, source: pageSource, files, overlaysJson: undefined });
const ordinaryPage = { pageId: 'LIVEP12345', displayName: 'Ordinary page', isTemplate: false as const, baseLocale: 'en', values: { title: 'Live' }, robots: 'index-follow' as const, placements: [] };
await createAccountPageSource({ env, accountId: CLICKEEN_CATALOG_ACCOUNT_ID, pageId: ordinaryPage.pageId, source: ordinaryPage, files, overlaysJson: {} });
assert.deepEqual((await listClickeenPageCatalog(env)).map((item) => item.pageId), ['CATP123456']);
assert.equal(await readClickeenPageCatalogTemplate(env, ordinaryPage.pageId), null);
assert.deepEqual(await readClickeenPageCatalogTemplate(env, pageSource.pageId), { source: pageSource, files });

const methodResponse = await tryHandleInternalCatalogRoutes({
  req: new Request('https://tokyo.internal/__internal/catalog/widgets', { method: 'POST' }), env,
  pathname: '/__internal/catalog/widgets', url: new URL('https://tokyo.internal/__internal/catalog/widgets'), respond: (response) => response,
});
assert.equal(methodResponse?.status, 405, 'Catalog boundary must expose GET only');

const routeSource = await readFile(new URL('../src/routes/internal-catalog-routes.ts', import.meta.url), 'utf8');
assert.match(routeSource, /authorizeRomaAccountScopedRequest\(\{/);
assert.match(routeSource, /accountId: callerAccountId/);
assert.match(routeSource, /minRole: 'viewer'/);
assert.doesNotMatch(routeSource, /assertRomaAccountCapsuleAuth|roleRank|authorizeCatalogRead/);
assert.doesNotMatch(routeSource, /accounts\/\$\{|ownerAccountId|sourceAccountId|destinationAccountId/);
assert.match(routeSource, /req\.method !== 'GET'/);

console.log('Catalog fixed-owner read contract verification passed.');

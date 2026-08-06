import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isCompactCatalogId,
  readCatalogPresentation,
  readTemplateCreatePayload,
} from '../functions/_shared/catalog.js';
import { resolveRomaBaseUrl } from '../functions/_shared/env.js';

async function read(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const presentation = {
  thumbnailAssetRef: '/assets/account/CLICKEEN/catalog/thumb.png',
  description: 'Description',
  category: 'Reviews',
  displayOrder: 4,
};

assert.equal(resolveRomaBaseUrl({ ROMA_BASE_URL: 'https://roma.dev.clickeen.com/' }), 'https://roma.dev.clickeen.com');
assert.throws(() => resolveRomaBaseUrl({}), /ROMA_BASE_URL missing/);
assert.throws(() => resolveRomaBaseUrl({ ROMA_BASE_URL: 'https://roma.dev.clickeen.com/path' }), /ROMA_BASE_URL invalid/);
assert.equal(isCompactCatalogId('ABC1234567'), true);
assert.equal(isCompactCatalogId('abc1234567'), false);
assert.deepEqual(readCatalogPresentation(presentation), presentation);
assert.equal(readCatalogPresentation({ ...presentation, extra: true }), null);
assert.deepEqual(readTemplateCreatePayload({ sourceId: 'ABC1234567', templateName: ' Template ', catalogPresentation: presentation }), {
  sourceId: 'ABC1234567',
  templateName: 'Template',
  catalogPresentation: presentation,
});

const [session, middleware, widgets, pages, widgetDetail, pageDetail, widgetRename, pageRename] = await Promise.all([
  read('functions/_shared/session.js'),
  read('functions/_middleware.js'),
  read('functions/api/catalog/widgets.js'),
  read('functions/api/catalog/pages.js'),
  read('functions/api/catalog/widgets/[templateId].js'),
  read('functions/api/catalog/pages/[templateId].js'),
  read('functions/api/catalog/widgets/[templateId]/rename.js'),
  read('functions/api/catalog/pages/[templateId]/rename.js'),
]);

assert.match(session, /accessToken,/);
assert.match(session, /accessToken: refreshed\.accessToken/);
assert.match(middleware, /context\.data\.devstudioSession = session/);
assert.match(widgets, /json\(\{ templates, sources, widgetTypes: Object\.keys\(widgets\)\.sort\(\) \}\)/);
assert.match(pages, /json\(\{ templates, sources \}\)/);
assert.match(widgets, /\/api\/account\/instances\/\$\{payload\.sourceId\}\/save-as-template/);
assert.match(pages, /\/api\/account\/pages\/\$\{payload\.sourceId\}\/save-as-template/);
assert.match(widgetDetail, /method: 'PATCH'/);
assert.match(widgetDetail, /method: 'DELETE'/);
assert.match(pageDetail, /template: \{/);
assert.match(pageDetail, /source,/);
assert.match(pageDetail, /files,/);
assert.match(widgetRename, /\/rename/);
assert.match(pageRename, /\/rename/);

console.log('PASS DevStudio Catalog Function contracts');

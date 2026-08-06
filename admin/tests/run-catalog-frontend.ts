import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  decodeCatalogCollection,
  decodeCatalogDetail,
  readCatalogPresentation,
} from '../src/data/catalogs';

async function read(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const presentation = {
  thumbnailAssetRef: '/assets/account/CLICKEEN/catalog/thumb.png',
  description: 'A useful catalog template.',
  category: 'Reviews',
  displayOrder: 3,
};

assert.deepEqual(decodeCatalogCollection('widgets', {
  templates: [{ templateId: 'ABC1234567', templateName: 'Review wall', widgetType: 'googlereviews', catalogPresentation: presentation }],
  sources: [{ sourceId: 'SRC1234567', displayName: 'Review source', widgetType: 'googlereviews', widget: 'Google Reviews' }],
  widgetTypes: ['googlereviews'],
}), {
  templates: [{ templateId: 'ABC1234567', templateName: 'Review wall', widgetType: 'googlereviews', catalogPresentation: presentation }],
  sources: [{ sourceId: 'SRC1234567', displayName: 'Review source', widgetType: 'googlereviews' }],
  widgetTypes: ['googlereviews'],
});

assert.deepEqual(decodeCatalogCollection('pages', {
  templates: [{ templateId: 'PAGE123456', templateName: 'Landing page', catalogPresentation: presentation }],
  sources: [{ sourceId: 'SOURCE12345', displayName: 'Landing source' }],
}), {
  templates: [{ templateId: 'PAGE123456', templateName: 'Landing page', catalogPresentation: presentation }],
  sources: [{ sourceId: 'SOURCE12345', displayName: 'Landing source' }],
  widgetTypes: [],
});

assert.equal(decodeCatalogCollection('widgets', {
  templates: [],
  sources: [{ sourceId: 'SRC1234567', displayName: 'Missing type' }],
}), null);
assert.equal(decodeCatalogCollection('pages', { templates: [], sources: 'invalid' }), null);
assert.equal(decodeCatalogCollection('pages', {
  templates: [{ templateId: ' PAGE123456 ', templateName: 'Landing page', catalogPresentation: presentation }],
  sources: [],
}), null);

assert.deepEqual(decodeCatalogDetail('pages', {
  template: {
    templateId: 'PAGE123456',
    templateName: 'Landing page',
    catalogPresentation: presentation,
    source: { values: {} },
    files: { indexHtml: '', stylesCss: '', runtimeJs: '' },
  },
}), { templateId: 'PAGE123456', templateName: 'Landing page', catalogPresentation: presentation });

assert.deepEqual(readCatalogPresentation({
  thumbnailAssetRef: presentation.thumbnailAssetRef,
  description: presentation.description,
  category: presentation.category,
  displayOrder: '3',
}), presentation);
assert.equal(readCatalogPresentation({ ...presentation, displayOrder: '' }), null);
assert.equal(readCatalogPresentation({ ...presentation, displayOrder: '-1' }), null);
assert.equal(readCatalogPresentation({ ...presentation, displayOrder: '1.5' }), null);
assert.equal(readCatalogPresentation({ ...presentation, category: ' Reviews ', displayOrder: '3' }), null);
assert.equal(readCatalogPresentation({ ...presentation, thumbnailAssetRef: '/assets/account/OTHER/thumb.png', displayOrder: '3' }), null);

const [routes, main, view, css] = await Promise.all([
  read('src/data/routes.ts'),
  read('src/main.ts'),
  read('src/catalogs.ts'),
  read('src/css/catalogs.css'),
]);

assert.match(routes, /id: 'catalogs',\s+title: 'CATALOGS'/);
assert.match(routes, /title: 'Widget catalog', path: '#\/catalog\/widgets', kind: 'catalog', catalogKind: 'widgets'/);
assert.match(routes, /title: 'Page catalog', path: '#\/catalog\/pages', kind: 'catalog', catalogKind: 'pages'/);
assert.match(main, /if \(route\?\.kind === 'catalog' && route\.catalogKind\)/);
assert.match(main, /renderCatalogView\(route\.catalogKind\)/);

assert.match(view, /requestJson\(apiPath\(kind\)\)/);
assert.match(view, /requestJson\(apiPath\(kind, template\.templateId\)\)/);
assert.match(view, /current\.templateId !== template\.templateId/);
assert.match(view, /method: 'POST',\s+body: JSON\.stringify\(\{ sourceId, templateName, catalogPresentation \}\)/);
assert.match(view, /method: 'PATCH',\s+body: JSON\.stringify\(\{ catalogPresentation \}\)/);
assert.match(view, /`\$\{apiPath\(kind, template\.templateId\)\}\/rename`/);
assert.match(view, /body: JSON\.stringify\(\{ displayName \}\)/);
assert.match(view, /requestJson\(apiPath\(kind, template\.templateId\), \{ method: 'DELETE' \}\)/);
assert.match(view, /thumbnailAssetRef/);
assert.match(view, /description/);
assert.match(view, /category/);
assert.match(view, /displayOrder/);
assert.match(view, /https:\/\/roma\.dev\.clickeen\.com/);
assert.match(view, /\/builder\/\$\{encodeURIComponent\(id\)\}/);
assert.match(view, /\/page-builder\/\$\{encodeURIComponent\(id\)\}/);
assert.match(view, /\/builder\?new=\$\{encodeURIComponent\(input\?\.value \?\? ''\)\}/);
assert.match(view, /\/page-builder\/new/);
assert.match(view, /createDropdown\(\{\s+label: 'Widget type'/);
assert.match(view, /class="diet-table devstudio-catalog__table"/);
assert.match(view, /className = 'diet-popup devstudio-catalog-dialog'/);
assert.match(view, /class="diet-textfield"/);
assert.match(view, /reload DevStudio before another change/);
assert.doesNotMatch(view, /R2|Tokyo|storage|marketplace|ranking|search/i);
assert.match(css, /\.devstudio-catalog-dialog__body/);

console.log('PASS DevStudio Widget and Page Catalog frontend contracts');

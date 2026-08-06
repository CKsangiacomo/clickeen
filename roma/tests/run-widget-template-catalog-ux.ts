import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeRomaWidgetTemplatesResponse } from '../components/use-roma-widget-templates';

async function read(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function main(): Promise<void> {
  const [domain, listShell, controller, table, rowActions, dialogs, templates, catalog, templateData] = await Promise.all([
    read('components/widgets-domain.tsx'),
    read('components/widget-list.tsx'),
    read('components/use-widget-list-controller.ts'),
    read('components/widget-list-table.tsx'),
    read('components/widget-row-actions.tsx'),
    read('components/widget-list-dialogs.tsx'),
    read('components/widget-template-list.tsx'),
    read('components/widget-catalog.tsx'),
    read('components/use-roma-widget-templates.ts'),
  ]);
  const ordinary = [listShell, controller, table, rowActions, dialogs].join('\n');

  assert.match(domain, /type WidgetsView = 'your-widgets' \| 'templates' \| 'catalog'/);
  assert.match(domain, /<WidgetList statusFilter=\{statusFilter\} \/>/);
  assert.match(domain, /<WidgetTemplateList \/>/);
  assert.match(domain, /<WidgetCatalog \/>/);
  assert.doesNotMatch(domain, /fetchJson|displayedCatalog|catalogByWidgetType/);

  assert.match(ordinary, /left\.widget\.localeCompare\(right\.widget\)/);
  assert.match(ordinary, /<td className="body-s">\{instance\.widget\}<\/td>/);
  assert.doesNotMatch(ordinary, /displayedCatalog|catalogByWidgetType|WidgetCatalogOption/);
  assert.match(ordinary, /widgetInstances\.length \+ templateCount/);
  assert.match(ordinary, /productAccountId !== 'CLICKEEN'/);
  assert.match(ordinary, />Save as template<\/span>/);
  assert.match(ordinary, /\/api\/account\/instances\/\$\{encodeURIComponent\(instance\.instanceId\)\}\/save-as-template/);
  assert.match(ordinary, /body: JSON\.stringify\(\{ templateName: nextName \}\)/);
  assert.match(ordinary, /Your current changes will be saved first\./);
  assert.doesNotMatch(ordinary, /Upgrade to save|save-template[^\n]*setUpgradePrompt/);

  assert.deepEqual(normalizeRomaWidgetTemplatesResponse({
    accountId: 'ACME',
    templates: [{
      templateId: 'ABC1234567',
      templateName: 'Review wall',
      widgetType: 'googlereviews',
      widget: 'Google Reviews',
      updatedAt: '2026-08-06T00:00:00.000Z',
    }],
  }), {
    accountId: 'ACME',
    templates: [{
      templateId: 'ABC1234567',
      templateName: 'Review wall',
      widgetType: 'googlereviews',
      widget: 'Google Reviews',
      updatedAt: '2026-08-06T00:00:00.000Z',
    }],
  });
  assert.equal(normalizeRomaWidgetTemplatesResponse({
    accountId: 'ACME',
    templates: [{ templateId: 'ABC1234567' }],
  }), null);

  assert.match(templateData, /\/api\/account\/widget-templates/);
  assert.match(templates, /className="diet-table/);
  assert.match(templates, /roma-template-badge body-xs">Template/);
  assert.match(templates, />Edit<\/span>/);
  assert.match(templates, />Use template<\/span>/);
  assert.match(templates, />Rename<\/span>/);
  assert.match(templates, />Delete<\/span>/);
  assert.match(templates, /buildWidgetTemplateDraftRoute\(\{ kind: 'account-template'/);
  assert.match(templates, /accountId !== 'CLICKEEN'/);
  assert.doesNotMatch(templates, />Published<|>Current<|>Languages<|Copy code|Copy URL|Unpublish/);

  assert.match(catalog, /\/api\/account\/widget-catalog/);
  assert.match(catalog, />Catalog Home<\/span>/);
  assert.match(catalog, /new Set\(ordered\.map\(\(template\) => template\.catalogPresentation\.category\)\)/);
  assert.match(catalog, /template\.templateName\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.match(catalog, /template\.catalogPresentation\.description\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.match(catalog, /left\.catalogPresentation\.displayOrder - right\.catalogPresentation\.displayOrder/);
  assert.match(catalog, /parseAccountAssetRef\(catalogPresentation\.thumbnailAssetRef\)/);
  assert.match(catalog, /thumbnail\?\.accountId !== 'CLICKEEN'/);
  assert.match(catalog, /resolveTokyoBaseUrl\(\)/);
  assert.match(catalog, /new URL\(catalogPresentation\.thumbnailAssetRef, `\$\{tokyoBaseUrl\}\/`\)/);
  assert.match(catalog, /buildWidgetTemplateDraftRoute\(\{ kind: 'catalog-template'/);
  assert.doesNotMatch(catalog, />Rename<|>Delete<|>Publish<|Copy code/);

  console.log('PASS Widget Your widgets, My templates, and CLICKEEN Catalog UX contracts');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function main(): Promise<void> {
  const [domain, ordinary, templates, catalog, builder, route, domains] = await Promise.all([
    read('components/pages-domain.tsx'),
    read('components/page-list.tsx'),
    read('components/page-templates-list.tsx'),
    read('components/page-catalog.tsx'),
    read('components/page-builder.tsx'),
    read('app/(authed)/pages/page.tsx'),
    read('lib/domains.ts'),
  ]);

  assert.match(domain, /type PagesView = 'your-pages' \| 'templates' \| 'catalog'/);
  assert.match(domain, /view === 'your-pages' \? <PageList filter=\{filter\} \/> : view === 'templates' \? <PageTemplatesList \/> : <PageCatalog \/>/);
  assert.match(domain, /headerControls=\{view === 'your-pages' \?/);
  assert.match(route, /searchParams: Promise<\{ view\?: string \| string\[\] \}>/);
  assert.match(route, /if \(view === 'templates' \|\| view === 'catalog'\) return view/);
  assert.match(route, /export const runtime = 'edge'/);
  assert.match(domains, /key: 'pageTemplates', label: 'My templates', href: '\/pages\?view=templates'/);
  assert.match(domains, /key: 'pageCatalog', label: 'Page catalog', href: '\/pages\?view=catalog'/);

  assert.match(templates, /\/api\/account\/page-templates/);
  assert.match(templates, /className="diet-table/);
  assert.match(templates, /roma-template-badge body-xs">Template/);
  assert.match(templates, />Edit</);
  assert.match(templates, /role="menu"/);
  assert.match(templates, />Use template</);
  assert.match(templates, />Rename</);
  assert.match(templates, />Delete</);
  assert.match(templates, /\/page-builder\/new\?template=\$\{encodeURIComponent\(template\.pageId\)\}/);
  assert.match(templates, /accountContext\.accountPublicId !== 'CLICKEEN'/);
  assert.doesNotMatch(templates, />Published<|>Current<|>Languages<|Copy code|Copy URL|Unpublish/);

  assert.match(catalog, /\/api\/account\/page-catalog/);
  assert.match(catalog, />Catalog Home</);
  assert.match(catalog, /new Set\(templates\.map\(\(template\) => template\.catalogPresentation\.category\)\)/);
  assert.match(catalog, /template\.displayName\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.match(catalog, /template\.catalogPresentation\.description\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.match(catalog, /left\.catalogPresentation\.displayOrder - right\.catalogPresentation\.displayOrder/);
  assert.match(catalog, /visibleTemplates\.map\(\(template\)/);
  assert.match(catalog, /\/page-builder\/new\?catalog=\$\{encodeURIComponent\(pageId\)\}/);
  assert.match(catalog, /if \(!canUsePages\) setUpsellOpen\(true\);\s+else router\.push/);
  assert.match(catalog, /parseAccountAssetRef\(catalogPresentation\.thumbnailAssetRef\)/);
  assert.match(catalog, /thumbnail\?\.accountId !== 'CLICKEEN'/);
  assert.match(catalog, /resolveTokyoBaseUrl\(\)/);
  assert.match(catalog, /new URL\(template\.catalogPresentation\.thumbnailAssetRef, `\$\{tokyoBaseUrl\}\/`\)/);
  assert.doesNotMatch(catalog, /<article[^>]*>\s*<h2[^>]*>Blank|hardcoded|child Instance|cloneInstance/);

  assert.match(ordinary, /\/api\/account\/page-templates/);
  assert.match(ordinary, /pages\.length \+ templateCount < pageLimit/);
  assert.match(ordinary, /accountContext\.accountPublicId !== 'CLICKEEN' && templateCount !== null/);
  assert.match(ordinary, /\{hasTemplateCapacity \? <button[\s\S]*?>Save as template<\/span><\/button> : null\}/);
  assert.match(ordinary, /\/api\/account\/pages\/\$\{encodeURIComponent\(page\.source\.pageId\)\}\/save-as-template/);
  assert.match(ordinary, /body: JSON\.stringify\(\{ templateName: name \}\)/);
  assert.match(ordinary, /Promise\.all\(\[reload\(true\), reloadTemplateCount\(\)\]\)/);
  assert.match(ordinary, /aria-label="Save Page as template"/);
  assert.match(ordinary, /templateName\.trim\(\) === saveTemplatePage\?\.source\.displayName\.trim\(\)/);
  assert.match(ordinary, />Open template<\/span>/);

  assert.match(builder, /accountContext\.accountPublicId !== 'CLICKEEN'/);
  assert.match(builder, /pageCount \+ templateCount < pageLimit/);
  assert.match(builder, /counts\.pages \+ counts\.templates >= pageLimit/);
  assert.match(builder, /currentPageId && source\.isTemplate \? <button[\s\S]*?>Use template<\/span>/);
  assert.match(builder, /pendingLeaveRef\.current = openDraft/);
  assert.match(builder, /response\.status === 402 && kind === 'UPGRADE_REQUIRED'/);
  assert.match(builder, />Open template<\/span>/);

  console.log('PASS Page Your pages, My templates, and Catalog UX contracts');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

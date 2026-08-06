import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function main(): Promise<void> {
  const [widgetRoute, templateList] = await Promise.all([
    read('app/api/account/instances/[instanceId]/route.ts'),
    read('app/api/account/widget-templates/route.ts'),
  ]);

const widgetPatch = widgetRoute.slice(
  widgetRoute.indexOf('export async function PATCH'),
  widgetRoute.indexOf('export async function PUT'),
);
assert.match(widgetPatch, /accountId !== 'CLICKEEN'/);
assert.match(widgetPatch, /Object\.keys\(body\.payload\)\.length === 1/);
assert.match(widgetPatch, /parseCatalogPresentation\(body\.payload\.catalogPresentation\)/);
assert.match(widgetPatch, /!source\.value\.row\.isTemplate/);
assert.match(widgetPatch, /config: source\.value\.config/);
assert.match(widgetPatch, /content: source\.value\.content/);
assert.match(widgetPatch, /publicPackage: packageResult\.value\.publicPackage/);
assert.doesNotMatch(widgetPatch, /materializeAccountInstanceSourceArtifacts|listTokyoWidgetDefinitions/);

assert.match(templateList, /instance\.catalogPresentation/);
assert.match(templateList, /template_display_name_missing/);
assert.doesNotMatch(templateList, /Untitled template/);
assert.doesNotMatch(templateList, /catalogPresentation: \{[^}]*thumbnailAssetRef/s);

  console.log('PASS Roma Catalog management route contracts');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

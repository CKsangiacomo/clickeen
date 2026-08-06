import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function position(source: string, marker: string): number {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `missing marker: ${marker}`);
  return index;
}

function assertBefore(source: string, earlier: string, later: string): void {
  assert.ok(position(source, earlier) < position(source, later), `${earlier} must precede ${later}`);
}

async function verifyWidgetCommand(): Promise<void> {
  const route = await read('app/api/account/instances/[instanceId]/save-as-template/route.ts');
  const direct = await read('lib/account-instance-direct.ts');
  const write = 'const created = await createAccountInstanceInTokyo({';

  assert.match(route, /minRole: 'editor'/);
  assert.match(route, /accountId === 'CLICKEEN'/);
  assert.match(route, /\['catalogPresentation', 'templateName'\]/);
  assert.match(route, /parseCatalogPresentation\(payload\.catalogPresentation\)/);
  assert.match(route, /source\.value\.row\.isTemplate \|\| source\.value\.row\.displayName === templateName/);
  assert.match(route, /resolvePolicyFromEntitlementsSnapshot\(\{/);
  assert.match(route, /limits\['widgets\.instances\.max'\]/);
  assert.match(route, /kind: 'UPGRADE_REQUIRED'/);
  assert.match(route, /gate: 'widgets\.instances\.max'/);
  assert.match(route, /action: 'create_instance'/);
  assert.match(route, /status: 402/);
  assert.doesNotMatch(route, /materializeAccountInstanceSourceArtifacts|listTokyoWidgetDefinitions/);
  assertBefore(route, 'const templateInput = readTemplateInput(body.payload, accountId);', write);
  assertBefore(route, 'source.value.row.isTemplate || source.value.row.displayName === templateName', write);
  assertBefore(route, 'if (inventory.value.instanceIds.length >= limit)', write);
  assertBefore(route, 'const sourcePackage = await loadTokyoAccountInstancePublicPackage({', write);
  assertBefore(route, 'let templateId = createCompactInstanceId();', write);
  assert.match(route, /isTemplate: true,/);
  assert.match(route, /\.\.\.\(catalogPresentation \? \{ catalogPresentation \} : \{\}\),/);
  assert.match(route, /config: source\.value\.config,/);
  assert.match(route, /content: \{ \.\.\.source\.value\.content, id: templateId \},/);
  assert.match(route, /publicPackage: sourcePackage\.value\.publicPackage,/);
  assert.match(route, /while \(templateId === instanceId \|\| inventory\.value\.instanceIds\.includes\(templateId\)\)/);
  assert.doesNotMatch(route, /baseLocale:|translatedValues|localeStatus/);

  assert.match(direct, /export async function loadTokyoAccountInstanceSourceSnapshot/);
  assert.match(direct, /config: sourceConfig,\s+content: sourceContent,/s);
  assert.match(direct, /sourceContent\.id !== row\.instanceId/);
  assert.match(direct, /row\.accountId !== args\.accountId/);
  assert.doesNotMatch(
    direct.slice(position(direct, 'export async function loadTokyoAccountInstanceSourceSnapshot'), position(direct, 'export async function loadTokyoAccountInstancePublicPackage')),
    /composeConfigWithInstanceContent/,
  );
}

async function main(): Promise<void> {
  await verifyWidgetCommand();
  console.log('Roma Save-as-template command verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

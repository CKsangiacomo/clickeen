import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function assertLocalePackageCallsDoNotStreamActivity(source: string): void {
  const calls = source.match(/materializeAccountInstanceLocalePackages\(\{[\s\S]*?\n\s*\}\)/g) ?? [];
  assert.ok(calls.length > 0, 'expected locale package materialization calls');
  for (const call of calls) {
    assert.doesNotMatch(call, /onActivity/);
  }
}

async function testRomaSaveDoesNotRunLocalization(): Promise<void> {
  const routeSource = await readSource('roma/app/api/account/instances/[instanceId]/route.ts');

  assert.doesNotMatch(routeSource, /runAccountInstanceSourceSaveLocaleCascade/);
  assert.doesNotMatch(routeSource, /sourceSaved/);
  assert.doesNotMatch(routeSource, /localeCascade/);
  assert.doesNotMatch(routeSource, /resolvePolicyFromEntitlementsSnapshot/);
  assert.match(routeSource, /saveAccountInstanceInTokyo/);
  assert.match(routeSource, /NextResponse\.json\(\{\s*ok: true,\s*\}\)/);
}

async function testBobSaveHasNoPartialLocalizationBranch(): Promise<void> {
  const savingSource = await readSource('bob/lib/session/useSessionSaving.ts');

  assert.doesNotMatch(savingSource, /sourceSaved/);
  assert.doesNotMatch(savingSource, /localeCascade/);
  assert.doesNotMatch(savingSource, /source: 'translation'/);
  assert.match(savingSource, /command: 'update-instance'/);
  assert.match(savingSource, /savedInstanceDataSignature: submittedInstanceDataSignature/);
}

async function testExplicitTranslationRouteSurvives(): Promise<void> {
  const translationRouteSource = await readSource(
    'roma/app/api/account/instances/[instanceId]/translations/generate/route.ts',
  );
  const localePackageSource = await readSource('roma/lib/account-instance-locale-package.ts');
  const panelSource = await readSource('bob/components/TranslationsPanel.tsx');

  assert.match(translationRouteSource, /generateAccountInstanceTranslations/);
  assert.match(translationRouteSource, /materializeAccountInstanceLocalePackages/);
  assert.match(translationRouteSource, /localePackages/);
  assert.match(translationRouteSource, /activeLocalesToGenerate/);
  assert.match(translationRouteSource, /generateAccountInstanceTranslations\(\{[\s\S]*onActivity: activity/);
  assertLocalePackageCallsDoNotStreamActivity(translationRouteSource);
  assert.doesNotMatch(localePackageSource, /package-materializing|Writing \$\{locale\} package|locale-completed/);
  assert.match(panelSource, /Generate translations/);
  assert.match(panelSource, /generateTranslations/);
}

async function testNoAccountInstanceMetaPersistenceContract(): Promise<void> {
  const bobSaveSource = await readSource('bob/lib/session/useSessionSaving.ts');
  const romaSaveRoute = await readSource('roma/app/api/account/instances/[instanceId]/route.ts');
  const romaDirectSource = await readSource('roma/lib/account-instance-direct.ts');
  const tokyoRoutes = await readSource('tokyo-worker/src/routes/internal-instance-routes.ts');
  const tokyoTypes = await readSource('tokyo-worker/src/domains/account-instances/types.ts');

  assert.doesNotMatch(bobSaveSource, /saveBody\.meta|meta:\s*null/);
  assert.doesNotMatch(romaSaveRoute, /body\.meta|\{ meta \}/);
  assert.doesNotMatch(romaDirectSource, /meta:/);
  assert.doesNotMatch(tokyoRoutes, /rawBody\.meta|body\.meta|pointer\.meta|normalizeSubmittedMeta/);
  assert.doesNotMatch(tokyoTypes, /meta\?: Record<string, unknown> \| null/);
}

async function testNoInventedAccountInstanceBodyKeyWhitelist(): Promise<void> {
  for (const path of [
    'roma/app/api/account/instances/[instanceId]/route.ts',
    'roma/app/api/account/instances/route.ts',
    'roma/lib/account-instance-direct.ts',
    'tokyo-worker/src/routes/internal-instance-routes.ts',
  ]) {
    const source = await readSource(path);
    assert.doesNotMatch(source, /bodyHasOnlyKeys/);
    assert.doesNotMatch(source, /ACCOUNT_INSTANCE_SAVE_BODY_KEYS/);
    assert.doesNotMatch(source, /INTERNAL_INSTANCE_(CREATE|SAVE)_BODY_KEYS/);
  }
}

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'Roma source save does not run localization', run: testRomaSaveDoesNotRunLocalization },
  { name: 'Bob save has no partial localization branch', run: testBobSaveHasNoPartialLocalizationBranch },
  { name: 'explicit translation route and panel survive', run: testExplicitTranslationRouteSurvives },
  { name: 'account instance persistence has no generic meta contract', run: testNoAccountInstanceMetaPersistenceContract },
  { name: 'account instance save has no invented body key whitelist', run: testNoInventedAccountInstanceBodyKeyWhitelist },
];

async function main(): Promise<void> {
  for (const test of tests) {
    try {
      await test.run();
      console.log(`PASS ${test.name}`);
    } catch (error) {
      console.error(`FAIL ${test.name}`);
      throw error;
    }
  }
}

void main();

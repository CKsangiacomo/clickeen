import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeRuntimePackage } from '@clickeen/ck-runtime-materializer';
import { extractSavedTextFieldsForEditableFields } from '@clickeen/ck-contracts/translated-value-primitives';
import {
  buildAccountDefaultStateFixture,
  buildCompiledWidgetFixture,
  PACKAGE_PARITY_WIDGETS,
  readExpectedPackageFixture,
  widgetFixtureCoordinate,
  type PackageParityWidget,
} from './instance-package-fixtures';
import {
  buildSavedWidgetPublicPackageResult,
  buildSavedWidgetPublicPackage,
  materializeAccountInstanceLocalePublicPackage,
  materializeAccountInstancePublicPackage,
} from '../lib/account-instance-public-package';
import { buildLocalePackageMaterializationFailure } from '../lib/account-instance-locale-package';
import { buildLocalePackageDeleteFailureCoordinate } from '../lib/account-locale-overlay-update';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function assertRomaIsOnly124CCaller(): Promise<void> {
  const files = [
    'roma/lib/account-instance-public-package.ts',
    'packages/ck-runtime-materializer/src/materialize.ts',
    'packages/ck-runtime-materializer/src/index.ts',
  ];
  const joined = await Promise.all(files.map((file) => readFile(path.join(repoRoot, file), 'utf8')));
  assert.match(joined[0]!, /@clickeen\/ck-runtime-materializer/);
  assert.doesNotMatch(joined[1]!, /roma\/|@roma\/|tokyo-worker|next\/|react|process\.env/);
  assert.doesNotMatch(joined[2]!, /roma\/|@roma\/|tokyo-worker|next\/|react|process\.env/);
}

async function readRouteSource(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function materializeForWidget(widgetType: PackageParityWidget) {
  const compiled = await buildCompiledWidgetFixture(widgetType);
  const state = await buildAccountDefaultStateFixture(widgetType);
  const coordinate = widgetFixtureCoordinate(widgetType);
  return buildSavedWidgetPublicPackage({
    compiled,
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    state,
  });
}

async function testAllWidgetDualBuildParity(): Promise<void> {
  const expected = await readExpectedPackageFixture();
  for (const widgetType of PACKAGE_PARITY_WIDGETS) {
    const result = await materializeForWidget(widgetType);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) continue;
    assert.deepEqual(result.value, {
      ...expected[widgetType],
      dependencies: { instanceIds: [] },
    });
    console.log(`PASS all-widget dual-build parity ${widgetType}`);
  }
}

async function testAdapterInputContract(): Promise<void> {
  const widgetType = 'faq';
  const compiled = await buildCompiledWidgetFixture(widgetType);
  const state = await buildAccountDefaultStateFixture(widgetType);
  const coordinate = widgetFixtureCoordinate(widgetType);
  const result = await buildSavedWidgetPublicPackage({
    compiled,
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    state,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.match(result.value.runtimeJs, /var selectedLocale = payload\.baseLocale;/);
  assert.match(result.value.runtimeJs, /"languages":\["en"\]/);
  assert.doesNotMatch(result.value.runtimeJs, /"fr"/);
  assert.match(result.value.runtimeJs, /"instanceId":"inst_faq"/);
}

async function testCreateSaveDuplicateRoutePackageSubmission(): Promise<void> {
  const routes = [
    'roma/app/api/account/instances/route.ts',
    'roma/app/api/account/instances/[instanceId]/route.ts',
    'roma/app/api/account/instances/[instanceId]/duplicate/route.ts',
  ];
  for (const routePath of routes) {
    const source = await readRouteSource(routePath);
    assert.match(source, /materializeAccountInstancePublicPackage\(\{/);
    assert.match(source, /publicPackage\.value/);
    assert.match(source, /publicPackage\.ok/);
    assert.match(source, /createAccountInstanceInTokyo|saveAccountInstanceInTokyo/);
  }
  const duplicateRoute = await readRouteSource('roma/app/api/account/instances/[instanceId]/duplicate/route.ts');
  assert.match(duplicateRoute, /const instanceId = createCompactInstanceId\(\);/);
  assert.match(duplicateRoute, /instanceId,\n\s+baseLocale,/);
}

async function testInstanceMetaRemovedContract(): Promise<void> {
  const bobSaveSource = await readRouteSource('bob/lib/session/useSessionSaving.ts');
  assert.doesNotMatch(bobSaveSource, /meta:\s*meta\?\.meta\s*\?\?\s*null/);
  assert.doesNotMatch(bobSaveSource, /meta:\s*null/);
  assert.doesNotMatch(bobSaveSource, /saveBody\.meta/);

  const bobSessionTypes = await readRouteSource('bob/lib/session/sessionTypes.ts');
  assert.doesNotMatch(bobSessionTypes, /meta\?: Record<string, unknown> \| null/);

  const romaSaveRoute = await readRouteSource('roma/app/api/account/instances/[instanceId]/route.ts');
  assert.doesNotMatch(romaSaveRoute, /body\.meta/);
  assert.doesNotMatch(romaSaveRoute, /\{ meta \}/);

  const duplicateRoute = await readRouteSource('roma/app/api/account/instances/[instanceId]/duplicate/route.ts');
  assert.doesNotMatch(duplicateRoute, /meta:\s*null/);

  const tokyoRoutes = await readRouteSource('tokyo-worker/src/routes/internal-instance-routes.ts');
  assert.doesNotMatch(tokyoRoutes, /rawBody\.meta|body\.meta|pointer\.meta|normalizeSubmittedMeta/);

  const tokyoTypes = await readRouteSource('tokyo-worker/src/domains/account-instances/types.ts');
  assert.doesNotMatch(tokyoTypes, /meta\?: Record<string, unknown> \| null/);
}

async function testErrorMapping(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const state = await buildAccountDefaultStateFixture('faq');
  const coordinate = widgetFixtureCoordinate('faq');
  delete compiled.widgetPackage?.files['product/widgets/faq/widget.css'];
  const result = await buildSavedWidgetPublicPackage({
    compiled,
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    state,
  });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) return;
  assert.equal(result.status, 422);
  assert.equal(result.error.kind, 'VALIDATION');
  assert.equal(result.error.reasonKey, 'coreui.errors.widget.packageMissing:product/widgets/faq/widget.css');
}

async function testByteExactStateSerialization(): Promise<void> {
  const result = await materializeForWidget('countdown');
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  const expected = (await readExpectedPackageFixture()).countdown;
  assert.equal(result.value.runtimeJs, expected.runtimeJs);
}

async function testAdapterEvidencePlumbing(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const state = await buildAccountDefaultStateFixture('faq');
  const coordinate = widgetFixtureCoordinate('faq');
  const result = await buildSavedWidgetPublicPackageResult({
    compiled,
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    state,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.deepEqual(result.value.evidence.localeCoordinate, {
    kind: 'account-instance-widget',
    accountPublicId: 'CLICKEEN',
    instanceId: 'inst_faq',
    baseLocale: 'en',
    requestedLocale: 'en',
  });
  assert.match(result.value.evidence.sourceReference, /^accounts\/CLICKEEN\/instances\/inst_faq\/base$/);
  assert.match(result.value.evidence.sourceFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.value.evidence.schemaWidgetContractFingerprint, /^widget-editable-fields:[a-f0-9]{8}$/);
  assert.equal(result.value.evidence.overlayFingerprint, null);
  assert.equal(result.value.evidence.materializerContractVersion, 'ck-runtime-materializer:124B');
  assert.match(result.value.evidence.generatedPackageFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.value.evidence.supportFileFingerprints, []);
}

async function testRouteFacingMaterializerWrapper(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('calltoaction');
  const config = await buildAccountDefaultStateFixture('calltoaction');
  const coordinate = widgetFixtureCoordinate('calltoaction');
  const result = await materializeAccountInstancePublicPackage({
    compiled,
    accountId: coordinate.accountId,
    accountCapsule: 'test-capsule',
    requestId: 'test-request',
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    displayName: coordinate.displayName,
    config,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(typeof result.value.indexHtml, 'string');
  assert.equal(typeof result.value.stylesCss, 'string');
  assert.equal(typeof result.value.runtimeJs, 'string');
}

async function testLocalePackageMaterializerWrapper(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const config = await buildAccountDefaultStateFixture('faq');
  const coordinate = widgetFixtureCoordinate('faq');
  const fields = extractSavedTextFieldsForEditableFields({
    contract: compiled.editableFields!,
    config,
  });
  const overlayValues = Object.fromEntries(fields.map((field) => [field.path, `fr:${field.baseText}`]));
  const result = await materializeAccountInstanceLocalePublicPackage({
    compiled,
    accountId: coordinate.accountId,
    accountCapsule: 'test-capsule',
    requestId: 'test-request',
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    requestedLocale: 'fr',
    activeLocales: ['fr'],
    displayName: coordinate.displayName,
    config,
    overlayValues,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.match(result.value.package.indexHtml, /<html lang="fr">/);
  assert.match(result.value.package.runtimeJs, /var selectedLocale = "fr";/);
  assert.match(result.value.package.runtimeJs, /"languages":\["en","fr"\]/);
  const overlayFingerprint = result.value.evidence.overlayFingerprint;
  if (typeof overlayFingerprint !== 'string') throw new Error('locale overlay fingerprint missing');
  assert.match(overlayFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.value.evidence.localeCoordinate.requestedLocale, 'fr');
  assert.equal(result.value.evidence.materializerContractVersion, 'ck-runtime-materializer:124B');
}

async function testLocalePackageRejectsBaseAndInactiveLocales(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const config = await buildAccountDefaultStateFixture('faq');
  const coordinate = widgetFixtureCoordinate('faq');
  const fields = extractSavedTextFieldsForEditableFields({
    contract: compiled.editableFields!,
    config,
  });
  const overlayValues = Object.fromEntries(fields.map((field) => [field.path, `fr:${field.baseText}`]));
  const baseResult = await materializeAccountInstanceLocalePublicPackage({
    compiled,
    accountId: coordinate.accountId,
    accountCapsule: 'test-capsule',
    requestId: 'test-request',
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    requestedLocale: coordinate.baseLocale,
    activeLocales: ['fr'],
    displayName: coordinate.displayName,
    config,
    overlayValues,
  });
  assert.equal(baseResult.ok, false, JSON.stringify(baseResult));
  if (!baseResult.ok) assert.equal(baseResult.error.detail, 'locale_package_base_locale_requested');

  const inactiveResult = await materializeAccountInstanceLocalePublicPackage({
    compiled,
    accountId: coordinate.accountId,
    accountCapsule: 'test-capsule',
    requestId: 'test-request',
    instanceId: coordinate.instanceId,
    baseLocale: coordinate.baseLocale,
    requestedLocale: 'fr',
    activeLocales: ['de'],
    displayName: coordinate.displayName,
    config,
    overlayValues,
  });
  assert.equal(inactiveResult.ok, false, JSON.stringify(inactiveResult));
  if (!inactiveResult.ok) assert.equal(inactiveResult.error.detail, 'locale_package_inactive_locale');
}

async function testLocaleMaterializationRouteWiring(): Promise<void> {
  const generateRoute = await readRouteSource('roma/app/api/account/instances/[instanceId]/translations/generate/route.ts');
  assert.match(generateRoute, /materializeAccountInstanceLocalePackages\(\{/);
  assert.match(generateRoute, /localePackages/);
  assert.match(generateRoute, /generateAccountInstanceTranslations\(\{/);

  const settingsRoute = await readRouteSource('roma/app/api/account/locales/route.ts');
  assert.match(settingsRoute, /materializeAccountInstanceLocalePackages\(\{/);
  assert.match(settingsRoute, /deleteAccountInstanceLocalePackageArtifact\(\{/);
  assert.match(settingsRoute, /locale-package-delete/);
  assert.match(settingsRoute, /locale-package-materialize/);
}

async function testLocalePackageFailureCoordinates(): Promise<void> {
  const result = buildLocalePackageMaterializationFailure({
    status: 409,
    kind: 'VALIDATION',
    reasonKey: 'coreui.errors.instance.embedNotReady',
    detail: 'write_failed',
    completed: [
      {
        accountId: 'CLICKEEN',
        instanceId: 'inst_faq',
        locale: 'fr',
        publicPackageFingerprint: 'sha256:stored',
      },
    ],
    remainingLocales: ['it', 'de'],
    accountId: 'CLICKEEN',
    instanceId: 'inst_faq',
    locale: 'es',
    phase: 'package-write',
  });
  assert.equal(result.ok, false);
  assert.equal(result.value.ok, false);
  assert.deepEqual(result.value.completed, [
    {
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'fr',
      publicPackageFingerprint: 'sha256:stored',
    },
  ]);
  assert.deepEqual(result.value.skipped, [
    {
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'it',
      phase: 'not-attempted-after-failure',
    },
    {
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'de',
      phase: 'not-attempted-after-failure',
    },
  ]);
  assert.deepEqual(result.value.failed, {
    accountId: 'CLICKEEN',
    instanceId: 'inst_faq',
    locale: 'es',
    phase: 'package-write',
    reasonKey: 'coreui.errors.instance.embedNotReady',
    detail: 'write_failed',
  });

  assert.deepEqual(
    buildLocalePackageDeleteFailureCoordinate({
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'fr',
      reasonKey: 'coreui.errors.db.writeFailed',
      detail: 'delete_failed',
    }),
    {
      accountId: 'CLICKEEN',
      instanceId: 'inst_faq',
      locale: 'fr',
      phase: 'locale-package-delete',
      reasonKey: 'coreui.errors.db.writeFailed',
      detail: 'delete_failed',
    },
  );
}

async function testTokyoLocalePackageStorageWiring(): Promise<void> {
  const packageSource = await readRouteSource('tokyo-worker/src/domains/account-instances/package-files.ts');
  assert.match(packageSource, /writeInstanceLocalePackage/);
  assert.match(packageSource, /deleteInstanceLocalePackage/);
  assert.match(packageSource, /localePackageAccountPublicId/);
  assert.match(packageSource, /localePackageSourceUpdatedAt/);
  assert.match(packageSource, /materializerContractVersion/);

  const routeSource = await readRouteSource('tokyo-worker/src/routes/internal-instance-routes.ts');
  assert.equal(routeSource.includes('/locales\\/([^/]+)\\/package'), true);
  assert.match(routeSource, /writeInstanceLocalePackage\(\{/);
  assert.match(routeSource, /deleteInstanceLocalePackage\(\{/);

  const publicServing = await readRouteSource('tokyo-worker/src/routes/clk-live-routes.ts');
  assert.match(publicServing, /instance-locale/);
  assert.match(publicServing, /readInstanceLocalePackageObject/);
  assert.match(publicServing, /Locale not available/);
  assert.doesNotMatch(publicServing, /materializeRuntimePackage|generateAccountInstanceTranslations|readAccountInstanceTranslationValues/);
}

async function testMaterializerRejectsOverlayAtBase(): Promise<void> {
  const compiled = await buildCompiledWidgetFixture('faq');
  const state = await buildAccountDefaultStateFixture('faq');
  const result = await materializeRuntimePackage({
    compiled: {
      widgetname: compiled.widgetname,
      displayName: compiled.displayName,
      editableFields: compiled.editableFields,
      controls: compiled.controls,
      widgetPackage: { files: compiled.widgetPackage?.files ?? {} },
    },
    artifactCoordinate: {
      kind: 'account-instance-widget',
      accountPublicId: 'CLICKEEN',
      instanceId: 'inst_overlay_reject',
      baseLocale: 'en',
      requestedLocale: 'en',
    },
    displayName: 'overlay reject',
    state,
    localeOverlay: {
      locale: 'en',
      keyKind: 'current_saved_content_concrete_path',
      values: {},
    },
    evidence: {
      schemaWidgetContractFingerprint: 'schema',
      sourceFingerprint: 'source',
      sourceReference: 'test',
      overlayFingerprint: null,
    },
  });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) return;
  assert.equal(result.error.reason, 'locale_overlay_unexpected_for_base');
}

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'all-widget dual-build parity matrix', run: testAllWidgetDualBuildParity },
  { name: 'Roma adapter input contract', run: testAdapterInputContract },
  { name: 'create/save/duplicate route package submission', run: testCreateSaveDuplicateRoutePackageSubmission },
  { name: 'instance meta removed contract', run: testInstanceMetaRemovedContract },
  { name: 'error mapping', run: testErrorMapping },
  { name: 'byte-exact state serialization', run: testByteExactStateSerialization },
  { name: 'adapter evidence plumbing', run: testAdapterEvidencePlumbing },
  { name: 'route-facing materializer wrapper', run: testRouteFacingMaterializerWrapper },
  { name: 'locale package materializer wrapper', run: testLocalePackageMaterializerWrapper },
  { name: 'locale package rejects base and inactive locales', run: testLocalePackageRejectsBaseAndInactiveLocales },
  { name: 'locale materialization route wiring', run: testLocaleMaterializationRouteWiring },
  { name: 'locale package failure coordinates', run: testLocalePackageFailureCoordinates },
  { name: 'Tokyo locale package storage wiring', run: testTokyoLocalePackageStorageWiring },
  { name: 'base rejects overlay', run: testMaterializerRejectsOverlayAtBase },
  { name: 'dependency guard', run: assertRomaIsOnly124CCaller },
];

async function main() {
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

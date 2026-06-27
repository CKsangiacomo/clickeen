import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRuntimePackageFingerprint,
  materializeRuntimePackage,
  RUNTIME_MATERIALIZER_CONTRACT_VERSION,
} from '../src';
import {
  baseExpectedPackage,
} from './fixtures/base-expected';
import { baseMaterializerInput, baseState } from './fixtures/base-input';
import { frMaterializerInput } from './fixtures/locale-overlay-input';
import type { RuntimeMaterializerInput } from '../src';

const repoRoot = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const srcRoot = path.join(packageRoot, 'src');

function cloneInput(input: RuntimeMaterializerInput): RuntimeMaterializerInput {
  return structuredClone(input);
}

function assertSuccess<T extends { ok: boolean }>(result: T): asserts result is T & { ok: true } {
  assert.equal(result.ok, true, JSON.stringify(result));
}

function assertFailure<T extends { ok: boolean; error?: { reason?: string } }>(
  result: T,
  reason: string,
): void {
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.error?.reason, reason);
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(fullPath)));
      continue;
    }
    if (entry.isFile()) out.push(fullPath);
  }
  return out;
}

async function assertForbiddenImports(): Promise<void> {
  const forbidden = [
    'roma/',
    'bob/',
    'tokyo-worker',
    'sanfrancisco',
    'agents/',
    'next/',
    'react',
    'wrangler',
    '@cloudflare',
    '@supabase',
    'process.env',
    'node:crypto',
  ];
  const srcFiles = (await listFiles(srcRoot)).filter((file) => file.endsWith('.ts'));
  for (const file of srcFiles) {
    const content = await readFile(file, 'utf8');
    for (const needle of forbidden) {
      assert.equal(
        content.includes(needle),
        false,
        `Forbidden materializer dependency ${needle} found in ${path.relative(repoRoot, file)}`,
      );
    }
  }
}

async function materializeBase() {
  const result = await materializeRuntimePackage(cloneInput(baseMaterializerInput));
  assertSuccess(result);
  return result;
}

async function materializeFr() {
  const result = await materializeRuntimePackage(cloneInput(frMaterializerInput));
  assertSuccess(result);
  return result;
}

async function testBasePackageMatchesLegacyFixture(): Promise<void> {
  const result = await materializeBase();
  assert.equal(result.files.indexHtml, baseExpectedPackage.indexHtml);
  assert.equal(result.files.stylesCss, baseExpectedPackage.stylesCss);
  assert.equal(result.files.runtimeJs, baseExpectedPackage.runtimeJs);
}

async function testStylesheetReferencesAreConsolidated(): Promise<void> {
  const result = await materializeBase();
  assert.match(result.files.indexHtml, /<link rel="stylesheet" href="\/CLICKEEN\/inst_contract\/styles\.css" \/>/);
  assert.match(result.files.indexHtml, /<script src="\/CLICKEEN\/inst_contract\/runtime\.js" defer><\/script>/);
  assert.doesNotMatch(result.files.indexHtml, /\.\/styles\.css|\.\/runtime\.js/);
  assert.doesNotMatch(result.files.indexHtml, /\/dieter\/tokens\/tokens\.css/);
  assert.doesNotMatch(result.files.indexHtml, /\.\/widget\.css/);
  assert.match(result.files.stylesCss, /@import "\/dieter\/tokens\/tokens\.css";/);
  assert.match(result.files.stylesCss, /\.contract-widget \{ color: var\(--ck-color-text\); \}/);
}

async function testLocaleSupportFilePathsUseLocaleCoordinate(): Promise<void> {
  const result = await materializeFr();
  assert.match(result.files.indexHtml, /<link rel="stylesheet" href="\/CLICKEEN\/inst_contract\/locales\/fr\/styles\.css" \/>/);
  assert.match(result.files.indexHtml, /<script src="\/CLICKEEN\/inst_contract\/locales\/fr\/runtime\.js" defer><\/script>/);
  assert.doesNotMatch(result.files.indexHtml, /\.\/styles\.css|\.\/runtime\.js/);
}

async function testBaseEvidenceFingerprintIsDeterministic(): Promise<void> {
  const first = await materializeBase();
  const second = await materializeBase();
  assert.equal(first.evidence.generatedPackageFingerprint, second.evidence.generatedPackageFingerprint);
  assert.equal(
    first.evidence.generatedPackageFingerprint,
    await buildRuntimePackageFingerprint(first.files),
  );
}

async function testBaseEvidenceIsComplete(): Promise<void> {
  const result = await materializeBase();
  assert.equal(result.evidence.schemaWidgetContractFingerprint, baseMaterializerInput.evidence.schemaWidgetContractFingerprint);
  assert.equal(result.evidence.sourceFingerprint, baseMaterializerInput.evidence.sourceFingerprint);
  assert.equal(result.evidence.sourceReference, baseMaterializerInput.evidence.sourceReference);
  assert.deepEqual(result.evidence.localeCoordinate, baseMaterializerInput.artifactCoordinate);
  assert.equal(result.evidence.overlayFingerprint, null);
  assert.equal(result.evidence.materializerContractVersion, RUNTIME_MATERIALIZER_CONTRACT_VERSION);
  assert.equal(result.evidence.generatedPackageFingerprint, await buildRuntimePackageFingerprint(result.files));
  assert.deepEqual(result.evidence.supportFileFingerprints, []);
}

async function testRuntimeBytesUseArtifactCoordinate(): Promise<void> {
  const input = cloneInput(baseMaterializerInput);
  input.artifactCoordinate = {
    kind: 'account-instance-widget',
    accountPublicId: 'CLICKEEN',
    instanceId: 'inst_coordinate_only',
    baseLocale: 'it',
    requestedLocale: 'it',
  };
  const result = await materializeRuntimePackage(input);
  assertSuccess(result);
  assert.match(result.files.indexHtml, /<html lang="it">/);
  assert.match(result.files.indexHtml, /data-ck-instance-id="inst_coordinate_only"/);
  assert.match(result.files.runtimeJs, /"instanceId":"inst_coordinate_only"/);
  assert.match(result.files.runtimeJs, /"baseLocale":"it"/);
  assert.match(result.files.runtimeJs, /"languages":\["it"\]/);
  assert.deepEqual(result.evidence.localeCoordinate, input.artifactCoordinate);
}

async function testInvalidArtifactCoordinateFails(): Promise<void> {
  for (const key of ['accountPublicId', 'instanceId', 'baseLocale', 'requestedLocale'] as const) {
    const input = cloneInput(baseMaterializerInput);
    input.artifactCoordinate[key] = '';
    assertFailure(await materializeRuntimePackage(input), 'locale_coordinate_invalid');
  }
}

async function testBaseWithOverlayFails(): Promise<void> {
  const baseWithOverlay = cloneInput(baseMaterializerInput);
  baseWithOverlay.localeOverlay = frMaterializerInput.localeOverlay;
  assertFailure(await materializeRuntimePackage(baseWithOverlay), 'locale_overlay_unexpected_for_base');
}

async function testNonBaseWithoutOverlayFails(): Promise<void> {
  const localeWithoutOverlay = cloneInput(frMaterializerInput);
  delete localeWithoutOverlay.localeOverlay;
  assertFailure(await materializeRuntimePackage(localeWithoutOverlay), 'locale_overlay_missing');
}

async function testNonBaseOverlayLocaleMismatchFails(): Promise<void> {
  const localeMismatch = cloneInput(frMaterializerInput);
  localeMismatch.localeOverlay!.locale = 'de';
  assertFailure(await materializeRuntimePackage(localeMismatch), 'locale_overlay_locale_mismatch');
}

async function testNonBaseMissingEditableFieldsFails(): Promise<void> {
  const input = cloneInput(frMaterializerInput);
  delete input.compiled.editableFields;
  assertFailure(await materializeRuntimePackage(input), 'compiled_widget_invalid');
}

async function testNonBaseScalarOverlaySucceeds(): Promise<void> {
  const result = await materializeFr();
  assert.match(result.files.runtimeJs, /var selectedLocale = "fr";/);
  assert.match(result.files.runtimeJs, /"languages":\["en","fr"\]/);
  assert.match(result.files.runtimeJs, /Clickeen aide les equipes a lancer vite\./);
  assert.match(result.files.runtimeJs, /Widgets natifs IA/);
}

async function testNonBaseEvidenceIsComplete(): Promise<void> {
  const result = await materializeFr();
  assert.equal(result.evidence.schemaWidgetContractFingerprint, frMaterializerInput.evidence.schemaWidgetContractFingerprint);
  assert.equal(result.evidence.sourceFingerprint, frMaterializerInput.evidence.sourceFingerprint);
  assert.equal(result.evidence.sourceReference, frMaterializerInput.evidence.sourceReference);
  assert.deepEqual(result.evidence.localeCoordinate, frMaterializerInput.artifactCoordinate);
  assert.equal(result.evidence.overlayFingerprint, 'overlay:fingerprint');
  assert.equal(result.evidence.materializerContractVersion, RUNTIME_MATERIALIZER_CONTRACT_VERSION);
  assert.equal(result.evidence.generatedPackageFingerprint, await buildRuntimePackageFingerprint(result.files));
  assert.deepEqual(result.evidence.supportFileFingerprints, []);
}

async function testMissingOverlayKeyFails(): Promise<void> {
  const missing = cloneInput(frMaterializerInput);
  delete missing.localeOverlay!.values.headline;
  assertFailure(await materializeRuntimePackage(missing), 'locale_overlay_key_missing');
}

async function testUnexpectedOverlayKeyFails(): Promise<void> {
  const unexpected = cloneInput(frMaterializerInput);
  unexpected.localeOverlay!.values.extra = 'Extra';
  assertFailure(await materializeRuntimePackage(unexpected), 'locale_overlay_key_unexpected');
}

async function testInvalidOverlayValueFails(): Promise<void> {
  const invalidValue = cloneInput(frMaterializerInput);
  invalidValue.localeOverlay!.values.headline = 7;
  assertFailure(await materializeRuntimePackage(invalidValue), 'locale_overlay_value_invalid');
}

async function testRepeatedOverlayScope(): Promise<void> {
  const before = JSON.stringify(baseState);
  const result = await materializeFr();
  assert.match(result.files.runtimeJs, /Premiere reponse/);
  assert.match(result.files.runtimeJs, /Deuxieme reponse/);
  assert.match(result.files.runtimeJs, /Clickeen helps teams launch fast\./);
  assert.equal(JSON.stringify(baseState), before);
  assert.doesNotMatch(result.files.runtimeJs, /identityKey|reorder-safe|reorder safe/);
}

async function testMissingWidgetHtmlFails(): Promise<void> {
  const input = cloneInput(baseMaterializerInput);
  delete input.compiled.widgetPackage.files['widget.html'];
  assertFailure(await materializeRuntimePackage(input), 'widget_package_missing');
}

async function testMissingReferencedCssOrJsFails(): Promise<void> {
  const missingCss = cloneInput(baseMaterializerInput);
  delete missingCss.compiled.widgetPackage.files['product/widgets/contract-widget/widget.css'];
  assertFailure(await materializeRuntimePackage(missingCss), 'widget_package_file_missing');

  const missingJs = cloneInput(baseMaterializerInput);
  delete missingJs.compiled.widgetPackage.files['product/widgets/contract-widget/widget.client.js'];
  assertFailure(await materializeRuntimePackage(missingJs), 'widget_package_file_missing');
}

async function testInvalidRootFails(): Promise<void> {
  const zeroRoots = cloneInput(baseMaterializerInput);
  zeroRoots.compiled.widgetPackage.files['widget.html']!.source = '<body><section></section></body>';
  assertFailure(await materializeRuntimePackage(zeroRoots), 'widget_package_root_invalid');

  const multipleRoots = cloneInput(baseMaterializerInput);
  multipleRoots.compiled.widgetPackage.files['widget.html']!.source =
    '<body><section data-ck-widget="contract-widget" data-role="root"></section><section data-ck-widget="contract-widget" data-role="root"></section></body>';
  assertFailure(await materializeRuntimePackage(multipleRoots), 'widget_package_root_invalid');

  const wrongWidget = cloneInput(baseMaterializerInput);
  wrongWidget.compiled.widgetPackage.files['widget.html']!.source =
    '<body><section data-ck-widget="other-widget" data-role="root"></section></body>';
  assertFailure(await materializeRuntimePackage(wrongWidget), 'widget_package_root_invalid');
}

async function testFingerprintContract(): Promise<void> {
  const files = {
    indexHtml: baseExpectedPackage.indexHtml,
    stylesCss: baseExpectedPackage.stylesCss,
    runtimeJs: baseExpectedPackage.runtimeJs,
    dependencies: { instanceIds: [] },
  };
  const first = await buildRuntimePackageFingerprint(files);
  const second = await buildRuntimePackageFingerprint(structuredClone(files));
  assert.equal(first, second);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(
    first,
    await buildRuntimePackageFingerprint({ ...files, runtimeJs: `${files.runtimeJs}\n` }),
  );
}

const testCases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'base package matches legacy fixture', run: testBasePackageMatchesLegacyFixture },
  { name: 'stylesheet references are consolidated into package CSS', run: testStylesheetReferencesAreConsolidated },
  { name: 'locale support file paths use locale coordinate', run: testLocaleSupportFilePathsUseLocaleCoordinate },
  { name: 'base evidence fingerprint is deterministic', run: testBaseEvidenceFingerprintIsDeterministic },
  { name: 'base evidence is complete', run: testBaseEvidenceIsComplete },
  { name: 'runtime bytes use artifact coordinate', run: testRuntimeBytesUseArtifactCoordinate },
  { name: 'invalid artifact coordinate fails', run: testInvalidArtifactCoordinateFails },
  { name: 'base with overlay fails', run: testBaseWithOverlayFails },
  { name: 'non-base without overlay fails', run: testNonBaseWithoutOverlayFails },
  { name: 'non-base overlay locale mismatch fails', run: testNonBaseOverlayLocaleMismatchFails },
  { name: 'non-base missing editable fields fails', run: testNonBaseMissingEditableFieldsFails },
  { name: 'non-base scalar overlay succeeds', run: testNonBaseScalarOverlaySucceeds },
  { name: 'non-base evidence is complete', run: testNonBaseEvidenceIsComplete },
  { name: 'missing overlay key fails', run: testMissingOverlayKeyFails },
  { name: 'unexpected overlay key fails', run: testUnexpectedOverlayKeyFails },
  { name: 'invalid overlay value fails', run: testInvalidOverlayValueFails },
  { name: 'repeated overlay scope', run: testRepeatedOverlayScope },
  { name: 'missing widget html fails', run: testMissingWidgetHtmlFails },
  { name: 'missing referenced CSS or JS fails', run: testMissingReferencedCssOrJsFails },
  { name: 'invalid root fails', run: testInvalidRootFails },
  { name: 'forbidden imports guard', run: assertForbiddenImports },
  { name: 'fingerprint contract stays deterministic', run: testFingerprintContract },
];

for (const testCase of testCases) {
  try {
    await testCase.run();
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    console.error(`FAIL ${testCase.name}`);
    throw error;
  }
}

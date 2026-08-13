import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  buildRuntimePackageFingerprint,
  materializeRuntimePackage,
  RUNTIME_MATERIALIZER_CONTRACT_VERSION,
} from '../src';
import { baseMaterializerInput } from './fixtures/base-input';
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
    if (entry.isDirectory()) out.push(...(await listFiles(fullPath)));
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
        `${needle} found in ${path.relative(repoRoot, file)}`,
      );
    }
  }
}

async function materializeBase() {
  const result = await materializeRuntimePackage(cloneInput(baseMaterializerInput));
  assertSuccess(result);
  return result;
}

async function testPackageWithOneShellContract(): Promise<void> {
  const result = await materializeBase();
  assert.match(result.files.indexHtml, /window\.CK_LOCALE_CONTEXT = null;/);
  assert.match(result.files.indexHtml, /href="\/CLICKEEN\/inst_contract\/styles\.css"/);
  assert.match(result.files.indexHtml, /src="\/CLICKEEN\/inst_contract\/runtime\.js"/);
  assert.doesNotMatch(result.files.indexHtml, /\/locales\//);
  assert.doesNotMatch(result.files.runtimeJs, /fetch\(|\/locales\/|requestedLocale|localeOverlay/);
  assert.match(result.files.runtimeJs, /applyExactOverlay/);
}

async function testEvidenceContract(): Promise<void> {
  const first = await materializeBase();
  const second = await materializeBase();
  assert.equal(
    first.evidence.generatedPackageFingerprint,
    second.evidence.generatedPackageFingerprint,
  );
  assert.equal(
    first.evidence.generatedPackageFingerprint,
    await buildRuntimePackageFingerprint(first.files),
  );
  assert.deepEqual(first.evidence.artifactCoordinate, baseMaterializerInput.artifactCoordinate);
  assert.equal(first.evidence.materializerContractVersion, RUNTIME_MATERIALIZER_CONTRACT_VERSION);
  assert.deepEqual(first.evidence.supportFileFingerprints, []);
}

async function testRuntimeAppliesInjectedOverlayBeforeModules(): Promise<void> {
  const result = await materializeBase();
  const context: Record<string, unknown> = {
    CK_LOCALE_CONTEXT: {
      locale: 'fr',
      baseLocale: 'en',
      values: {
        headline: 'Texte français',
        'nested.eyebrow': 'Widgets IA',
        'items.0.title': 'Première réponse',
        'items.1.title': 'Deuxième réponse',
      },
      languages: ['en', 'fr'],
    },
  };
  context.window = context;
  context.document = { documentElement: { lang: 'en' } };
  vm.runInNewContext(result.files.runtimeJs, context);
  const widget = (context.CK_WIDGETS as Record<string, any>).inst_contract;
  assert.equal(widget.locale, 'fr');
  assert.equal(widget.state.headline, 'Texte français');
  assert.equal(widget.state.items[1].title, 'Deuxième réponse');
  assert.equal((context.document as any).documentElement.lang, 'fr');
  assert.equal(context.__contractWidgetLoaded, true);
}

async function testRuntimeRejectsInvalidOverlayWithoutStartingModules(): Promise<void> {
  const result = await materializeBase();
  const context: Record<string, unknown> = {
    CK_LOCALE_CONTEXT: {
      locale: 'fr',
      baseLocale: 'en',
      values: { missing: 'Invented' },
      languages: ['en', 'fr'],
    },
  };
  context.window = context;
  context.document = { documentElement: { lang: 'en' } };
  assert.throws(() => vm.runInNewContext(result.files.runtimeJs, context), /target is not text/);
  assert.equal(context.__contractWidgetLoaded, undefined);
}

async function testInvalidInputsFail(): Promise<void> {
  for (const key of ['accountPublicId', 'instanceId', 'baseLocale'] as const) {
    const input = cloneInput(baseMaterializerInput);
    input.artifactCoordinate[key] = '';
    assertFailure(await materializeRuntimePackage(input), 'artifact_coordinate_invalid');
  }
  const missingHtml = cloneInput(baseMaterializerInput);
  delete missingHtml.compiled.widgetPackage.files['widget.html'];
  assertFailure(await materializeRuntimePackage(missingHtml), 'widget_package_missing');
  const wrongShell = cloneInput(baseMaterializerInput);
  wrongShell.compiled.widgetPackage.files['widget.html']!.source =
    '<body><section class="ck-headerLayout" data-ck-widget="wrong"></section></body>';
  assertFailure(await materializeRuntimePackage(wrongShell), 'widget_package_shell_invalid');

  const missingShellClass = cloneInput(baseMaterializerInput);
  missingShellClass.compiled.widgetPackage.files['widget.html']!.source =
    '<body><section data-ck-widget="contract-widget"></section></body>';
  assertFailure(await materializeRuntimePackage(missingShellClass), 'widget_package_shell_invalid');
}

async function testSharedShadowRenderingContract(): Promise<void> {
  const appearanceSource = await readFile(
    path.join(repoRoot, 'tokyo/product/widgets/shared/appearance.js'),
    'utf8',
  );
  const context: Record<string, unknown> = {};
  context.window = context;
  vm.runInNewContext(appearanceSource, context);
  const appearance = context.CKAppearance as {
    insideShadowToBoxShadowList: (value: unknown, path: string) => string;
    resolveOutsideShadowGutters: (value: unknown, path: string) => {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    shadowToBoxShadow: (value: unknown, inset: boolean, path: string) => string;
  };
  const outside = {
    enabled: true,
    inset: false,
    x: -6,
    y: 8,
    blur: 20,
    spread: -4,
    color: '#123456',
    alpha: 35,
  };
  assert.equal(
    appearance.shadowToBoxShadow(outside, false, 'stage.shadow'),
    '-6px 8px 20px -4px color-mix(in oklab, #123456, transparent 65%)',
    'outside shadow preserves the exact signed geometry and color',
  );
  assert.deepEqual(
    { ...appearance.resolveOutsideShadowGutters(outside, 'stage.shadow') },
    { top: 18, right: 20, bottom: 34, left: 32 },
    'Stage gutter includes the browser blur painting extent around the exact outside shadow',
  );

  const inside = (overrides: Record<string, unknown>) => ({
    enabled: true,
    inset: true,
    x: 0,
    y: 0,
    blur: 16,
    spread: -12,
    color: '#000000',
    alpha: 12,
    ...overrides,
  });
  const group = {
    linked: false,
    layer: 'above-content',
    all: inside({ blur: 24, spread: 0 }),
    top: inside({ y: 12 }),
    right: inside({ x: -12 }),
    bottom: inside({ y: -12 }),
    left: inside({ x: 12 }),
  };
  const rendered = appearance.insideShadowToBoxShadowList(group, 'stage.insideShadow');
  assert.equal(rendered.split(', inset ').length, 4, 'unlinked inside shadow renders four real inset shadows');
  assert.match(rendered, /inset 0px 12px 16px -12px/, 'top signed geometry is preserved');
  assert.match(rendered, /inset -12px 0px 16px -12px/, 'right signed geometry is preserved');
  assert.match(rendered, /inset 0px -12px 16px -12px/, 'bottom signed geometry is preserved');
  assert.match(rendered, /inset 12px 0px 16px -12px/, 'left signed geometry is preserved');
  assert.doesNotMatch(rendered, /linear-gradient/, 'inside shadows are not gradient approximations');
  assert.throws(
    () => appearance.shadowToBoxShadow({ ...outside, inset: true }, false, 'stage.shadow'),
    /stage\.shadow\.inset must be false/,
    'outside context rejects an inset shadow instead of rewriting it',
  );
}

const testCases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'package with one Shell contract', run: testPackageWithOneShellContract },
  { name: 'evidence contract', run: testEvidenceContract },
  {
    name: 'runtime applies injected overlay before modules',
    run: testRuntimeAppliesInjectedOverlayBeforeModules,
  },
  {
    name: 'runtime rejects invalid overlay before modules',
    run: testRuntimeRejectsInvalidOverlayWithoutStartingModules,
  },
  { name: 'invalid inputs fail', run: testInvalidInputsFail },
  { name: 'shared shadow rendering contract', run: testSharedShadowRenderingContract },
  { name: 'forbidden imports guard', run: assertForbiddenImports },
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

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeRuntimePackage } from '../src';
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
  assert.match(result.files.indexHtml, /href="\/CLICKEEN\/inst_contract\/styles\.css"/);
  assert.match(result.files.indexHtml, /src="\/CLICKEEN\/inst_contract\/runtime\.js"/);
  assert.doesNotMatch(result.files.indexHtml, /\/locales\//);
  assert.doesNotMatch(
    result.files.runtimeJs,
    /CK_WIDGETS|baseState|applyExactOverlay|localeOverlay|requestedLocale/,
  );
  assert.match(result.files.runtimeJs, /__contractWidgetLoaded/);
}

function contentMarker(identityKey: string): string {
  return `data-ck-content-path="${identityKey.replaceAll('=', '&#x3D;')}"`;
}

async function testStableContentCoordinates(): Promise<void> {
  const input = cloneInput(baseMaterializerInput);
  input.compiled.widgetSoftware.widgetHtml = `<body>
<section data-ck-widget="contract-widget">
  <h1 data-ck-content-path="{{$ck.headline.path}}">{{headline}}</h1>
  <span data-ck-content-path="{{nested.$ck.eyebrow.path}}" data-ck-content-mode="text" data-ck-content-attribute="title" title="{{nested.eyebrow}}"></span>
  {{> core}}
</section>
</body>`;
  input.compiled.widgetSoftware.coreHtml = `<ul>
{{#items}}
  <li data-ck-content-path="{{$ck.title.path}}">{{title}}</li>
{{/items}}
</ul>`;

  const firstKey = 'contract-widget|item-title|items[].title|items[].id=first';
  const secondKey = 'contract-widget|item-title|items[].title|items[].id=second';
  const thirdKey = 'contract-widget|item-title|items[].title|items[].id=third';
  const initial = await materializeRuntimePackage(input);
  assertSuccess(initial);
  assert.ok(initial.files.indexHtml.includes(contentMarker('contract-widget|headline|headline')));
  assert.ok(initial.files.indexHtml.includes(contentMarker('contract-widget|eyebrow|nested.eyebrow')));
  assert.match(
    initial.files.indexHtml,
    /data-ck-content-attribute="title" title="AI-native widgets"/,
  );
  assert.ok(initial.files.indexHtml.includes(contentMarker(firstKey)));
  assert.ok(initial.files.indexHtml.includes(contentMarker(secondKey)));

  const reordered = cloneInput(input);
  const reorderedItems = reordered.state.items as Array<{ id: string; title: string }>;
  reordered.state.items = [reorderedItems[1]!, reorderedItems[0]!];
  const reorderedResult = await materializeRuntimePackage(reordered);
  assertSuccess(reorderedResult);
  assert.ok(
    reorderedResult.files.indexHtml.indexOf(contentMarker(secondKey)) <
      reorderedResult.files.indexHtml.indexOf(contentMarker(firstKey)),
  );

  const added = cloneInput(reordered);
  (added.state.items as Array<{ id: string; title: string }>).push({
    id: 'third',
    title: 'Third answer',
  });
  const addedResult = await materializeRuntimePackage(added);
  assertSuccess(addedResult);
  assert.ok(addedResult.files.indexHtml.includes(contentMarker(thirdKey)));

  const deleted = cloneInput(added);
  deleted.state.items = (deleted.state.items as Array<{ id: string; title: string }>).filter(
    (item) => item.id !== 'first',
  );
  const deletedResult = await materializeRuntimePackage(deleted);
  assertSuccess(deletedResult);
  assert.equal(deletedResult.files.indexHtml.includes(contentMarker(firstKey)), false);
}

async function testRepeatedItemStyleCoordinates(): Promise<void> {
  const input = cloneInput(baseMaterializerInput);
  const items = input.state.items as Array<Record<string, unknown>>;
  items[0]!.style = { background: { type: 'color', color: '#112233' } };
  items[1]!.style = { background: { type: 'color', color: '#445566' } };
  input.compiled.widgetSoftware.styles = [
    {
      path: './core/core.css',
      source: `{{#items}}
.item-{{id}} {
  background: {{#ck.css.background}}{{$ck.path}}.style.background{{/ck.css.background}};
}
{{/items}}`,
    },
  ];

  const initial = await materializeRuntimePackage(input);
  assertSuccess(initial);
  assert.match(initial.files.stylesCss, /\.item-first\s*\{\s*background: #112233;/);
  assert.match(initial.files.stylesCss, /\.item-second\s*\{\s*background: #445566;/);

  input.state.items = [items[1]!, items[0]!];
  const reordered = await materializeRuntimePackage(input);
  assertSuccess(reordered);
  assert.match(reordered.files.stylesCss, /\.item-first\s*\{\s*background: #112233;/);
  assert.match(reordered.files.stylesCss, /\.item-second\s*\{\s*background: #445566;/);
}

const testCases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'package with one Shell contract', run: testPackageWithOneShellContract },
  { name: 'stable content coordinates', run: testStableContentCoordinates },
  { name: 'repeated item style coordinates', run: testRepeatedItemStyleCoordinates },
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

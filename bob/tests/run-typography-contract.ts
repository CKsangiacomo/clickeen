import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDefaultAccountFontLibrary,
  normalizeAccountFontLibrary,
  type AccountFontLibrary,
} from '@clickeen/widget-foundation';
import { compileWidgetServer } from '../lib/compiler.server';
import type { RawWidget } from '../lib/compiler.shared';
import type {
  ComponentStencil,
  ComponentStencilLoader,
} from '../lib/compiler/stencils';
import type { CompiledWidget } from '../lib/types';
import {
  bindSessionTypographyControls,
} from '../lib/session/sessionConfig';
import { expandTypographyFamilyOps } from '../lib/edit/typography-family-ops';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRequire = createRequire(import.meta.url);
runtimeRequire.extensions['.css'] = () => undefined;
const widgetsRoot = path.join(repoRoot, 'tokyo/product/widgets');
const widgetTypes = fs
  .readdirSync(widgetsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
  .map((entry) => entry.name)
  .filter((widgetType) => fs.existsSync(path.join(widgetsRoot, widgetType, 'spec.json')))
  .sort();

const loadStencil: ComponentStencilLoader = async (type): Promise<ComponentStencil> => {
  const root = path.join(repoRoot, 'dieter/components', type);
  const specPath = path.join(root, `${type}.spec.json`);
  return {
    stencil: fs.readFileSync(path.join(root, `${type}.html`), 'utf8'),
    spec: JSON.parse(fs.readFileSync(specPath, 'utf8')) as ComponentStencil['spec'],
  };
};

function readSpec(widgetType: string): RawWidget {
  return JSON.parse(
    fs.readFileSync(
      path.join(widgetsRoot, widgetType, 'spec.json'),
      'utf8',
    ),
  ) as RawWidget;
}

function compile(spec: RawWidget) {
  const widgetType = String(spec.widgetname || '').trim();
  const widgetRoot = path.join(widgetsRoot, widgetType);
  const tooldrawerLabels = JSON.parse(
    fs.readFileSync(path.join(widgetRoot, 'labels', 'en.json'), 'utf8'),
  ) as unknown;
  return compileWidgetServer(spec, {
    loadComponentStencil: loadStencil,
    tokyoBaseUrl: '',
    tooldrawerLabels,
  });
}

function fontLibraryWithAccountFont(): AccountFontLibrary {
  const library = createDefaultAccountFontLibrary();
  library.fonts['Custom Display'] = {
    label: 'Custom Display',
    source: 'account-asset',
    category: 'display',
    familyClass: 'sans',
    usage: 'heading-only',
    weights: ['400'],
    styles: ['normal'],
    assetRef: 'CustomDisplay.woff2',
    contentType: 'font/woff2',
  };
  return library;
}

function testGlobalTokyoFontDefaults(): void {
  const library = createDefaultAccountFontLibrary();
  const expected = {
    Frari: '/fonts/special/Frari.woff2',
    Giudecca: '/fonts/special/Giudecca.woff',
    Marin: '/fonts/special/Marin.woff',
    Orio: '/fonts/special/Orio.woff',
    Pachuka: '/fonts/special/Pachuka.woff2',
    'Pachuka Line': '/fonts/special/Pachuka_line.woff2',
    Rialto: '/fonts/special/Rialto.woff2',
  } as const;
  for (const [family, filePath] of Object.entries(expected)) {
    const record = library.fonts[family];
    assert.equal(record?.source, 'tokyo', family);
    if (record?.source !== 'tokyo') continue;
    assert.equal(record.filePath, filePath, family);
    assert.deepEqual(record.weights, ['400'], family);
    assert.deepEqual(record.styles, ['normal'], family);
  }
  assert.ok(normalizeAccountFontLibrary(library));

  const missingGlobal = structuredClone(library);
  delete missingGlobal.fonts.Orio;
  assert.equal(normalizeAccountFontLibrary(missingGlobal), null);

  const replacedGlobal = structuredClone(library);
  replacedGlobal.fonts.Orio = {
    label: 'Orio',
    source: 'account-asset',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
    weights: ['400'],
    styles: ['normal'],
    assetRef: 'Orio.woff',
    contentType: 'font/woff',
  };
  assert.equal(normalizeAccountFontLibrary(replacedGlobal), null);

  const fakeGlobal = structuredClone(library);
  fakeGlobal.fonts.Fake = {
    label: 'Fake',
    source: 'tokyo',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
    weights: ['400'],
    styles: ['normal'],
    filePath: '/fonts/special/does-not-exist.woff',
  };
  assert.equal(normalizeAccountFontLibrary(fakeGlobal), null);

  const unknownGlobalField = structuredClone(library) as unknown as {
    fonts: Record<string, Record<string, unknown>>;
  };
  unknownGlobalField.fonts.Orio!.unexpected = true;
  assert.equal(normalizeAccountFontLibrary(unknownGlobalField), null);

  const paddedGlobalSource = structuredClone(library) as unknown as {
    fonts: Record<string, Record<string, unknown>>;
  };
  paddedGlobalSource.fonts.Orio!.source = ' tokyo ';
  assert.equal(normalizeAccountFontLibrary(paddedGlobalSource), null);

  const paddedGlobalPath = structuredClone(library) as unknown as {
    fonts: Record<string, Record<string, unknown>>;
  };
  paddedGlobalPath.fonts.Orio!.filePath = ' /fonts/special/Orio.woff ';
  assert.equal(normalizeAccountFontLibrary(paddedGlobalPath), null);

  const duplicateGlobalWeight = structuredClone(library) as unknown as {
    fonts: Record<string, Record<string, unknown>>;
  };
  duplicateGlobalWeight.fonts.Orio!.weights = ['400', '400'];
  assert.equal(normalizeAccountFontLibrary(duplicateGlobalWeight), null);
}

async function testEveryWidgetRoleIsEditable(): Promise<void> {
  for (const widgetType of widgetTypes) {
    const compiled = await compile(readSpec(widgetType));
    const roles = Object.keys(
      ((compiled.defaults.typography as Record<string, unknown>).roles ??
        {}) as Record<string, unknown>,
    );
    const familyControls = compiled.controls.filter((control) =>
      /^typography\.roles\.[^.]+\.family$/.test(control.path),
    );
    assert.deepEqual(
      familyControls.map((control) => control.path.split('.')[2]).sort(),
      roles.sort(),
      `${widgetType} exposes every composed typography role`,
    );
    familyControls.forEach((control) => {
      assert.ok(control.groupLabel?.trim(), `${widgetType}:${control.path} has a label`);
      assert.equal(control.kind, 'string');
      assert.equal(control.options, undefined);
    });
  }
}

async function testAccountFontBindingAndChange(): Promise<void> {
  const library = fontLibraryWithAccountFont();
  const raw = await compile(readSpec('faq'));
  const compiled = bindSessionTypographyControls(
    raw as unknown as CompiledWidget,
    library,
  );
  const family = compiled.controls.find(
    (control) => control.path === 'typography.roles.title.family',
  );
  assert.equal(family?.enumValues?.includes('Custom Display'), true);

  const expanded = expandTypographyFamilyOps({
    instanceData: structuredClone(raw.defaults),
    fontLibrary: library,
    ops: [{ op: 'set', path: 'typography.roles.title.family', value: 'Custom Display' }],
  });
  assert.deepEqual(expanded, [
    { op: 'set', path: 'typography.roles.title.family', value: 'Custom Display' },
    { op: 'set', path: 'typography.roles.title.weight', value: '400' },
    { op: 'set', path: 'typography.roles.title.fontStyle', value: 'normal' },
  ]);
  assert.equal(
    expandTypographyFamilyOps({
      instanceData: structuredClone(raw.defaults),
      fontLibrary: library,
      ops: [
        { op: 'set', path: 'typography.roles.title.family', value: 'Custom Display' },
        { op: 'set', path: 'typography.roles.title.weight', value: '700' },
      ],
    }),
    null,
  );
  assert.equal(
    expandTypographyFamilyOps({
      instanceData: structuredClone(raw.defaults),
      fontLibrary: null,
      ops: [{ op: 'set', path: 'typography.roles.title.family', value: 'Custom Display' }],
    }),
    null,
  );
}

async function main(): Promise<void> {
  testGlobalTokyoFontDefaults();
  console.log('PASS global Tokyo fonts are in every default library');
  await testEveryWidgetRoleIsEditable();
  console.log('PASS every widget typography role is editable and labeled');
  await testAccountFontBindingAndChange();
  console.log('PASS account font binding and family change');
}

void main();

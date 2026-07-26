import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDefaultAccountFontLibrary,
  type AccountFontLibrary,
} from '@clickeen/widget-shell';
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
const widgetTypes = [
  'big-bang',
  'calltoaction',
  'cards',
  'countdown',
  'faq',
  'logoshowcase',
  'split-carousel-media',
  'split-media',
] as const;

const loadStencil: ComponentStencilLoader = async (type): Promise<ComponentStencil> => {
  const root = path.join(repoRoot, 'dieter/components', type);
  const specPath = path.join(root, `${type}.spec.json`);
  return {
    stencil: fs.readFileSync(path.join(root, `${type}.html`), 'utf8'),
    ...(fs.existsSync(specPath)
      ? { spec: JSON.parse(fs.readFileSync(specPath, 'utf8')) as ComponentStencil['spec'] }
      : {}),
  };
};

function readSpec(widgetType: string): RawWidget {
  return JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'tokyo/product/widgets', widgetType, 'spec.json'),
      'utf8',
    ),
  ) as RawWidget;
}

function compile(spec: RawWidget) {
  return compileWidgetServer(spec, { loadComponentStencil: loadStencil, tokyoBaseUrl: '' });
}

function fontLibraryWithOrio(): AccountFontLibrary {
  const library = createDefaultAccountFontLibrary();
  library.fonts.Orio = {
    label: 'Orio',
    source: 'account-asset',
    category: 'display',
    familyClass: 'sans',
    usage: 'heading-only',
    weights: ['400'],
    styles: ['normal'],
    assetRef: 'Orio.woff2',
    contentType: 'font/woff2',
  };
  return library;
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
  const library = fontLibraryWithOrio();
  const raw = await compile(readSpec('faq'));
  const compiled = bindSessionTypographyControls(
    raw as unknown as CompiledWidget,
    library,
  );
  const family = compiled.controls.find(
    (control) => control.path === 'typography.roles.title.family',
  );
  assert.equal(family?.enumValues?.includes('Orio'), true);

  const expanded = expandTypographyFamilyOps({
    instanceData: structuredClone(raw.defaults),
    fontLibrary: library,
    ops: [{ op: 'set', path: 'typography.roles.title.family', value: 'Orio' }],
  });
  assert.deepEqual(expanded, [
    { op: 'set', path: 'typography.roles.title.family', value: 'Orio' },
    { op: 'set', path: 'typography.roles.title.weight', value: '400' },
    { op: 'set', path: 'typography.roles.title.fontStyle', value: 'normal' },
  ]);
  assert.equal(
    expandTypographyFamilyOps({
      instanceData: structuredClone(raw.defaults),
      fontLibrary: library,
      ops: [
        { op: 'set', path: 'typography.roles.title.family', value: 'Orio' },
        { op: 'set', path: 'typography.roles.title.weight', value: '700' },
      ],
    }),
    null,
  );
  assert.equal(
    expandTypographyFamilyOps({
      instanceData: structuredClone(raw.defaults),
      fontLibrary: null,
      ops: [{ op: 'set', path: 'typography.roles.title.family', value: 'Orio' }],
    }),
    null,
  );
}

async function main(): Promise<void> {
  await testEveryWidgetRoleIsEditable();
  console.log('PASS every widget typography role is editable and labeled');
  await testAccountFontBindingAndChange();
  console.log('PASS account font binding and family change');
}

void main();

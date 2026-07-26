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
  assertAccountTypographySelections,
  bindSessionTypographyControls,
} from '../lib/session/sessionConfig';
import {
  expandTypographyFamilyOps,
  TYPOGRAPHY_SELECTION_INVALID_COPY,
  typographySelectionRoleBase,
} from '../lib/edit/typography-family-ops';

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

const expectedRoles: Record<(typeof widgetTypes)[number], Array<[string, string]>> = {
  'big-bang': [
    ['title', 'Title'],
    ['body', 'Subtitle and supporting copy'],
    ['bigBang', 'Big Bang statement'],
    ['button', 'Button text'],
    ['localeSwitcher', 'Locale switcher'],
  ],
  calltoaction: [
    ['title', 'Title and action headline'],
    ['body', 'Subtitle and supporting text'],
    ['eyebrow', 'Eyebrow'],
    ['button', 'Button text'],
    ['localeSwitcher', 'Locale switcher'],
  ],
  cards: [
    ['title', 'Title'],
    ['body', 'Subtitle'],
    ['cardTitle', 'Card title'],
    ['cardCopy', 'Card copy'],
    ['button', 'Button text'],
    ['localeSwitcher', 'Locale switcher'],
  ],
  countdown: [
    ['title', 'Title'],
    ['body', 'Subtitle'],
    ['timer', 'Timer'],
    ['label', 'Labels'],
    ['button', 'Button text'],
    ['localeSwitcher', 'Locale switcher'],
  ],
  faq: [
    ['title', 'Title'],
    ['body', 'Subtitle'],
    ['section', 'Section title'],
    ['question', 'Question'],
    ['answer', 'Answer'],
    ['button', 'Button text'],
    ['localeSwitcher', 'Locale switcher'],
  ],
  logoshowcase: [
    ['title', 'Title'],
    ['body', 'Subtitle'],
    ['button', 'Button text'],
    ['localeSwitcher', 'Locale switcher'],
  ],
  'split-carousel-media': [
    ['title', 'Title'],
    ['body', 'Subtitle'],
    ['button', 'Button text'],
    ['localeSwitcher', 'Locale switcher'],
  ],
  'split-media': [
    ['title', 'Title'],
    ['body', 'Subtitle'],
    ['button', 'Button text'],
    ['localeSwitcher', 'Locale switcher'],
  ],
};

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

async function compile(spec: RawWidget) {
  return compileWidgetServer(spec, { loadComponentStencil: loadStencil, tokyoBaseUrl: '' });
}

function fontLibraryWithOrio(): AccountFontLibrary {
  const library = createDefaultAccountFontLibrary();
  return {
    ...library,
    fonts: {
      ...library.fonts,
      Orio: {
        label: 'Orio',
        source: 'account-asset',
        category: 'display',
        familyClass: 'sans',
        usage: 'heading-only',
        weights: ['400'],
        styles: ['normal'],
        assetRef: 'Orio.woff2',
        contentType: 'font/woff2',
      },
    },
  };
}

async function testAllWidgetRolesAndAccountNeutralCompiler(): Promise<void> {
  for (const widgetType of widgetTypes) {
    const compiled = await compile(readSpec(widgetType));
    const familyControls = compiled.controls.filter((control) =>
      /^typography\.roles\.[^.]+\.family$/.test(control.path),
    );
    assert.deepEqual(
      familyControls.map((control) => [
        control.path.split('.')[2],
        control.groupLabel,
      ]),
      expectedRoles[widgetType],
      `${widgetType} typography roles/labels`,
    );
    familyControls.forEach((control) => {
      assert.equal(control.kind, 'string', `${widgetType}:${control.path}`);
      assert.deepEqual(control.enumValues, undefined, `${widgetType}:${control.path}`);
      assert.deepEqual(control.options, undefined, `${widgetType}:${control.path}`);
    });
  }
}

async function testAccountBindingAndTransition(): Promise<void> {
  const raw = await compile(readSpec('faq'));
  const compiled = bindSessionTypographyControls(
    raw as unknown as CompiledWidget,
    fontLibraryWithOrio(),
  );
  const family = compiled.controls.find(
    (control) => control.path === 'typography.roles.title.family',
  );
  assert.equal(family?.kind, 'enum');
  assert.equal(family?.enumValues?.includes('Orio'), true);
  assert.equal(family?.options?.some((option) => option.value === 'Orio'), true);

  const config = structuredClone(compiled.defaults);
  const title = (
    ((config.typography as Record<string, unknown>).roles as Record<string, unknown>)
      .title as Record<string, unknown>
  );
  title.family = 'Orio';
  title.weight = '400';
  title.fontStyle = 'normal';
  assert.doesNotThrow(() =>
    assertAccountTypographySelections(config, fontLibraryWithOrio()),
  );

  const expanded = expandTypographyFamilyOps({
    instanceData: structuredClone(raw.defaults),
    fontLibrary: fontLibraryWithOrio(),
    ops: [{ op: 'set', path: 'typography.roles.title.family', value: 'Orio' }],
  });
  assert.deepEqual(expanded, [
    { op: 'set', path: 'typography.roles.title.family', value: 'Orio' },
    { op: 'set', path: 'typography.roles.title.weight', value: '400' },
    { op: 'set', path: 'typography.roles.title.fontStyle', value: 'normal' },
  ]);
  assert.throws(() =>
    expandTypographyFamilyOps({
      instanceData: structuredClone(raw.defaults),
      fontLibrary: fontLibraryWithOrio(),
      ops: [
        { op: 'set', path: 'typography.roles.title.family', value: 'Orio' },
        { op: 'set', path: 'typography.roles.title.weight', value: '700' },
      ],
    }),
  );
  const unchanged = structuredClone(config);
  assert.throws(() =>
    expandTypographyFamilyOps({
      instanceData: unchanged,
      fontLibrary: fontLibraryWithOrio(),
      ops: [{ op: 'set', path: 'typography.roles.title.weight', value: '700' }],
    }),
  );
  assert.deepEqual(unchanged, config);
  assert.equal(
    typographySelectionRoleBase('typography.roles.title.weight'),
    'typography.roles.title',
  );
  assert.equal(
    typographySelectionRoleBase('typography.roles.title.fontStyle'),
    'typography.roles.title',
  );
  assert.equal(typographySelectionRoleBase('typography.roles.title.color'), null);
  const bindingsSource = fs.readFileSync(
    path.join(repoRoot, 'bob/components/td-menu-content/useTdMenuBindings.ts'),
    'utf8',
  );
  assert.match(bindingsSource, /typographySelectionRoleBase\(op\.path\)/);
  assert.match(bindingsSource, /if \(roleBase\) resyncTypographyRole\(roleBase\)/);
}

async function testRoleLabelFailures(): Promise<void> {
  const missing = structuredClone(readSpec('faq')) as RawWidget & {
    editor: { panels: Array<{ id: string; shared?: { roleLabels?: Record<string, string> } }> };
  };
  const panel = missing.editor.panels.find((entry) => entry.id === 'typography')!;
  delete panel.shared!.roleLabels!.answer;
  await assert.rejects(() => compile(missing), /role "answer" requires a product label/);

  const unused = structuredClone(readSpec('faq')) as typeof missing;
  unused.editor.panels.find((entry) => entry.id === 'typography')!.shared!.roleLabels!.ghost =
    'Ghost';
  await assert.rejects(() => compile(unused), /role label "ghost" has no composed role/);

  const malformed = structuredClone(readSpec('faq')) as typeof missing;
  malformed.editor.panels.find(
    (entry) => entry.id === 'typography',
  )!.shared!.roleLabels!.answer = '';
  await assert.rejects(
    () => compile(malformed),
    /roleLabels must contain non-empty strings/,
  );
}

async function testSharedProductCopy(): Promise<void> {
  const { resolveSessionErrorLines } = await import('../components/ToolDrawer');
  assert.deepEqual(
    resolveSessionErrorLines({
      source: 'ops',
      errors: [
        {
          opIndex: 0,
          message: 'coreui.errors.typography.selection.invalid',
        },
      ],
    }),
    [TYPOGRAPHY_SELECTION_INVALID_COPY],
  );
  const source = fs.readFileSync(
    path.join(repoRoot, 'bob/components/CopilotPane.tsx'),
    'utf8',
  );
  assert.ok(
    source.indexOf('expandTypographyFamilyOps({') <
      source.indexOf('buildCopilotUndoOps({', source.indexOf('expandTypographyFamilyOps({')),
  );
  assert.ok(
    source.indexOf('buildCopilotUndoOps({', source.indexOf('expandTypographyFamilyOps({')) <
      source.indexOf('session.applyOps(expandedOps)'),
  );
  assert.match(
    source,
    /if \(!isTypographyFamilySelectionError\(error\)\) throw error;[\s\S]*?setStatus\('idle'\);[\s\S]*?return;[\s\S]*?const inverseOps = buildCopilotUndoOps/,
  );
}

async function main(): Promise<void> {
  await testAllWidgetRolesAndAccountNeutralCompiler();
  console.log('PASS all-widget typography roles, labels, order, and account-neutral controls');
  await testAccountBindingAndTransition();
  console.log('PASS account-bound Orio controls and atomic transition law');
  await testRoleLabelFailures();
  console.log('PASS missing, malformed, and unused role labels fail compilation');
  await testSharedProductCopy();
  console.log('PASS shared rejection copy and Copilot pre-apply ordering');
}

void main();

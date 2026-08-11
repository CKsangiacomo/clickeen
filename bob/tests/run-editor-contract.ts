import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileWidgetServer } from '../lib/compiler.server';
import { decodeHtmlEntities, encodeHtmlEntities, type RawWidget } from '../lib/compiler.shared';
import { expandTooldrawerClusters } from '../lib/compiler/controls';
import { buildEditorHtmlLines } from '../lib/compiler/editor-contract';
import { resolveWidgetTooldrawerLabels } from '../lib/compiler/tooldrawer-labels';
import type {
  ComponentStencil,
  ComponentStencilLoader,
} from '../lib/compiler/stencils';
import { DEFAULT_PANELS } from '../components/TdMenu';
import { controlHostClusterId } from '../components/td-menu-content/dom';
import { BOB_MENU_PANEL_IDS, BOB_WIDGET_PANEL_IDS } from '../lib/types';
import { assertCompiledEditorContract } from '../lib/session/sessionConfig';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const widgetsRoot = path.join(repoRoot, 'tokyo/product/widgets');
type JsonObject = Record<string, unknown>;

type AuthoredCluster = {
  kind?: unknown;
  label?: unknown;
  initiallyOpen?: unknown;
};

type AuthoredPanel = {
  id?: unknown;
  clusters?: unknown;
};

const loadStencil: ComponentStencilLoader = async (type): Promise<ComponentStencil> => {
  const componentRoot = path.join(repoRoot, 'dieter/components', type);
  return {
    stencil: fs.readFileSync(path.join(componentRoot, `${type}.html`), 'utf8'),
    spec: JSON.parse(
      fs.readFileSync(path.join(componentRoot, `${type}.spec.json`), 'utf8'),
    ) as ComponentStencil['spec'],
  };
};

function readTooldrawerLabels(widgetType: string): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(widgetsRoot, widgetType, `${widgetType}_tooldrawer_l10n_labels`, 'en.json'),
      'utf8',
    ),
  ) as unknown;
}

function discoverWidgetSpecs(): Array<{ widgetType: string; spec: RawWidget; labels: unknown }> {
  return fs
    .readdirSync(widgetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => ({
      widgetType: entry.name,
      specPath: path.join(widgetsRoot, entry.name, 'spec.json'),
    }))
    .filter((entry) => fs.existsSync(entry.specPath))
    .sort((left, right) => left.widgetType.localeCompare(right.widgetType))
    .map(({ widgetType, specPath }) => ({
      widgetType,
      spec: JSON.parse(fs.readFileSync(specPath, 'utf8')) as RawWidget,
      labels: readTooldrawerLabels(widgetType),
    }));
}

function readAuthoredPanels(spec: RawWidget, widgetType: string): AuthoredPanel[] {
  const editor = spec.editor;
  assert.ok(editor && typeof editor === 'object' && !Array.isArray(editor), `${widgetType} has editor`);
  const panels = (editor as JsonObject).panels;
  assert.ok(Array.isArray(panels), `${widgetType} has editor panels`);
  return panels as AuthoredPanel[];
}

function readAuthoredClusters(panel: AuthoredPanel): AuthoredCluster[] {
  if (!Array.isArray(panel.clusters)) return [];
  return panel.clusters.filter(
    (item): item is AuthoredCluster =>
      Boolean(item) &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      (item as AuthoredCluster).kind !== 'shared',
  );
}

function captureAll(source: string, pattern: RegExp): string[][] {
  return Array.from(source.matchAll(pattern), (match) => match.slice(1));
}

function assertCompiledClusterState(args: {
  widgetType: string;
  panelId: string;
  html: string;
}): void {
  const collapsed = captureAll(
    args.html,
    /class="tdmenucontent__cluster" data-collapsed="(true|false)"/g,
  ).map(([value]) => value);
  const labels = captureAll(
    args.html,
    /class="overline-small tdmenucontent__cluster-label"[^>]*>([^<]*)<\/div>/g,
  ).map(([value]) => value);
  const toggles = captureAll(
    args.html,
    /class="diet-button tdmenucontent__cluster-toggle"[^>]*aria-expanded="(true|false)"[^>]*aria-controls="([^"]+)"/g,
  );
  const bodies = captureAll(
    args.html,
    /class="tdmenucontent__cluster-body" id="([^"]+)"( hidden)?/g,
  );

  assert.ok(collapsed.length > 0, `${args.widgetType}:${args.panelId} has compiled sections`);
  assert.equal(labels.length, collapsed.length, `${args.widgetType}:${args.panelId} labels every section`);
  assert.equal(toggles.length, collapsed.length, `${args.widgetType}:${args.panelId} toggles every section`);
  assert.equal(bodies.length, collapsed.length, `${args.widgetType}:${args.panelId} bodies every section`);

  const openLabels: string[] = [];
  collapsed.forEach((collapsedValue, index) => {
    const [expandedValue, controlledBodyId] = toggles[index];
    const [bodyId, hiddenAttribute] = bodies[index];
    const isOpen = collapsedValue === 'false';
    assert.equal(expandedValue, isOpen ? 'true' : 'false', `${args.widgetType}:${args.panelId}:${labels[index]} expanded state`);
    assert.equal(controlledBodyId, bodyId, `${args.widgetType}:${args.panelId}:${labels[index]} controls its body`);
    assert.equal(Boolean(hiddenAttribute), !isOpen, `${args.widgetType}:${args.panelId}:${labels[index]} hidden state`);
    if (isOpen) openLabels.push(labels[index]);
  });

  assert.deepEqual(
    openLabels,
    args.panelId === 'content' ? ['Header', 'Content'] : [],
    `${args.widgetType}:${args.panelId} open sections`,
  );
}

function assertDropdownEditLabels(args: {
  widgetType: string;
  html: string;
  labels: Record<string, string>;
}): void {
  const roots = args.html
    .split('<div class="diet-dropdown-edit diet-popover-host"')
    .slice(1);
  assert.ok(roots.length > 0, `${args.widgetType} compiles Dropdown Edit controls`);

  const label = (key: string) => encodeHtmlEntities(args.labels[`component.dropdown-edit.${key}.label`]);
  roots.forEach((root, index) => {
    for (const [command, key] of [
      ['bold', 'bold'],
      ['italic', 'italic'],
      ['underline', 'underline'],
      ['strike', 'strikethrough'],
      ['link', 'link'],
      ['clear-format', 'clear-formatting'],
    ]) {
      const commandStart = root.indexOf(`data-command="${command}"`);
      assert.ok(commandStart >= 0, `${args.widgetType} Dropdown Edit ${index} has ${command}`);
      const commandEnd = root.indexOf('</button>', commandStart);
      assert.ok(
        root.slice(commandStart, commandEnd).includes(`aria-label="${label(key)}"`),
        `${args.widgetType} Dropdown Edit ${index} labels ${command}`,
      );
    }
    assert.ok(
      root.includes(`diet-popover__header-label label-s">${label('link')}</span>`),
      `${args.widgetType} Dropdown Edit ${index} labels Link sheet`,
    );
    assert.ok(
      root.includes(`diet-textfield__display-label label-s">${label('url')}</span>`),
      `${args.widgetType} Dropdown Edit ${index} labels URL`,
    );
    assert.ok(
      root.includes(`diet-button__label">${label('remove-link')}</span>`),
      `${args.widgetType} Dropdown Edit ${index} labels Remove link`,
    );
    assert.ok(
      root.includes(`diet-button__label">${label('apply')}</span>`),
      `${args.widgetType} Dropdown Edit ${index} labels Apply`,
    );
  });
}

async function testEveryWidgetEditorContract(): Promise<void> {
  const widgets = discoverWidgetSpecs();
  assert.ok(widgets.length > 0, 'at least one widget spec is discovered');
  const widgetDefaultsDocumentIds: string[] = [];
  let commonBodyIds: string[] | null = null;

  for (const { widgetType, spec, labels } of widgets) {
    const resolved = resolveWidgetTooldrawerLabels(spec, labels);
    const panels = readAuthoredPanels(resolved.widget, widgetType);
    const authoredPanelIds = panels.map((panel) => panel.id);
    assert.equal(
      new Set(authoredPanelIds).size,
      BOB_WIDGET_PANEL_IDS.length,
      `${widgetType} authors each panel once`,
    );
    assert.deepEqual(
      [...authoredPanelIds].sort(),
      [...BOB_WIDGET_PANEL_IDS].sort(),
      `${widgetType} authors exactly the canonical panels`,
    );

    const openedAuthoredClusters: Array<{ panelId: unknown; label: unknown }> = [];
    panels.forEach((panel) => {
      readAuthoredClusters(panel).forEach((cluster) => {
        const hasLabel = typeof cluster.label === 'string' && Boolean(cluster.label.trim());
        assert.equal(
          hasLabel,
          true,
          `${widgetType}:${String(panel.id)} cluster has an authored label`,
        );
        if (cluster.initiallyOpen === true) {
          openedAuthoredClusters.push({ panelId: panel.id, label: cluster.label });
        }
      });
    });
    assert.deepEqual(
      openedAuthoredClusters,
      [{ panelId: 'content', label: 'Content' }],
      `${widgetType} opens only its primary Content cluster`,
    );

    const compiled = await compileWidgetServer(spec, {
      loadComponentStencil: loadStencil,
      tokyoBaseUrl: '',
      tooldrawerLabels: labels,
    });
    assert.deepEqual(
      compiled.panels.map((panel) => panel.id),
      BOB_WIDGET_PANEL_IDS,
      `${widgetType} compiles the canonical panel order`,
    );
    assert.deepEqual(
      compiled.panels.map((panel) => panel.label),
      BOB_WIDGET_PANEL_IDS.map((panelId) => String((labels as any).labels[`panel.${panelId}`])),
      `${widgetType} compiles its exact English panel labels`,
    );
    assert.equal(
      compiled.toolDrawerLabels.components['agent-activity'].title,
      'Translation Agent',
      `${widgetType} compiles its exact Agent Activity title`,
    );
    assertDropdownEditLabels({
      widgetType,
      html: compiled.panels.map((panel) => panel.html).join('\n'),
      labels: (labels as { labels: Record<string, string> }).labels,
    });
    const combinedBodyIds = captureAll(
      compiled.panels.map((panel) => panel.html).join('\n'),
      /class="tdmenucontent__cluster-body" id="([^"]+)"/g,
    ).map(([id]) => id);
    assert.equal(
      new Set(combinedBodyIds).size,
      combinedBodyIds.length,
      `${widgetType} cluster body ids remain unique when consumers combine panels`,
    );
    commonBodyIds ??= combinedBodyIds;
    combinedBodyIds.forEach((id) => {
      widgetDefaultsDocumentIds.push(
        controlHostClusterId(`widget-defaults-core-${widgetType}`, id),
      );
    });
    compiled.panels.forEach((panel) => {
      assert.doesNotMatch(
        panel.html,
        /<\/?(?:bob-panel|tooldrawer-[a-z0-9-]+)/i,
        `${widgetType}:${panel.id} contains no internal compiler tags`,
      );
      assertCompiledClusterState({ widgetType, panelId: panel.id, html: panel.html });
    });
  }

  assert.ok(commonBodyIds, 'Widget Defaults has a common control artifact');
  commonBodyIds.forEach((id) => {
    widgetDefaultsDocumentIds.push(controlHostClusterId('widget-defaults-common', id));
  });
  assert.equal(
    new Set(widgetDefaultsDocumentIds).size,
    widgetDefaultsDocumentIds.length,
    'Widget Defaults host namespaces keep all document cluster ids unique',
  );
}

function testTooldrawerLabelContractsFailClosed(): void {
  const widgetType = 'faq';
  const spec = JSON.parse(
    fs.readFileSync(path.join(widgetsRoot, widgetType, 'spec.json'), 'utf8'),
  ) as RawWidget;
  const labels = readTooldrawerLabels(widgetType) as {
    widgetType: string;
    locale: string;
    labels: Record<string, string>;
  };
  const firstKey = Object.keys(labels.labels)[0];
  assert.ok(firstKey);

  const missing = structuredClone(labels);
  delete missing.labels[firstKey];
  assert.throws(
    () => resolveWidgetTooldrawerLabels(spec, missing),
    /label is missing/,
    'missing English ToolDrawer copy fails closed',
  );

  const extra = structuredClone(labels);
  extra.labels['content.unused.label'] = 'Unused';
  assert.throws(
    () => resolveWidgetTooldrawerLabels(spec, extra),
    /unused keys/,
    'unused English ToolDrawer copy fails closed',
  );

  const extraRoot = { ...structuredClone(labels), fallbackLocale: 'en' };
  assert.throws(
    () => resolveWidgetTooldrawerLabels(spec, extraRoot),
    /invalid root fields/,
    'unexpected ToolDrawer label schema fields fail closed',
  );

  const hardcoded = structuredClone(spec) as any;
  hardcoded.editor.panels[0].clusters.find((entry: any) => entry?.kind !== 'shared').label = 'Content';
  assert.throws(
    () => resolveWidgetTooldrawerLabels(hardcoded, labels),
    /must use a label token/,
    'hardcoded widget-authored ToolDrawer copy fails closed',
  );

  const hardcodedActivityTitle = structuredClone(spec) as any;
  hardcodedActivityTitle.editor.labels.components['agent-activity'].title = 'Translation Agent';
  assert.throws(
    () => resolveWidgetTooldrawerLabels(hardcodedActivityTitle, labels),
    /must use a label token/,
    'hardcoded Agent Activity title fails closed',
  );
}

function fixturePanels(contentCluster: JsonObject): JsonObject[] {
  return [
    { id: 'content', clusters: [contentCluster] },
    {
      id: 'typography',
      shared: { id: 'typography', roleLabels: { title: 'Title' } },
    },
    { id: 'layout', clusters: [{ label: 'Layout', nodes: [] }] },
    { id: 'appearance', clusters: [{ label: 'Appearance', nodes: [] }] },
    { id: 'settings', clusters: [{ label: 'Settings', nodes: [] }] },
  ];
}

function fixtureDefaults(): JsonObject {
  return {
    title: '',
    typography: {
      globalFamily: 'Arial',
      roles: { title: {} },
    },
  };
}

function testSpecialCharactersRoundTripOnce(): void {
  const label = `R&D <Cards> "quotes" apostrophe's; use &amp; &lt; &quot; literally`;
  const editor = {
    panels: fixturePanels({
      label,
      initiallyOpen: true,
      nodes: [{ kind: 'field', type: 'textfield', path: 'title', label: 'Title' }],
    }),
  };
  const authoredHtml = buildEditorHtmlLines(editor, fixtureDefaults(), 'editor-contract-fixture').join('\n');
  const expandedHtml = expandTooldrawerClusters(authoredHtml);
  const renderedLabel = expandedHtml.match(
    /class="overline-small tdmenucontent__cluster-label"[^>]*>([^<]*)<\/div>/,
  );
  assert.ok(renderedLabel, 'compiled section label exists');
  assert.equal(decodeHtmlEntities(renderedLabel[1]), label, 'browser-visible label matches source');
  assert.doesNotMatch(expandedHtml, /<tooldrawer-cluster\b/i, 'cluster source tag is consumed');
}

function testInvalidEditorContractsFail(): void {
  const unlabeledEditor = {
    panels: fixturePanels({
      initiallyOpen: true,
      nodes: [{ kind: 'field', type: 'textfield', path: 'title', label: 'Title' }],
    }),
  };
  assert.throws(
    () => {
      const unlabeledHtml = buildEditorHtmlLines(
        unlabeledEditor,
        fixtureDefaults(),
        'unlabeled-fixture',
      ).join('\n');
      expandTooldrawerClusters(unlabeledHtml);
    },
    /label must be a non-empty string|requires label/,
    'unlabeled cluster fails closed',
  );

  const inventedPanels = fixturePanels({ label: 'Content', initiallyOpen: true, nodes: [] });
  inventedPanels[2] = { id: 'governance', clusters: [{ label: 'Governance', nodes: [] }] };
  assert.throws(
    () => buildEditorHtmlLines({ panels: inventedPanels }, fixtureDefaults(), 'invented-panel-fixture'),
    /unsupported id|canonical panels/,
    'invented panel fails closed',
  );
}

function testCompiledPanelLabelsFailClosed(): void {
  const toolDrawerLabels = {
    components: {
      'agent-activity': {
        title: 'Translation Agent',
      },
    },
  };
  assert.throws(
    () =>
      assertCompiledEditorContract({
        toolDrawerLabels,
        panels: BOB_WIDGET_PANEL_IDS.map((id) => ({
          id,
          label: id === 'content' ? '' : id,
          html: '',
        })),
      }),
    /coreui\.errors\.builder\.open\.invalidRequest/,
    'missing compiled panel label fails Builder open',
  );

  assert.throws(
    () =>
      assertCompiledEditorContract({
        toolDrawerLabels: {
          components: {
            'agent-activity': {
              title: '',
            },
          },
        },
        panels: BOB_WIDGET_PANEL_IDS.map((id) => ({
          id,
          label: id,
          html: '',
        })),
      }),
    /coreui\.errors\.builder\.open\.invalidRequest/,
    'missing compiled Agent Activity title fails Builder open',
  );
}

async function main(): Promise<void> {
  assert.deepEqual(
    DEFAULT_PANELS.map((panel) => panel.id),
    BOB_MENU_PANEL_IDS,
    'Bob menu uses the canonical shared order',
  );
  await testEveryWidgetEditorContract();
  console.log('PASS every widget conforms to the authored and compiled editor contract');
  testTooldrawerLabelContractsFailClosed();
  console.log('PASS ToolDrawer English label contracts fail closed');
  testSpecialCharactersRoundTripOnce();
  console.log('PASS editor labels round-trip special characters exactly once');
  testInvalidEditorContractsFail();
  console.log('PASS invalid editor contracts fail closed');
  testCompiledPanelLabelsFailClosed();
  console.log('PASS invalid compiled panel and ToolDrawer labels fail Builder open');
}

void main();

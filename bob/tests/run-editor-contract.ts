import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileWidgetServer } from '../lib/compiler.server';
import { decodeHtmlEntities, encodeHtmlEntities, type RawWidget } from '../lib/compiler.shared';
import { compileControlsFromPanels, expandTooldrawerClusters } from '../lib/compiler/controls';
import { buildEditorHtmlLines } from '../lib/compiler/editor-contract';
import { resolveWidgetTooldrawerLabels } from '../lib/compiler/tooldrawer-labels';
import type { ComponentStencil, ComponentStencilLoader } from '../lib/compiler/stencils';
import { buildContext } from '../lib/compiler/stencils';
import { DEFAULT_PANELS } from '../components/TdMenu';
import { controlHostClusterId } from '../components/td-menu-content/dom';
import { expandLinkedOps } from '../components/td-menu-content/linkedOps';
import { BOB_MENU_PANEL_IDS, BOB_WIDGET_PANEL_IDS } from '../lib/types';
import {
  assertCompiledEditorContract,
  assertSessionConfigContract,
} from '../lib/session/sessionConfig';

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
  assert.ok(
    editor && typeof editor === 'object' && !Array.isArray(editor),
    `${widgetType} has editor`,
  );
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
  assert.equal(
    labels.length,
    collapsed.length,
    `${args.widgetType}:${args.panelId} labels every section`,
  );
  assert.equal(
    toggles.length,
    collapsed.length,
    `${args.widgetType}:${args.panelId} toggles every section`,
  );
  assert.equal(
    bodies.length,
    collapsed.length,
    `${args.widgetType}:${args.panelId} bodies every section`,
  );

  const openLabels: string[] = [];
  collapsed.forEach((collapsedValue, index) => {
    const [expandedValue, controlledBodyId] = toggles[index];
    const [bodyId, hiddenAttribute] = bodies[index];
    const isOpen = collapsedValue === 'false';
    assert.equal(
      expandedValue,
      isOpen ? 'true' : 'false',
      `${args.widgetType}:${args.panelId}:${labels[index]} expanded state`,
    );
    assert.equal(
      controlledBodyId,
      bodyId,
      `${args.widgetType}:${args.panelId}:${labels[index]} controls its body`,
    );
    assert.equal(
      Boolean(hiddenAttribute),
      !isOpen,
      `${args.widgetType}:${args.panelId}:${labels[index]} hidden state`,
    );
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
  const roots = args.html.split('<div class="diet-dropdown-edit diet-popover-host"').slice(1);
  assert.ok(roots.length > 0, `${args.widgetType} compiles Dropdown Edit controls`);

  const label = (key: string) =>
    encodeHtmlEntities(args.labels[`component.dropdown-edit.${key}.label`]);
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
      const buttonStart = root.lastIndexOf('<button', commandStart);
      const commandEnd = root.indexOf('</button>', commandStart);
      assert.ok(
        root.slice(buttonStart, commandEnd).includes(`aria-label="${label(key)}"`),
        `${args.widgetType} Dropdown Edit ${index} labels ${command}`,
      );
      assert.ok(
        root.slice(buttonStart, commandEnd).includes('data-size="medium"'),
        `${args.widgetType} Dropdown Edit ${index} sizes ${command} through medium Button geometry`,
      );
    }
    assert.ok(
      root.includes(`diet-dropdown-edit__link-header-label">${label('link')}</span>`),
      `${args.widgetType} Dropdown Edit ${index} labels Link sheet`,
    );
    assert.ok(
      root.includes(`diet-textfield__display-label label-s">${label('url')}</span>`),
      `${args.widgetType} Dropdown Edit ${index} labels URL`,
    );
    const closeStart = root.indexOf('diet-dropdown-edit__link-close');
    const closeEnd = root.indexOf('</button>', closeStart);
    assert.ok(
      closeStart >= 0 &&
        root.slice(closeStart, closeEnd).includes('data-size="medium"') &&
        root.slice(closeStart, closeEnd).includes(`aria-label="${label('close-link')}"`),
      `${args.widgetType} Dropdown Edit ${index} labels and sizes its link-sheet close action`,
    );
    assert.equal(
      root.match(/class="diet-button diet-dropdown-edit__link-action"/g)?.length ?? 0,
      1,
      `${args.widgetType} Dropdown Edit ${index} has one link action`,
    );
    assert.ok(
      root.includes(`data-add-label="${label('add-link')}"`),
      `${args.widgetType} Dropdown Edit ${index} labels Add link`,
    );
    assert.ok(
      root.includes(`data-remove-label="${label('remove-link')}"`),
      `${args.widgetType} Dropdown Edit ${index} labels Remove link`,
    );
    assert.ok(
      !root.includes('diet-dropdown-edit__remove-link'),
      `${args.widgetType} Dropdown Edit ${index} has no second link action`,
    );
  });
}

function assertDropdownShadowLabels(args: {
  widgetType: string;
  html: string;
  labels: Record<string, string>;
}): void {
  const expectedCounts: Record<string, number> = {
    'big-bang': 12,
    calltoaction: 12,
    cards: 13,
    countdown: 13,
    faq: 18,
    logoshowcase: 13,
    'split-carousel-media': 13,
    'split-media': 13,
  };
  const roots = args.html.split('class="diet-dropdown-shadow diet-popover-host"').slice(1);
  assert.equal(roots.length, expectedCounts[args.widgetType], `${args.widgetType} Shadow count`);
  const componentKeys = [
    'blur',
    'color',
    'default-colors',
    'enabled',
    'hex',
    'horizontal',
    'hue',
    'opacity',
    'preview',
    'spread',
    'vertical',
  ];
  roots.forEach((root, index) => {
    assert.match(
      root,
      /class="diet-dropdown-header-label"[^>]*>[^<]+<\/span>/,
      `${args.widgetType} Shadow ${index} has its caller label`,
    );
    componentKeys.forEach((key) => {
      const labelKey = `component.dropdown-shadow.${key}.label`;
      assert.ok(
        root.includes(encodeHtmlEntities(args.labels[labelKey])),
        `${args.widgetType} Shadow ${index} resolves ${key}`,
      );
    });
    assert.ok(
      root.includes('data-dieter-json'),
      `${args.widgetType} Shadow ${index} binds exact JSON`,
    );
    assert.doesNotMatch(
      root,
      /\$label:/,
      `${args.widgetType} Shadow ${index} has no unresolved copy`,
    );
  });

  for (const [path, labelKey] of [
    ['stage.insideShadow.linked', 'appearance.stage.inside-shadow.linked.toggle.label'],
    ['pod.insideShadow.linked', 'appearance.pod.inside-shadow.linked.toggle.label'],
  ]) {
    assert.ok(
      args.html.includes(`path="${path}"`) &&
        args.html.includes(encodeHtmlEntities(args.labels[labelKey])),
      `${args.widgetType} resolves ${path}`,
    );
  }
  if (args.widgetType === 'faq') {
    assert.ok(
      args.html.includes('path="faq.appearance.cardwrapper.insideShadow.linked"') &&
        args.html.includes(
          encodeHtmlEntities(
            args.labels['appearance.faq.cardwrapper.inside-shadow.linked.toggle.label'],
          ),
        ),
      'faq resolves Q&A card inside-shadow link copy',
    );
  }
  for (const key of ['above-content', 'below-content', 'layer']) {
    assert.ok(
      args.html.includes(encodeHtmlEntities(args.labels[`component.dropdown-shadow.${key}.label`])),
      `${args.widgetType} resolves inside-shadow ${key}`,
    );
  }
}

function assertCollectionEditorContract(args: {
  widgetType: string;
  html: string;
  labels: Record<string, string>;
}): void {
  const expected: Record<
    string,
    { objectManagers: number; repeaters: number; structural: boolean }
  > = {
    'big-bang': { objectManagers: 0, repeaters: 0, structural: false },
    calltoaction: { objectManagers: 0, repeaters: 0, structural: false },
    cards: { objectManagers: 1, repeaters: 1, structural: false },
    countdown: { objectManagers: 0, repeaters: 0, structural: false },
    faq: { objectManagers: 1, repeaters: 1, structural: true },
    logoshowcase: { objectManagers: 1, repeaters: 1, structural: true },
    'split-carousel-media': { objectManagers: 0, repeaters: 1, structural: false },
    'split-media': { objectManagers: 0, repeaters: 0, structural: false },
  };
  const contract = expected[args.widgetType];
  assert.ok(contract, `${args.widgetType} has a collection-editor expectation`);
  assert.equal(
    args.html.match(/class="diet-object-manager"/g)?.length ?? 0,
    contract.objectManagers,
    `${args.widgetType} Object Manager count`,
  );
  const hostCollectionCounts: Record<string, number> = {
    'big-bang': 0,
    calltoaction: 0,
    cards: 2,
    countdown: 0,
    faq: 1,
    logoshowcase: 1,
    'split-carousel-media': 1,
    'split-media': 0,
  };
  const hostCollectionFields = captureAll(
    args.html,
    /class="diet-(?:object-manager|repeater)__field"[^>]*data-path="([^"]+)"[^>]*data-bob-path="([^"]+)"/g,
  );
  assert.equal(
    hostCollectionFields.length,
    hostCollectionCounts[args.widgetType],
    `${args.widgetType} exposes only its top-level collection host boundaries`,
  );
  hostCollectionFields.forEach(([dieterPath, bobPath]) => {
    assert.equal(bobPath, dieterPath, `${args.widgetType} preserves the exact host collection path`);
  });
  assert.doesNotMatch(
    args.html,
    /data-bob-path="[^"]*(?:__INDEX__|__SECTION__|__STRIP__)[^"]*"/,
    `${args.widgetType} keeps nested collection coordinates consumer-neutral`,
  );
  assert.equal(
    args.html.match(/class="diet-repeater"/g)?.length ?? 0,
    contract.repeaters,
    `${args.widgetType} Repeater count`,
  );

  if (contract.objectManagers) {
    assert.ok(
      args.html.includes(`data-allow-structure="${contract.structural ? 'true' : 'false'}"`),
      `${args.widgetType} compiles its exact structural authority`,
    );
    assert.equal(
      args.html.includes('data-objects-modal'),
      contract.structural,
      `${args.widgetType} emits structural UI only when declared`,
    );
    if (contract.structural) {
      for (const key of [
        'cancel',
        'delete',
        'discard',
        'discard-message',
        'discard-title',
        'keep-editing',
        'move-down',
        'move-up',
        'save',
      ]) {
        assert.ok(
          args.html.includes(
            encodeHtmlEntities(args.labels[`component.object-manager.${key}.label`]),
          ),
          `${args.widgetType} resolves Object Manager ${key}`,
        );
      }
    }
    const itemLabels = Object.entries(args.labels)
      .filter(([key]) => key.includes('.object-manager.item-label'))
      .map(([, value]) => encodeHtmlEntities(value));
    assert.equal(
      itemLabels.length,
      contract.objectManagers,
      `${args.widgetType} owns each Object Manager item label`,
    );
    itemLabels.forEach((label) => {
      assert.ok(
        args.html.includes(`data-item-label="${label}"`),
        `${args.widgetType} compiles ${label}`,
      );
    });
  }

  if (contract.repeaters) {
    assert.equal(
      args.html.match(/class="diet-repeater" data-size="md"/g)?.length ?? 0,
      contract.repeaters,
      `${args.widgetType} Repeaters use their declared medium size`,
    );
    const repeaters = args.html.split('<div class="diet-repeater"').slice(1);
    repeaters.forEach((repeater, index) => {
      assert.match(
        repeater.slice(0, repeater.indexOf('>') + 1),
        /data-default-item="\{&quot;id&quot;:&quot;&quot;/,
        `${args.widgetType} Repeater ${index} declares exact new-item state with an empty id coordinate`,
      );
    });
    assert.doesNotMatch(
      args.html,
      /diet-repeater[^>]*reorder-title/,
      `${args.widgetType} has no retired Repeater copy`,
    );
    assert.doesNotMatch(
      args.html,
      /diet-repeater__[^"]*icon[^>]*data-size=/,
      `${args.widgetType} lets Repeater size own its Icons`,
    );
  }
  assert.doesNotMatch(
    args.html,
    /\$label:/,
    `${args.widgetType} collection controls contain no raw label tokens`,
  );
}

function assertSegmentedEditorContract(args: { widgetType: string; html: string }): void {
  const roots = args.html.match(/<div class="diet-segmented[^\"]*"[\s\S]*?<\/div>/g) ?? [];
  assert.ok(roots.length > 0, `${args.widgetType} compiles Segmented controls`);
  roots.forEach((root, index) => {
    const inputs = root.match(/class="[^"]*\bdiet-segment__input\b[^"]*"/g)?.length ?? 0;
    const surfaces = root.match(/class="[^"]*\bdiet-segment__surface\b[^"]*"/g)?.length ?? 0;
    const contents = root.match(/class="[^"]*\bdiet-segment__content\b[^"]*"/g)?.length ?? 0;
    assert.ok(inputs > 1, `${args.widgetType} Segmented ${index} has a real radio group`);
    assert.equal(surfaces, inputs, `${args.widgetType} Segmented ${index} has one surface per radio`);
    assert.equal(contents, inputs, `${args.widgetType} Segmented ${index} has one content node per radio`);
    assert.doesNotMatch(root, /diet-button|aria-pressed/, `${args.widgetType} Segmented ${index} has no mirrored Button state`);
  });
}

function testInsideShadowLinkOpsPreserveHiddenValues(): void {
  const all = {
    enabled: true,
    inset: true,
    x: 0,
    y: 0,
    blur: 24,
    spread: 0,
    color: '#111111',
    alpha: 20,
  };
  const top = {
    enabled: true,
    inset: true,
    x: 1,
    y: 2,
    blur: 3,
    spread: 4,
    color: '#222222',
    alpha: 30,
  };
  const right = {
    enabled: true,
    inset: true,
    x: -5,
    y: 6,
    blur: 7,
    spread: 8,
    color: '#333333',
    alpha: 40,
  };
  const bottom = {
    enabled: true,
    inset: true,
    x: 9,
    y: -10,
    blur: 11,
    spread: 12,
    color: '#444444',
    alpha: 50,
  };
  const left = {
    enabled: true,
    inset: true,
    x: 13,
    y: 14,
    blur: 15,
    spread: 16,
    color: '#555555',
    alpha: 60,
  };
  const instanceData = {
    stage: {
      insideShadow: { linked: false, layer: 'below-content', all, top, right, bottom, left },
    },
  };
  const requested = [
    { op: 'set' as const, path: 'stage.insideShadow.linked', value: true },
    { op: 'set' as const, path: 'stage.insideShadow.all', value: { ...all, blur: 40 } },
  ];
  assert.deepEqual(
    expandLinkedOps({ compiled: null, instanceData, ops: requested, fontLibrary: null }),
    requested,
    'inside-shadow link and all-value edits do not overwrite hidden side values',
  );
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
    assertDropdownShadowLabels({
      widgetType,
      html: compiled.panels.map((panel) => panel.html).join('\n'),
      labels: (labels as { labels: Record<string, string> }).labels,
    });
    assertCollectionEditorContract({
      widgetType,
      html: compiled.panels.map((panel) => panel.html).join('\n'),
      labels: (labels as { labels: Record<string, string> }).labels,
    });
    assertSegmentedEditorContract({
      widgetType,
      html: compiled.panels.map((panel) => panel.html).join('\n'),
    });
    if (widgetType === 'faq') {
      const sectionTitle = compiled.controls.find(
        (control) => control.path === 'faq.sections.__SECTION__.title',
      );
      assert.equal(sectionTitle?.type, 'textfield', 'FAQ section title keeps textfield metadata');
      assert.equal(sectionTitle?.label, 'Section', 'FAQ section title keeps its caller-owned label');
    }
    if (widgetType === 'logoshowcase') {
      const contentHtml = compiled.panels.find((panel) => panel.id === 'content')?.html ?? '';
      assert.equal(
        contentHtml.match(/data-bob-group="content-logos"/g)?.length ?? 0,
        2,
        'Logo Showcase keeps Repeater and Bulk Edit in one declared host group',
      );
      assert.ok(
        contentHtml.includes(
          'data-add-open=".diet-bulk-edit[data-bulk-path=&quot;logoshowcase.strips&quot;] [data-bulk-open]"',
        ),
        'Logo Showcase keeps its caller-declared add-open target',
      );
    }
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
  hardcoded.editor.panels[0].clusters.find((entry: any) => entry?.kind !== 'shared').label =
    'Content';
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

  const hardcodedDropdownHeader = structuredClone(spec) as any;
  const objectManager = hardcodedDropdownHeader.editor.panels
    .flatMap((panel: any) => panel.clusters ?? [])
    .flatMap((cluster: any) => cluster.nodes ?? [])
    .find((node: any) => node?.kind === 'field' && node?.type === 'object-manager');
  const question = objectManager.template[0].template[0].children.find(
    (node: any) => node?.type === 'dropdown-edit',
  );
  question.attrs.headerLabel = 'Question';
  assert.throws(
    () => resolveWidgetTooldrawerLabels(hardcodedDropdownHeader, labels),
    /must use a label token/,
    'hardcoded Dropdown Edit header label fails closed',
  );
}

function fixturePanels(contentCluster: JsonObject): JsonObject[] {
  return [
    { id: 'content', clusters: [contentCluster] },
    {
      id: 'typography',
      clusters: [{ label: 'Typography', nodes: [] }],
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
  const authoredHtml = buildEditorHtmlLines(
    editor,
    fixtureDefaults(),
    'editor-contract-fixture',
  ).join('\n');
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
    () =>
      buildEditorHtmlLines({ panels: inventedPanels }, fixtureDefaults(), 'invented-panel-fixture'),
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

async function testDropdownUploadSingleValueContract(): Promise<void> {
  const panels = [
    {
      id: 'content' as const,
      label: 'Content',
      html: [
        "<tooldrawer-field type='dropdown-upload' path='media.logo' label='Logo' placeholder='No file'",
        "upload-label='Upload' replace-label='Replace' remove-label='Remove'",
        "upload-asset-error-label='Asset upload failed.'",
        "preview-asset-error-label='Asset preview could not be loaded.' />",
      ].join(' '),
    },
  ];
  const defaults = { media: { logo: null } };
  const controls = compileControlsFromPanels({ panels, defaults });
  assert.equal(controls.length, 1, 'Dropdown Upload compiles one control');
  assert.equal(controls[0].type, 'dropdown-upload');
  assert.equal(controls[0].kind, 'json');
  assert.equal(controls[0].path, 'media.logo');

  assert.doesNotThrow(() =>
    assertSessionConfigContract({ media: { logo: null } }, { controls, defaults }),
  );
  assert.doesNotThrow(() =>
    assertSessionConfigContract(
      { media: { logo: { assetRef: 'asset-logo', name: 'logo.svg' } } },
      { controls, defaults },
    ),
  );
  assert.throws(
    () =>
      assertSessionConfigContract(
        { media: { logo: { assetRef: 'asset-logo', name: 'logo.svg', source: 'user' } } },
        { controls, defaults },
      ),
    /coreui\.errors\.instance\.config\.invalid:media\.logo/,
    'retired split-metadata shape is rejected',
  );

  const uploadStencil = await loadStencil('dropdown-upload');
  await assert.rejects(
    () =>
      buildContext(
        'dropdown-upload',
        {
          type: 'dropdown-upload',
          path: 'media.logo',
          label: 'Logo',
          placeholder: 'No file',
          'upload-label': 'Upload',
          'replace-label': 'Replace',
          'remove-label': 'Remove',
          'upload-asset-error-label': 'Asset upload failed.',
          'preview-asset-error-label': 'Asset preview could not be loaded.',
          template: '<div>retired nested preview</div>',
        },
        uploadStencil.spec,
        loadStencil,
      ),
    /does not accept template content/,
    'retired nested template composition is rejected',
  );
}

function testDropdownUploadCopyJoin(): void {
  const editor = {
    labels: {
      components: {
        'dropdown-upload': {
          previewAssetError: 'Preview failed.',
          remove: 'Remove',
          replace: 'Replace',
          upload: 'Upload',
          uploadAssetError: 'Upload failed.',
        },
      },
    },
    panels: fixturePanels({
      label: 'Content',
      initiallyOpen: true,
      nodes: [
        {
          kind: 'field',
          type: 'dropdown-upload',
          path: 'media.logo',
          label: 'Logo',
          attrs: { placeholder: 'No file', accept: 'image/*,.svg' },
        },
      ],
    }),
  };
  const lines = buildEditorHtmlLines(
    editor,
    { ...fixtureDefaults(), media: { logo: null } },
    'upload-fixture',
  );
  const uploadLine = lines.find((line) => /\btype='dropdown-upload'/.test(line));
  assert.ok(uploadLine, 'Dropdown Upload compiles');
  for (const expected of [
    "preview-asset-error-label='Preview failed.'",
    "remove-label='Remove'",
    "replace-label='Replace'",
    "upload-label='Upload'",
    "upload-asset-error-label='Upload failed.'",
  ]) {
    assert.ok(uploadLine.includes(expected), `Dropdown Upload joins ${expected}`);
  }

  const missing = structuredClone(editor) as any;
  delete missing.labels.components['dropdown-upload'].replace;
  assert.throws(
    () =>
      buildEditorHtmlLines(
        missing,
        { ...fixtureDefaults(), media: { logo: null } },
        'upload-fixture',
      ),
    /Dropdown Upload labels are invalid/,
    'incomplete Dropdown Upload component copy fails compilation',
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
  for (const { widgetType } of discoverWidgetSpecs()) {
    const artifact = fs.readFileSync(
      path.join(repoRoot, 'roma/public/widget-editors', `${widgetType}.json`),
      'utf8',
    );
    assert.doesNotMatch(
      artifact,
      /diet-btn-menuactions[^>]*data-variant=/,
      `${widgetType} has one Menu Actions treatment`,
    );
    assert.doesNotMatch(
      artifact,
      /diet-btn-menuactions__label (?:body|label)-/,
      `${widgetType} lets Menu Actions own typography`,
    );
    assert.doesNotMatch(
      artifact,
      /diet-btn-menuactions__icon/,
      `${widgetType} uses the direct Dieter Icon structure`,
    );
    assert.doesNotMatch(
      artifact,
      /diet-dropdown-actions__check[^>]*data-size=/,
      `${widgetType} lets Menu Actions own checkmark size`,
    );
  }
  console.log('PASS compiled Menu Actions use one systemic unbound composition');
  testTooldrawerLabelContractsFailClosed();
  console.log('PASS ToolDrawer English label contracts fail closed');
  testSpecialCharactersRoundTripOnce();
  console.log('PASS editor labels round-trip special characters exactly once');
  testInvalidEditorContractsFail();
  console.log('PASS invalid editor contracts fail closed');
  testCompiledPanelLabelsFailClosed();
  console.log('PASS invalid compiled panel and ToolDrawer labels fail Builder open');
  await testDropdownUploadSingleValueContract();
  console.log('PASS Dropdown Upload binds one exact structured value');
  testDropdownUploadCopyJoin();
  console.log('PASS Dropdown Upload joins its exact Widget-owned component copy');
  testInsideShadowLinkOpsPreserveHiddenValues();
  console.log('PASS inside-shadow link edits preserve hidden shadow values');
}

void main();

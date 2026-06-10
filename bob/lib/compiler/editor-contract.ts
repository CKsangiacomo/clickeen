import { isRecord as isPlainObject } from '@clickeen/ck-contracts';
import type { ShellEditorSharedNodeId } from '@clickeen/widget-shell';
import { buildCoreSizeLayoutPanelFields } from './modules/coreSize';
import {
  buildHeaderAppearancePanelFields,
  buildHeaderContentPanelFields,
  buildHeaderLayoutPanelFields,
} from './modules/header';
import {
  buildCoreCardWrapperAppearancePanelFields,
  buildLocaleSwitcherAppearancePanelFields,
  buildStagePodAppearancePanelFields,
  buildStagePodCornerAppearanceFields,
  buildStagePodLayoutPanelFields,
} from './modules/stagePod';
import {
  buildLocaleSwitcherSettingsPanelFields,
  buildSettingsBehaviorPanelFields,
} from './modules/settings';
import { buildTypographyPanel } from './modules/typography';

type JsonObject = Record<string, unknown>;

type EditorCondition =
  | { path: string; op: 'equals' | 'notEquals'; value: string | number | boolean | null }
  | { path: string; op: 'isTrue' | 'isFalse' }
  | { path: string; op: 'in'; value: Array<string | number | boolean | null> }
  | { call: 'hasLinks'; args: Array<{ path: string }> }
  | { all: EditorCondition[] }
  | { any: EditorCondition[] };

type EditorTextNode = {
  kind: 'text';
  text: string;
};

type EditorElementNode = {
  kind: 'element';
  tag: string;
  attrs?: JsonObject;
  children?: EditorTemplateNode[];
};

export type EditorFieldNode = {
  kind: 'field';
  groupId?: string;
  type: string;
  path?: string;
  label?: string;
  attrs?: JsonObject;
  showIf?: EditorCondition;
  template?: EditorTemplateNode[];
};

export type EditorSharedNode = {
  kind: 'shared';
  id: ShellEditorSharedNodeId;
};

export type EditorTemplateNode = EditorTextNode | EditorElementNode | EditorFieldNode;
type EditorNode = EditorTemplateNode | EditorSharedNode;

type EditorCluster = {
  label?: string;
  labelKey?: string;
  labelParams?: JsonObject;
  labelCount?: string | number;
  showIf?: EditorCondition;
  attrs?: JsonObject;
  nodes: EditorNode[];
};

type EditorPanelItem = EditorCluster | EditorSharedNode;

type EditorPanel = {
  id: string;
  label?: string;
  shared?: { id: 'typography' };
  clusters?: EditorPanelItem[];
};

type EditorContract = {
  panels: EditorPanel[];
};

function encodeHtmlEntities(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAttrValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return encodeHtmlEntities(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return encodeHtmlEntities(String(value));
  return encodeHtmlEntities(JSON.stringify(value));
}

function renderAttrs(attrs: JsonObject | undefined): string {
  if (!attrs) return '';
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => `${key}='${renderAttrValue(value === true ? 'true' : value)}'`)
    .join(' ');
}

function formatConditionValue(value: string | number | boolean | null): string {
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (value === null) return 'null';
  return String(value);
}

export function renderEditorShowIf(condition: unknown): string {
  if (!isPlainObject(condition)) throw new Error('[BobCompiler] showIf must be an object');

  if (Array.isArray(condition.all)) {
    const parts = condition.all.map((part) => renderEditorShowIf(part));
    if (parts.length === 0) throw new Error('[BobCompiler] showIf.all must not be empty');
    return parts.join(' && ');
  }

  if (Array.isArray(condition.any)) {
    const parts = condition.any.map((part) => `(${renderEditorShowIf(part)})`);
    if (parts.length === 0) throw new Error('[BobCompiler] showIf.any must not be empty');
    return parts.join(' || ');
  }

  if (condition.call === 'hasLinks') {
    const args = Array.isArray(condition.args) ? condition.args : [];
    if (args.length === 0) throw new Error('[BobCompiler] showIf.hasLinks requires args');
    return `hasLinks(${args
      .map((arg) => {
        if (!isPlainObject(arg) || typeof arg.path !== 'string' || !arg.path.trim()) {
          throw new Error('[BobCompiler] showIf.hasLinks args require path');
        }
        return arg.path.trim();
      })
      .join(', ')})`;
  }

  const path =
    typeof condition.path === 'string' && condition.path.trim() ? condition.path.trim() : '';
  const op = typeof condition.op === 'string' ? condition.op : '';
  if (!path || !op) throw new Error('[BobCompiler] showIf requires path and op');

  if (op === 'isTrue') return `${path} == true`;
  if (op === 'isFalse') return `${path} == false`;

  if (op === 'equals')
    return `${path} == ${formatConditionValue((condition as { value?: unknown }).value as any)}`;
  if (op === 'notEquals')
    return `${path} != ${formatConditionValue((condition as { value?: unknown }).value as any)}`;

  if (op === 'in') {
    const values = (condition as { value?: unknown }).value;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('[BobCompiler] showIf.in requires a non-empty value array');
    }
    return values.map((value) => `${path} == ${formatConditionValue(value as any)}`).join(' || ');
  }

  throw new Error(`[BobCompiler] Unsupported showIf op: ${op}`);
}

function assertFieldNode(node: unknown, widgetname: string): asserts node is EditorFieldNode {
  if (!isPlainObject(node))
    throw new Error(`[BobCompiler] ${widgetname} editor field must be an object`);
  if (node.kind !== 'field')
    throw new Error(`[BobCompiler] ${widgetname} editor node kind must be field`);
  if (typeof node.type !== 'string' || !node.type.trim()) {
    throw new Error(`[BobCompiler] ${widgetname} editor field missing type`);
  }
  if (node.path !== undefined && (typeof node.path !== 'string' || !node.path.trim())) {
    throw new Error(`[BobCompiler] ${widgetname} editor field path must be a non-empty string`);
  }
  if (node.attrs !== undefined && !isPlainObject(node.attrs)) {
    throw new Error(`[BobCompiler] ${widgetname} editor field attrs must be an object`);
  }
  if (node.template !== undefined && !Array.isArray(node.template)) {
    throw new Error(`[BobCompiler] ${widgetname} editor field template must be an array`);
  }
}

function renderFieldNode(node: EditorFieldNode): string {
  assertFieldNode(node, 'widget');
  const attrs: JsonObject = {
    ...(node.attrs ?? {}),
    type: node.type,
    ...(node.path ? { path: node.path } : {}),
    ...(node.label ? { label: node.label } : {}),
  };
  if (node.showIf) attrs['show-if'] = renderEditorShowIf(node.showIf);
  if (node.template) attrs.template = renderTemplateNodes(node.template);

  const attrsText = renderAttrs(attrs);
  const tag = `tooldrawer-field${node.groupId ? `-${node.groupId}` : ''}`;
  return attrsText ? `<${tag} ${attrsText} />` : `<${tag} />`;
}

function renderElementNode(node: EditorElementNode): string {
  if (typeof node.tag !== 'string' || !/^[a-z][a-z0-9-]*$/i.test(node.tag)) {
    throw new Error('[BobCompiler] editor template element tag is invalid');
  }
  const attrsText = renderAttrs(node.attrs);
  const children = renderTemplateNodes(node.children ?? []);
  return `<${node.tag}${attrsText ? ` ${attrsText}` : ''}>${children}</${node.tag}>`;
}

function renderTemplateNodes(nodes: EditorTemplateNode[]): string {
  return nodes
    .map((node) => {
      if (!isPlainObject(node))
        throw new Error('[BobCompiler] editor template node must be an object');
      if (node.kind === 'text')
        return encodeHtmlEntities(typeof node.text === 'string' ? node.text : '');
      if (node.kind === 'element') return renderElementNode(node as EditorElementNode);
      if (node.kind === 'field') return renderFieldNode(node as EditorFieldNode);
      throw new Error(
        `[BobCompiler] Unsupported editor template node kind: ${String((node as any).kind)}`,
      );
    })
    .join('');
}

function renderSharedNode(node: EditorSharedNode, defaults: JsonObject): string[] {
  const includeCta = defaults.headerCta != null;
  switch (node.id) {
    case 'header-content':
      return buildHeaderContentPanelFields({ includeCta });
    case 'header-content-no-header-cta':
      return buildHeaderContentPanelFields({ includeCta: false });
    case 'header-layout':
      return buildHeaderLayoutPanelFields({ includeCta });
    case 'header-layout-no-header-cta':
      return buildHeaderLayoutPanelFields({ includeCta: false });
    case 'core-size':
      return buildCoreSizeLayoutPanelFields(defaults);
    case 'header-appearance':
      return buildHeaderAppearancePanelFields({ includeCta });
    case 'header-appearance-no-header-cta':
      return buildHeaderAppearancePanelFields({ includeCta: false });
    case 'stagepod-layout':
      return buildStagePodLayoutPanelFields({
        includeFloating: isPlainObject(defaults.stage) && isPlainObject(defaults.stage.floating),
      });
    case 'stagepod-appearance': {
      const appearance = isPlainObject(defaults.appearance) ? defaults.appearance : null;
      return buildStagePodAppearancePanelFields({
        includePodBorder: isPlainObject(appearance?.podBorder),
      });
    }
    case 'stagepod-corners':
      return buildStagePodCornerAppearanceFields();
    case 'settings-behavior':
      return buildSettingsBehaviorPanelFields();
    default: {
      const exhaustive: never = node.id;
      throw new Error(`[BobCompiler] Unsupported shared editor control: ${exhaustive}`);
    }
  }
}

function collectEditorFieldPaths(value: unknown): Set<string> {
  const paths = new Set<string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isPlainObject(node)) return;
    if (node.kind === 'field' && typeof node.path === 'string' && node.path.trim()) {
      paths.add(node.path.trim());
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  return paths;
}

function readRecordPath(root: JsonObject, path: string): JsonObject | null {
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (const part of parts) {
    if (!isPlainObject(cursor)) return null;
    cursor = cursor[part];
  }
  return isPlainObject(cursor) ? cursor : null;
}

function resolveCardWrapperPath(
  defaults: JsonObject,
  widgetname: string,
): { basePath: string; hasInsideShadow: boolean; itemLabel?: string } | null {
  const candidates = [`${widgetname}.appearance.cardwrapper`];
  const coreLabel =
    isPlainObject(defaults.uiLabels) &&
    isPlainObject(defaults.uiLabels.core) &&
    typeof defaults.uiLabels.core.singular === 'string'
      ? defaults.uiLabels.core.singular.trim()
      : '';
  for (const basePath of candidates) {
    if (readRecordPath(defaults, basePath)) {
      return {
        basePath,
        hasInsideShadow: Boolean(readRecordPath(defaults, `${basePath}.insideShadow`)),
        itemLabel: coreLabel || undefined,
      };
    }
  }
  return null;
}

function renderCluster(cluster: EditorCluster, defaults: JsonObject): string[] {
  if (!Array.isArray(cluster.nodes))
    throw new Error('[BobCompiler] editor cluster missing nodes array');
  const attrs: JsonObject = {
    ...(cluster.attrs ?? {}),
    ...(cluster.label ? { label: cluster.label } : {}),
    ...(cluster.labelKey ? { 'label-key': cluster.labelKey } : {}),
    ...(cluster.labelParams ? { 'label-params': cluster.labelParams } : {}),
    ...(cluster.labelCount !== undefined ? { 'label-count': cluster.labelCount } : {}),
  };
  if (cluster.showIf) attrs['show-if'] = renderEditorShowIf(cluster.showIf);

  const lines: string[] = [
    `  <tooldrawer-cluster${renderAttrs(attrs) ? ` ${renderAttrs(attrs)}` : ''}>`,
  ];
  cluster.nodes.forEach((node) => {
    if (!isPlainObject(node)) throw new Error('[BobCompiler] editor node must be an object');
    if (node.kind === 'shared') {
      renderSharedNode(node as EditorSharedNode, defaults).forEach((line) => lines.push(line));
      return;
    }
    if (node.kind === 'field') {
      lines.push(`    ${renderFieldNode(node as EditorFieldNode)}`);
      return;
    }
    if (node.kind === 'element' || node.kind === 'text') {
      throw new Error(
        '[BobCompiler] top-level editor clusters may only contain field or shared nodes',
      );
    }
    throw new Error(`[BobCompiler] Unsupported editor node kind: ${String((node as any).kind)}`);
  });
  lines.push('  </tooldrawer-cluster>');
  return lines;
}

function renderPanel(
  panel: EditorPanel,
  defaults: JsonObject,
  widgetname: string,
  editorFieldPaths: ReadonlySet<string>,
): string[] {
  if (typeof panel.id !== 'string' || !panel.id.trim()) {
    throw new Error(`[BobCompiler] ${widgetname} editor panel missing id`);
  }

  if (panel.shared?.id === 'typography') {
    const typography = isPlainObject(defaults.typography) ? defaults.typography : null;
    const roles = typography && isPlainObject(typography.roles) ? typography.roles : null;
    if (!roles)
      throw new Error(
        `[BobCompiler] ${widgetname} typography panel requires defaults.typography.roles`,
      );
    const roleScales =
      typography && isPlainObject(typography.roleScales)
        ? (typography.roleScales as any)
        : undefined;
    const rendered = buildTypographyPanel({ roles, roleScales });
    if (rendered.length === 0)
      throw new Error(`[BobCompiler] ${widgetname} typography panel produced no controls`);
    return rendered;
  }

  if (!Array.isArray(panel.clusters)) {
    throw new Error(
      `[BobCompiler] ${widgetname} editor panel "${panel.id}" missing clusters array`,
    );
  }

  let injectedCoreCardWrapper = false;
  let injectedLocaleAppearance = false;
  let injectedLocaleSettings = false;
  const cardWrapper = resolveCardWrapperPath(defaults, widgetname);

  const lines = panel.clusters.flatMap((item) => {
    if (!isPlainObject(item))
      throw new Error(`[BobCompiler] ${widgetname} editor panel item must be an object`);
    if ('kind' in item && item.kind === 'shared') {
      const sharedNode = item as EditorSharedNode;
      const injected: string[] = [];
      if (panel.id === 'appearance' && sharedNode.id === 'stagepod-appearance') {
        if (!injectedLocaleAppearance) {
          injected.push(...buildLocaleSwitcherAppearancePanelFields(editorFieldPaths));
          injectedLocaleAppearance = true;
        }
        if (cardWrapper && !injectedCoreCardWrapper) {
          injected.push(
            ...buildCoreCardWrapperAppearancePanelFields({
              basePath: cardWrapper.basePath,
              existingPaths: editorFieldPaths,
              includeInsideShadow: cardWrapper.hasInsideShadow,
              itemLabel: cardWrapper.itemLabel,
            }),
          );
          injectedCoreCardWrapper = true;
        }
      }
      if (
        panel.id === 'settings' &&
        sharedNode.id === 'settings-behavior' &&
        !injectedLocaleSettings
      ) {
        injected.push(...buildLocaleSwitcherSettingsPanelFields(editorFieldPaths));
        injectedLocaleSettings = true;
      }
      return [...injected, ...renderSharedNode(sharedNode, defaults)];
    }
    return renderCluster(item as EditorCluster, defaults);
  });

  return [`<bob-panel id='${encodeHtmlEntities(panel.id)}'>`, ...lines, '</bob-panel>'];
}

export function buildEditorHtmlLines(
  editorRaw: unknown,
  defaults: JsonObject,
  widgetname: string,
): string[] {
  if (!isPlainObject(editorRaw)) {
    throw new Error(`[BobCompiler] ${widgetname} spec.json missing editor object`);
  }
  const editor = editorRaw as EditorContract;
  if (!Array.isArray(editor.panels) || editor.panels.length === 0) {
    throw new Error(
      `[BobCompiler] ${widgetname} spec.json editor.panels must be a non-empty array`,
    );
  }
  const editorFieldPaths = collectEditorFieldPaths(editor);
  return editor.panels.flatMap((panel) =>
    renderPanel(panel, defaults, widgetname, editorFieldPaths),
  );
}

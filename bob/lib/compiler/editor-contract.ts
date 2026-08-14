import { isRecord as isPlainObject } from '@clickeen/ck-contracts';
import type { WidgetSharedEditorNodeId } from '@clickeen/widget-foundation';
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
import { encodeHtmlEntities } from '../compiler.shared';
import { BOB_WIDGET_PANEL_IDS, isPanelId } from '../types';

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
  id: WidgetSharedEditorNodeId;
};

export type EditorTemplateNode = EditorTextNode | EditorElementNode | EditorFieldNode;
type EditorNode = EditorTemplateNode | EditorSharedNode;

type EditorCluster = {
  label: string;
  initiallyOpen?: boolean;
  showIf?: EditorCondition;
  attrs?: JsonObject;
  nodes: EditorNode[];
};

type EditorPanelItem = EditorCluster | EditorSharedNode;

type EditorPanel = {
  id: string;
  shared?: { id: 'typography'; roleLabels?: Record<string, string> };
  clusters?: EditorPanelItem[];
};

type EditorContract = {
  labels?: unknown;
  panels: EditorPanel[];
};

type DropdownBorderEditorLabels = {
  component: {
    color: string;
    defaultColors: string;
    enabled: string;
    hex: string;
    hue: string;
    width: string;
  };
  fields: Record<string, string>;
};

const DROPDOWN_FILL_COMPONENT_LABEL_ATTRIBUTES = [
  ['addGradientStop', 'add-gradient-stop-label'],
  ['angle', 'angle-label'],
  ['chooseAssets', 'choose-assets-label'],
  ['color', 'color-label'],
  ['colorFill', 'color-fill-label'],
  ['defaultColors', 'default-colors-label'],
  ['editGradientStop', 'edit-gradient-stop-label'],
  ['enabled', 'enabled-label'],
  ['gradientFill', 'gradient-fill-label'],
  ['gradientStops', 'gradient-stops-label'],
  ['hex', 'hex-label'],
  ['hue', 'hue-label'],
  ['imageFill', 'image-fill-label'],
  ['loadAssetsError', 'load-assets-error-label'],
  ['loadingAssets', 'loading-assets-label'],
  ['noAssets', 'no-assets-label'],
  ['opacity', 'opacity-label'],
  ['previewAssetError', 'preview-asset-error-label'],
  ['removeAsset', 'remove-asset-label'],
  ['removeGradientStop', 'remove-gradient-stop-label'],
  ['upload', 'upload-label'],
  ['uploadAssetError', 'upload-asset-error-label'],
  ['useAsset', 'use-asset-label'],
  ['videoFill', 'video-fill-label'],
] as const;

type DropdownFillEditorLabels = {
  component: Record<(typeof DROPDOWN_FILL_COMPONENT_LABEL_ATTRIBUTES)[number][0], string>;
  fields: Record<string, string>;
};

const DROPDOWN_UPLOAD_COMPONENT_LABEL_ATTRIBUTES = [
  ['previewAssetError', 'preview-asset-error-label'],
  ['remove', 'remove-label'],
  ['replace', 'replace-label'],
  ['upload', 'upload-label'],
  ['uploadAssetError', 'upload-asset-error-label'],
] as const;

type DropdownUploadEditorLabels = Record<
  (typeof DROPDOWN_UPLOAD_COMPONENT_LABEL_ATTRIBUTES)[number][0],
  string
>;

const DROPDOWN_SHADOW_COMPONENT_LABEL_ATTRIBUTES = [
  ['blur', 'blur-label'],
  ['color', 'color-label'],
  ['defaultColors', 'default-colors-label'],
  ['enabled', 'enabled-label'],
  ['hex', 'hex-label'],
  ['horizontal', 'horizontal-label'],
  ['hue', 'hue-label'],
  ['opacity', 'opacity-label'],
  ['preview', 'preview-label'],
  ['spread', 'spread-label'],
  ['vertical', 'vertical-label'],
] as const;

const DROPDOWN_SHADOW_COMPOSITION_LABEL_KEYS = ['aboveContent', 'belowContent', 'layer'] as const;

type DropdownShadowEditorLabels = {
  component: Record<
    | (typeof DROPDOWN_SHADOW_COMPONENT_LABEL_ATTRIBUTES)[number][0]
    | (typeof DROPDOWN_SHADOW_COMPOSITION_LABEL_KEYS)[number],
    string
  >;
  fields: Record<string, string>;
};

const DROPDOWN_EDIT_COMPONENT_LABEL_ATTRIBUTES = [
  ['addLink', 'add-link-label'],
  ['bold', 'bold-label'],
  ['clearFormatting', 'clear-formatting-label'],
  ['closeLink', 'close-link-label'],
  ['italic', 'italic-label'],
  ['link', 'link-label'],
  ['removeLink', 'remove-link-label'],
  ['strikethrough', 'strikethrough-label'],
  ['underline', 'underline-label'],
  ['url', 'url-label'],
] as const;

type DropdownEditResolvedLabel = {
  attribute: (typeof DROPDOWN_EDIT_COMPONENT_LABEL_ATTRIBUTES)[number][1];
  value: string;
};

const OBJECT_MANAGER_COMPONENT_LABEL_ATTRIBUTES = [
  ['cancel', 'cancel-label'],
  ['save', 'save-label'],
  ['discardTitle', 'discard-title'],
  ['discardMessage', 'discard-message'],
  ['keepEditing', 'keep-editing-label'],
  ['discard', 'discard-label'],
  ['moveUp', 'move-up-label'],
  ['moveDown', 'move-down-label'],
  ['delete', 'delete-label'],
] as const;

type ObjectManagerEditorLabels = {
  component: Record<(typeof OBJECT_MANAGER_COMPONENT_LABEL_ATTRIBUTES)[number][0], string>;
  fields: Record<string, string>;
};

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
  if (
    node.groupId !== undefined &&
    (typeof node.groupId !== 'string' || !/^[a-z][a-z0-9-]*$/.test(node.groupId))
  ) {
    throw new Error(`[BobCompiler] ${widgetname} editor field groupId is invalid`);
  }
  if (node.template !== undefined && !Array.isArray(node.template)) {
    throw new Error(`[BobCompiler] ${widgetname} editor field template must be an array`);
  }
}

function renderFieldNode(
  node: EditorFieldNode,
  dropdownEditLabels: DropdownEditResolvedLabel[] | null,
): string {
  assertFieldNode(node, 'widget');
  const attrs: JsonObject = {
    ...(node.attrs ?? {}),
    ...(node.type === 'dropdown-edit' && dropdownEditLabels
      ? Object.fromEntries(dropdownEditLabels.map(({ attribute, value }) => [attribute, value]))
      : {}),
    type: node.type,
    ...(node.path ? { path: node.path } : {}),
    ...(node.label ? { label: node.label } : {}),
  };
  if (node.showIf) attrs['show-if'] = renderEditorShowIf(node.showIf);
  if (node.template) attrs.template = renderTemplateNodes(node.template, dropdownEditLabels);

  const attrsText = renderAttrs(attrs);
  const tag = `tooldrawer-field${node.groupId ? `-${node.groupId}` : ''}`;
  return attrsText ? `<${tag} ${attrsText} />` : `<${tag} />`;
}

function renderElementNode(
  node: EditorElementNode,
  dropdownEditLabels: DropdownEditResolvedLabel[] | null,
): string {
  if (typeof node.tag !== 'string' || !/^[a-z][a-z0-9-]*$/i.test(node.tag)) {
    throw new Error('[BobCompiler] editor template element tag is invalid');
  }
  const attrsText = renderAttrs(node.attrs);
  const children = renderTemplateNodes(node.children ?? [], dropdownEditLabels);
  return `<${node.tag}${attrsText ? ` ${attrsText}` : ''}>${children}</${node.tag}>`;
}

function renderTemplateNodes(
  nodes: EditorTemplateNode[],
  dropdownEditLabels: DropdownEditResolvedLabel[] | null,
): string {
  return nodes
    .map((node) => {
      if (!isPlainObject(node))
        throw new Error('[BobCompiler] editor template node must be an object');
      if (node.kind === 'text')
        return encodeHtmlEntities(typeof node.text === 'string' ? node.text : '');
      if (node.kind === 'element')
        return renderElementNode(node as EditorElementNode, dropdownEditLabels);
      if (node.kind === 'field')
        return renderFieldNode(node as EditorFieldNode, dropdownEditLabels);
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

function containsEditorFieldType(value: unknown, type: string): boolean {
  if (Array.isArray(value)) return value.some((item) => containsEditorFieldType(item, type));
  if (!isPlainObject(value)) return false;
  if (value.kind === 'field' && value.type === type) return true;
  return Object.values(value).some((item) => containsEditorFieldType(item, type));
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

function renderCluster(
  cluster: EditorCluster,
  defaults: JsonObject,
  dropdownEditLabels: DropdownEditResolvedLabel[] | null,
): string[] {
  if (!Array.isArray(cluster.nodes))
    throw new Error('[BobCompiler] editor cluster missing nodes array');
  const hasLabel = typeof cluster.label === 'string' && Boolean(cluster.label.trim());
  if (!hasLabel) {
    throw new Error('[BobCompiler] editor cluster label must be a non-empty string');
  }
  if (cluster.initiallyOpen !== undefined && typeof cluster.initiallyOpen !== 'boolean') {
    throw new Error('[BobCompiler] editor cluster initiallyOpen must be boolean');
  }
  const attrs: JsonObject = {
    ...(cluster.attrs ?? {}),
    label: cluster.label,
    ...(cluster.initiallyOpen === true ? { 'initially-open': true } : {}),
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
      lines.push(`    ${renderFieldNode(node as EditorFieldNode, dropdownEditLabels)}`);
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
  dropdownEditLabels: DropdownEditResolvedLabel[] | null,
): string[] {
  if (typeof panel.id !== 'string' || !isPanelId(panel.id) || panel.id === 'translations') {
    throw new Error(`[BobCompiler] ${widgetname} editor panel has unsupported id`);
  }

  if (panel.shared?.id === 'typography') {
    const typography = isPlainObject(defaults.typography) ? defaults.typography : null;
    const roles = typography && isPlainObject(typography.roles) ? typography.roles : null;
    if (!roles)
      throw new Error(
        `[BobCompiler] ${widgetname} typography panel requires defaults.typography.roles`,
      );
    let roleLabels: Record<string, string> | undefined;
    if (panel.shared.roleLabels !== undefined) {
      if (!isPlainObject(panel.shared.roleLabels)) {
        throw new Error(`[BobCompiler] ${widgetname} typography roleLabels must be an object`);
      }
      roleLabels = {};
      for (const [roleKey, label] of Object.entries(panel.shared.roleLabels)) {
        if (!roleKey.trim() || typeof label !== 'string' || !label.trim()) {
          throw new Error(
            `[BobCompiler] ${widgetname} typography roleLabels must contain non-empty strings`,
          );
        }
        roleLabels[roleKey] = label.trim();
      }
    }
    const rendered = buildTypographyPanel({ roles, roleLabels });
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
    return renderCluster(item as EditorCluster, defaults, dropdownEditLabels);
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
  const panelIds = editor.panels.map((panel) =>
    isPlainObject(panel) && typeof panel.id === 'string' ? panel.id : '',
  );
  if (
    panelIds.length !== BOB_WIDGET_PANEL_IDS.length ||
    new Set(panelIds).size !== panelIds.length ||
    BOB_WIDGET_PANEL_IDS.some((panelId) => !panelIds.includes(panelId))
  ) {
    throw new Error(
      `[BobCompiler] ${widgetname} editor must declare the canonical panels: ${BOB_WIDGET_PANEL_IDS.join(', ')}`,
    );
  }
  const editorFieldPaths = collectEditorFieldPaths(editor);
  let dropdownEditLabels = containsEditorFieldType(editor, 'dropdown-edit')
    ? readDropdownEditEditorLabels(editor.labels, widgetname)
    : null;
  const panelsById = new Map(editor.panels.map((panel) => [panel.id, panel]));
  const lines = BOB_WIDGET_PANEL_IDS.flatMap((panelId) =>
    renderPanel(
      panelsById.get(panelId)!,
      defaults,
      widgetname,
      editorFieldPaths,
      dropdownEditLabels,
    ),
  );
  if (!dropdownEditLabels && lines.some((line) => /\btype='dropdown-edit'/.test(line))) {
    dropdownEditLabels = readDropdownEditEditorLabels(editor.labels, widgetname);
  }
  return applyDropdownEditEditorLabels(
    applyObjectManagerEditorLabels(
      applyDropdownUploadEditorLabels(
        applyDropdownShadowEditorLabels(
          applyDropdownFillEditorLabels(
            applyDropdownBorderEditorLabels(lines, editor.labels, widgetname),
            editor.labels,
            widgetname,
          ),
          editor.labels,
          widgetname,
        ),
        editor.labels,
        widgetname,
      ),
      editor.labels,
      widgetname,
    ),
    dropdownEditLabels,
  );
}

function readObjectManagerEditorLabels(
  labelsRaw: unknown,
  widgetname: string,
): ObjectManagerEditorLabels {
  if (
    !isPlainObject(labelsRaw) ||
    !isPlainObject(labelsRaw.components) ||
    !isPlainObject(labelsRaw.fields)
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Object Manager labels are missing`);
  }
  const component = labelsRaw.components['object-manager'];
  const fields = labelsRaw.fields['object-manager'];
  const expected = OBJECT_MANAGER_COMPONENT_LABEL_ATTRIBUTES.map(([key]) => key).sort();
  if (
    !isPlainObject(component) ||
    Object.keys(component).sort().join('\0') !== expected.join('\0') ||
    !isPlainObject(fields)
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Object Manager labels are invalid`);
  }
  const read = (value: unknown, path: string): string => {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Object Manager label is invalid: ${path}`);
    }
    return value;
  };
  const resolvedComponent = {} as ObjectManagerEditorLabels['component'];
  for (const [key] of OBJECT_MANAGER_COMPONENT_LABEL_ATTRIBUTES) {
    resolvedComponent[key] = read(component[key], `components.object-manager.${key}`);
  }
  const resolvedFields: Record<string, string> = {};
  for (const [path, value] of Object.entries(fields)) {
    if (!path.trim() || path !== path.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Object Manager field path is invalid`);
    }
    resolvedFields[path] = read(value, `fields.object-manager.${path}`);
  }
  return { component: resolvedComponent, fields: resolvedFields };
}

function applyObjectManagerEditorLabels(
  lines: string[],
  labelsRaw: unknown,
  widgetname: string,
): string[] {
  if (!lines.some((line) => /\btype='object-manager'/.test(line))) return lines;
  const labels = readObjectManagerEditorLabels(labelsRaw, widgetname);
  const usedPaths = new Set<string>();
  const componentAttributes = OBJECT_MANAGER_COMPONENT_LABEL_ATTRIBUTES.map(
    ([key, attribute]) => `${attribute}='${encodeHtmlEntities(labels.component[key])}'`,
  ).join(' ');
  const rendered = lines.map((line) => {
    if (!/\btype='object-manager'/.test(line)) return line;
    const path = line.match(/(?:^|\s)path='([^']+)'/)?.[1] ?? '';
    const itemLabel = labels.fields[path];
    if (!itemLabel) {
      throw new Error(`[BobCompiler] ${widgetname} Object Manager item label is missing: ${path}`);
    }
    usedPaths.add(path);
    return line.replace(
      /\s*\/>$/,
      ` item-label='${encodeHtmlEntities(itemLabel)}' ${componentAttributes} />`,
    );
  });
  const unused = Object.keys(labels.fields).filter((path) => !usedPaths.has(path));
  if (unused.length) {
    throw new Error(
      `[BobCompiler] ${widgetname} Object Manager field labels are unused: ${unused.join(', ')}`,
    );
  }
  return rendered;
}

function readDropdownUploadEditorLabels(
  labelsRaw: unknown,
  widgetname: string,
): DropdownUploadEditorLabels {
  if (!isPlainObject(labelsRaw) || !isPlainObject(labelsRaw.components)) {
    throw new Error(`[BobCompiler] ${widgetname} Dropdown Upload labels are missing`);
  }
  const component = labelsRaw.components['dropdown-upload'];
  const expectedKeys = DROPDOWN_UPLOAD_COMPONENT_LABEL_ATTRIBUTES.map(([key]) => key).sort();
  if (
    !isPlainObject(component) ||
    Object.keys(component).sort().join('\0') !== expectedKeys.join('\0')
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Dropdown Upload labels are invalid`);
  }
  const labels = {} as DropdownUploadEditorLabels;
  for (const [key] of DROPDOWN_UPLOAD_COMPONENT_LABEL_ATTRIBUTES) {
    const value = component[key];
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Upload label is invalid: ${key}`);
    }
    labels[key] = value;
  }
  return labels;
}

function applyDropdownUploadEditorLabels(
  lines: string[],
  labelsRaw: unknown,
  widgetname: string,
): string[] {
  if (!lines.some((line) => /\btype='dropdown-upload'/.test(line))) return lines;
  const labels = readDropdownUploadEditorLabels(labelsRaw, widgetname);
  const attributes = DROPDOWN_UPLOAD_COMPONENT_LABEL_ATTRIBUTES.map(
    ([key, attribute]) => `${attribute}='${encodeHtmlEntities(labels[key])}'`,
  ).join(' ');
  return lines.map((line) =>
    /\btype='dropdown-upload'/.test(line) ? line.replace(/\s*\/>$/, ` ${attributes} />`) : line,
  );
}

function readDropdownShadowEditorLabels(
  labelsRaw: unknown,
  widgetname: string,
): DropdownShadowEditorLabels {
  if (
    !isPlainObject(labelsRaw) ||
    !isPlainObject(labelsRaw.components) ||
    !isPlainObject(labelsRaw.fields)
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Dropdown Shadow labels are missing`);
  }
  const component = labelsRaw.components['dropdown-shadow'];
  const fields = labelsRaw.fields['dropdown-shadow'];
  const expectedKeys = [
    ...DROPDOWN_SHADOW_COMPONENT_LABEL_ATTRIBUTES.map(([key]) => key),
    ...DROPDOWN_SHADOW_COMPOSITION_LABEL_KEYS,
  ].sort();
  if (
    !isPlainObject(component) ||
    Object.keys(component).sort().join('\0') !== expectedKeys.join('\0') ||
    !isPlainObject(fields)
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Dropdown Shadow labels are invalid`);
  }
  const readLabel = (value: unknown, path: string): string => {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Shadow label is invalid: ${path}`);
    }
    return value;
  };
  const resolvedComponent = {} as DropdownShadowEditorLabels['component'];
  for (const [key] of DROPDOWN_SHADOW_COMPONENT_LABEL_ATTRIBUTES) {
    resolvedComponent[key] = readLabel(component[key], `components.dropdown-shadow.${key}`);
  }
  for (const key of DROPDOWN_SHADOW_COMPOSITION_LABEL_KEYS) {
    resolvedComponent[key] = readLabel(component[key], `components.dropdown-shadow.${key}`);
  }
  const resolvedFields: Record<string, string> = {};
  for (const [path, value] of Object.entries(fields)) {
    if (!path.trim() || path !== path.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Shadow field path is invalid`);
    }
    resolvedFields[path] = readLabel(value, `fields.dropdown-shadow.${path}`);
  }
  return { component: resolvedComponent, fields: resolvedFields };
}

function applyDropdownShadowEditorLabels(
  lines: string[],
  labelsRaw: unknown,
  widgetname: string,
): string[] {
  if (!lines.some((line) => /\btype='dropdown-shadow'/.test(line))) return lines;
  const labels = readDropdownShadowEditorLabels(labelsRaw, widgetname);
  const usedFieldPaths = new Set<string>();
  const insideShadowOptions = encodeHtmlEntities(
    JSON.stringify([
      { label: labels.component.belowContent, value: 'below-content' },
      { label: labels.component.aboveContent, value: 'above-content' },
    ]),
  );
  const rendered = lines.map((line) => {
    const path = line.match(/\bpath='([^']+)'/)?.[1] ?? '';
    if (path.endsWith('.insideShadow.linked')) {
      const fieldLabel = labels.fields[path];
      if (!fieldLabel) {
        throw new Error(`[BobCompiler] ${widgetname} inside-shadow link label is missing: ${path}`);
      }
      usedFieldPaths.add(path);
      return line.replace(/(^|\s)label='[^']*'/, `$1label='${encodeHtmlEntities(fieldLabel)}'`);
    }
    if (path.endsWith('.insideShadow.layer')) {
      return line
        .replace(/(^|\s)label='[^']*'/, `$1label='${encodeHtmlEntities(labels.component.layer)}'`)
        .replace(/(^|\s)options='[^']*'/, `$1options='${insideShadowOptions}'`);
    }
    if (!/\btype='dropdown-shadow'/.test(line)) return line;
    const authoredLabel = line.match(/(?:^|\s)label='([^']*)'/)?.[1] ?? '';
    let next = line;
    if (!authoredLabel) {
      const fieldLabel = labels.fields[path];
      if (!fieldLabel) {
        throw new Error(
          `[BobCompiler] ${widgetname} Dropdown Shadow field label is missing: ${path}`,
        );
      }
      usedFieldPaths.add(path);
      next = next.replace(/(^|\s)label=''/, `$1label='${encodeHtmlEntities(fieldLabel)}'`);
    }
    const componentAttrs = DROPDOWN_SHADOW_COMPONENT_LABEL_ATTRIBUTES.map(
      ([key, attribute]) => `${attribute}='${encodeHtmlEntities(labels.component[key])}'`,
    ).join(' ');
    return next.replace(/\s*\/>$/, ` ${componentAttrs} />`);
  });
  const unusedPaths = Object.keys(labels.fields).filter((path) => !usedFieldPaths.has(path));
  if (unusedPaths.length > 0) {
    throw new Error(
      `[BobCompiler] ${widgetname} Dropdown Shadow field labels are unused: ${unusedPaths.join(', ')}`,
    );
  }
  return rendered;
}

function readDropdownFillEditorLabels(
  labelsRaw: unknown,
  widgetname: string,
): DropdownFillEditorLabels {
  if (
    !isPlainObject(labelsRaw) ||
    !isPlainObject(labelsRaw.components) ||
    !isPlainObject(labelsRaw.fields)
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Dropdown Fill labels are missing`);
  }
  const component = labelsRaw.components['dropdown-fill'];
  const fields = labelsRaw.fields['dropdown-fill'];
  const expectedKeys = DROPDOWN_FILL_COMPONENT_LABEL_ATTRIBUTES.map(([key]) => key).sort();
  if (
    !isPlainObject(component) ||
    Object.keys(component).sort().join('\0') !== expectedKeys.join('\0') ||
    !isPlainObject(fields)
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Dropdown Fill labels are invalid`);
  }
  const readLabel = (value: unknown, path: string): string => {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Fill label is invalid: ${path}`);
    }
    return value;
  };
  const resolvedComponent = {} as DropdownFillEditorLabels['component'];
  for (const [key] of DROPDOWN_FILL_COMPONENT_LABEL_ATTRIBUTES) {
    resolvedComponent[key] = readLabel(component[key], `components.dropdown-fill.${key}`);
  }
  const resolvedFields: Record<string, string> = {};
  for (const [path, value] of Object.entries(fields)) {
    if (!path.trim() || path !== path.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Fill field path is invalid`);
    }
    resolvedFields[path] = readLabel(value, `fields.dropdown-fill.${path}`);
  }
  return { component: resolvedComponent, fields: resolvedFields };
}

function applyDropdownFillEditorLabels(
  lines: string[],
  labelsRaw: unknown,
  widgetname: string,
): string[] {
  if (!lines.some((line) => /\btype='dropdown-fill'/.test(line))) return lines;
  const labels = readDropdownFillEditorLabels(labelsRaw, widgetname);
  const usedFieldPaths = new Set<string>();
  const rendered = lines.map((line) => {
    if (!/\btype='dropdown-fill'/.test(line)) return line;
    const path = line.match(/\bpath='([^']+)'/)?.[1] ?? '';
    const authoredLabel = line.match(/(?:^|\s)label='([^']*)'/)?.[1] ?? '';
    let next = line;
    if (!authoredLabel) {
      const fieldLabel = labels.fields[path];
      if (!fieldLabel) {
        throw new Error(
          `[BobCompiler] ${widgetname} Dropdown Fill field label is missing: ${path}`,
        );
      }
      usedFieldPaths.add(path);
      next = next.replace(/(^|\s)label=''/, `$1label='${encodeHtmlEntities(fieldLabel)}'`);
    }
    const componentAttrs = DROPDOWN_FILL_COMPONENT_LABEL_ATTRIBUTES.map(
      ([key, attribute]) => `${attribute}='${encodeHtmlEntities(labels.component[key])}'`,
    ).join(' ');
    return next.replace(/\s*\/>$/, ` ${componentAttrs} />`);
  });
  const unusedPaths = Object.keys(labels.fields).filter((path) => !usedFieldPaths.has(path));
  if (unusedPaths.length > 0) {
    throw new Error(
      `[BobCompiler] ${widgetname} Dropdown Fill field labels are unused: ${unusedPaths.join(', ')}`,
    );
  }
  return rendered;
}

function readDropdownEditEditorLabels(
  labelsRaw: unknown,
  widgetname: string,
): DropdownEditResolvedLabel[] {
  if (!isPlainObject(labelsRaw) || !isPlainObject(labelsRaw.components)) {
    throw new Error(`[BobCompiler] ${widgetname} resolved editor component labels are missing`);
  }
  const labels = labelsRaw.components['dropdown-edit'];
  if (
    !isPlainObject(labels) ||
    Object.keys(labels).sort().join('\0') !==
      DROPDOWN_EDIT_COMPONENT_LABEL_ATTRIBUTES.map(([key]) => key)
        .sort()
        .join('\0')
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Dropdown Edit component labels are invalid`);
  }
  return DROPDOWN_EDIT_COMPONENT_LABEL_ATTRIBUTES.map(([key, attribute]) => {
    const value = labels[key];
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Edit label is invalid: ${key}`);
    }
    return { attribute, value };
  });
}

function applyDropdownEditEditorLabels(
  lines: string[],
  resolvedLabels: DropdownEditResolvedLabel[] | null,
): string[] {
  if (!resolvedLabels) return lines;
  const attributes = resolvedLabels
    .map(({ attribute, value }) => `${attribute}='${encodeHtmlEntities(value)}'`)
    .join(' ');

  return lines.map((line) =>
    /\btype='dropdown-edit'/.test(line) && !/\badd-link-label=/.test(line)
      ? line.replace(/\s*\/>$/, ` ${attributes} />`)
      : line,
  );
}

function readDropdownBorderEditorLabels(
  labelsRaw: unknown,
  widgetname: string,
): DropdownBorderEditorLabels | null {
  if (labelsRaw === undefined) return null;
  if (!isPlainObject(labelsRaw)) {
    throw new Error(`[BobCompiler] ${widgetname} resolved editor labels must be an object`);
  }
  const components = labelsRaw.components;
  const fields = labelsRaw.fields;
  const component = isPlainObject(components) ? components['dropdown-border'] : null;
  const fieldLabels = isPlainObject(fields) ? fields['dropdown-border'] : null;
  if (component == null && fieldLabels == null) return null;
  const componentKeys = ['color', 'defaultColors', 'enabled', 'hex', 'hue', 'width'] as const;
  if (
    !isPlainObject(component) ||
    Object.keys(component).sort().join('\0') !== [...componentKeys].sort().join('\0') ||
    !isPlainObject(fieldLabels)
  ) {
    throw new Error(`[BobCompiler] ${widgetname} Dropdown Border labels are invalid`);
  }
  const readLabel = (value: unknown, path: string): string => {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Border label is invalid: ${path}`);
    }
    return value;
  };
  const resolvedComponent = {} as DropdownBorderEditorLabels['component'];
  for (const key of componentKeys) {
    resolvedComponent[key] = readLabel(component[key], `components.dropdown-border.${key}`);
  }
  const resolvedFields: Record<string, string> = {};
  for (const [path, value] of Object.entries(fieldLabels)) {
    if (!path.trim() || path !== path.trim()) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Border field path is invalid`);
    }
    resolvedFields[path] = readLabel(value, `fields.${path}`);
  }
  return { component: resolvedComponent, fields: resolvedFields };
}

function applyDropdownBorderEditorLabels(
  lines: string[],
  labelsRaw: unknown,
  widgetname: string,
): string[] {
  const labels = readDropdownBorderEditorLabels(labelsRaw, widgetname);
  const usedFieldPaths = new Set<string>();
  const rendered = lines.map((line) => {
    if (!/\btype='dropdown-border'/.test(line)) return line;
    if (!labels) {
      throw new Error(`[BobCompiler] ${widgetname} Dropdown Border labels are missing`);
    }
    const path = line.match(/\bpath='([^']+)'/)?.[1] ?? '';
    const authoredLabel = line.match(/(?:^|\s)label='([^']*)'/)?.[1] ?? '';
    let next = line;
    if (!authoredLabel) {
      const fieldLabel = labels.fields[path];
      if (!fieldLabel) {
        throw new Error(
          `[BobCompiler] ${widgetname} Dropdown Border field label is missing: ${path}`,
        );
      }
      usedFieldPaths.add(path);
      next = next.replace(/(^|\s)label=''/, `$1label='${encodeHtmlEntities(fieldLabel)}'`);
    }
    const componentAttrs = [
      ['color-label', labels.component.color],
      ['default-colors-label', labels.component.defaultColors],
      ['enabled-label', labels.component.enabled],
      ['hex-label', labels.component.hex],
      ['hue-label', labels.component.hue],
      ['width-label', labels.component.width],
    ]
      .map(([name, value]) => `${name}='${encodeHtmlEntities(value)}'`)
      .join(' ');
    return next.replace(/\s*\/>$/, ` ${componentAttrs} />`);
  });
  if (labels) {
    const unusedPaths = Object.keys(labels.fields).filter((path) => !usedFieldPaths.has(path));
    if (unusedPaths.length > 0) {
      throw new Error(
        `[BobCompiler] ${widgetname} Dropdown Border field labels are unused: ${unusedPaths.join(', ')}`,
      );
    }
  }
  return rendered;
}

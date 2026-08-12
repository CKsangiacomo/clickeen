import { isRecord } from '@clickeen/ck-contracts';
import type { RawWidget } from '../compiler.shared';
import { BOB_WIDGET_PANEL_IDS, type CompiledToolDrawerLabels } from '../types';

const LABEL_TOKEN_PREFIX = '$label:';
const LABEL_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const COPY_ATTRIBUTE_NAMES = new Set([
  'add-label',
  'aria-label',
  'cancel-label',
  'close-label',
  'data-placeholder',
  'discard-label',
  'discard-message',
  'discard-title',
  'empty-label',
  'group-label',
  'headerLabel',
  'keep-editing-label',
  'labelInputLabel',
  'labelPlaceholder',
  'move-label',
  'placeholder',
  'remove-label',
  'reorder-label',
  'reorder-title',
  'save-label',
  'title',
  'add-gradient-stop-label',
  'angle-label',
  'choose-assets-label',
  'color-fill-label',
  'color-label',
  'default-colors-label',
  'edit-gradient-stop-label',
  'gradient-fill-label',
  'gradient-stops-label',
  'hex-label',
  'hue-label',
  'image-fill-label',
  'load-assets-error-label',
  'loading-assets-label',
  'no-assets-label',
  'opacity-label',
  'preview-asset-error-label',
  'remove-asset-label',
  'remove-fill-label',
  'remove-gradient-stop-label',
  'upload-asset-error-label',
  'upload-label',
  'use-asset-label',
  'video-fill-label',
]);

export type TooldrawerLabels = {
  widgetType: string;
  locale: 'en';
  labels: Record<string, string>;
};

export type ResolvedWidgetTooldrawerLabels = {
  widget: RawWidget;
  panelLabels: Record<(typeof BOB_WIDGET_PANEL_IDS)[number], string>;
  toolDrawerLabels: CompiledToolDrawerLabels;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readTooldrawerLabels(value: unknown, widgetType: string): TooldrawerLabels {
  if (!isRecord(value)) {
    throw new Error(`[BobCompiler] ${widgetType} ToolDrawer labels must be an object`);
  }
  const rootKeys = Object.keys(value).sort();
  if (
    rootKeys.length !== 3 ||
    rootKeys[0] !== 'labels' ||
    rootKeys[1] !== 'locale' ||
    rootKeys[2] !== 'widgetType'
  ) {
    throw new Error(`[BobCompiler] ${widgetType} ToolDrawer labels have invalid root fields`);
  }
  if (value.widgetType !== widgetType) {
    throw new Error(`[BobCompiler] ${widgetType} ToolDrawer labels widgetType mismatch`);
  }
  if (value.locale !== 'en') {
    throw new Error(`[BobCompiler] ${widgetType} ToolDrawer labels must declare locale "en"`);
  }
  if (!isRecord(value.labels)) {
    throw new Error(`[BobCompiler] ${widgetType} ToolDrawer labels missing labels object`);
  }

  const labels: Record<string, string> = {};
  for (const [key, rawLabel] of Object.entries(value.labels)) {
    if (!LABEL_KEY_PATTERN.test(key)) {
      throw new Error(`[BobCompiler] ${widgetType} ToolDrawer label key is invalid: ${key}`);
    }
    if (typeof rawLabel !== 'string' || !rawLabel.trim() || rawLabel !== rawLabel.trim()) {
      throw new Error(`[BobCompiler] ${widgetType} ToolDrawer label is invalid: ${key}`);
    }
    labels[key] = rawLabel;
  }
  return { widgetType, locale: 'en', labels };
}

function assertLabelToken(value: unknown, path: string, widgetType: string): void {
  if (typeof value !== 'string' || !value.trim()) return;
  if (!value.startsWith(LABEL_TOKEN_PREFIX)) {
    throw new Error(
      `[BobCompiler] ${widgetType} ToolDrawer copy must use a label token at ${path}`,
    );
  }
}

function assertCopyAttributes(attrs: unknown, path: string, widgetType: string, element: boolean): void {
  if (!isRecord(attrs)) return;
  for (const name of COPY_ATTRIBUTE_NAMES) {
    assertLabelToken(attrs[name], `${path}.${name}`, widgetType);
  }
  if (
    element &&
    typeof attrs.value === 'string' &&
    attrs.value.trim() &&
    !attrs.value.includes('{{')
  ) {
    assertLabelToken(attrs.value, `${path}.value`, widgetType);
  }
  if (Array.isArray(attrs.options)) {
    attrs.options.forEach((option, index) => {
      if (isRecord(option)) {
        assertLabelToken(option.label, `${path}.options[${index}].label`, widgetType);
      }
    });
  }
  if (Array.isArray(attrs.columns)) {
    attrs.columns.forEach((column, index) => {
      if (!isRecord(column)) return;
      assertLabelToken(column.label, `${path}.columns[${index}].label`, widgetType);
      assertLabelToken(column.placeholder, `${path}.columns[${index}].placeholder`, widgetType);
    });
  }
}

function assertEditorNodeCopy(node: unknown, path: string, widgetType: string): void {
  if (!isRecord(node)) return;
  if (node.kind === 'field') {
    assertLabelToken(node.label, `${path}.label`, widgetType);
    assertCopyAttributes(node.attrs, `${path}.attrs`, widgetType, false);
    if (Array.isArray(node.template)) {
      node.template.forEach((child, index) =>
        assertEditorNodeCopy(child, `${path}.template[${index}]`, widgetType),
      );
    }
    return;
  }
  if (node.kind === 'element') {
    assertCopyAttributes(node.attrs, `${path}.attrs`, widgetType, true);
    if (Array.isArray(node.children)) {
      node.children.forEach((child, index) =>
        assertEditorNodeCopy(child, `${path}.children[${index}]`, widgetType),
      );
    }
    return;
  }
  if (node.kind === 'text') {
    assertLabelToken(node.text, `${path}.text`, widgetType);
  }
}

function assertWidgetCopyUsesLabelTokens(widget: RawWidget, widgetType: string): void {
  const editor = isRecord(widget.editor) ? widget.editor : null;
  const editorLabels = editor?.labels;
  if (
    !isRecord(editorLabels) ||
    Object.keys(editorLabels).length !== 2 ||
    !isRecord(editorLabels.components) ||
    !isRecord(editorLabels.fields)
  ) {
    throw new Error(`[BobCompiler] ${widgetType} ToolDrawer labels contract is invalid`);
  }
  for (const [component, values] of Object.entries(editorLabels.components)) {
    if (!isRecord(values)) {
      throw new Error(`[BobCompiler] ${widgetType} ToolDrawer component labels are invalid`);
    }
    for (const [key, value] of Object.entries(values)) {
      assertLabelToken(value, `editor.labels.components.${component}.${key}`, widgetType);
    }
  }
  for (const [component, values] of Object.entries(editorLabels.fields)) {
    if (!isRecord(values)) {
      throw new Error(`[BobCompiler] ${widgetType} ToolDrawer field labels are invalid`);
    }
    for (const [path, value] of Object.entries(values)) {
      if (!path.trim()) {
        throw new Error(`[BobCompiler] ${widgetType} ToolDrawer field label path is invalid`);
      }
      assertLabelToken(value, `editor.labels.fields.${component}.${path}`, widgetType);
    }
  }

  const panels = editor && Array.isArray(editor.panels) ? editor.panels : [];
  panels.forEach((panel, panelIndex) => {
    if (!isRecord(panel)) return;
    if (isRecord(panel.shared) && isRecord(panel.shared.roleLabels)) {
      for (const [role, label] of Object.entries(panel.shared.roleLabels)) {
        assertLabelToken(label, `editor.panels[${panelIndex}].shared.roleLabels.${role}`, widgetType);
      }
    }
    if (!Array.isArray(panel.clusters)) return;
    panel.clusters.forEach((cluster, clusterIndex) => {
      if (!isRecord(cluster) || cluster.kind === 'shared') return;
      assertLabelToken(cluster.label, `editor.panels[${panelIndex}].clusters[${clusterIndex}].label`, widgetType);
      assertCopyAttributes(
        cluster.attrs,
        `editor.panels[${panelIndex}].clusters[${clusterIndex}].attrs`,
        widgetType,
        false,
      );
      if (Array.isArray(cluster.nodes)) {
        cluster.nodes.forEach((node, nodeIndex) =>
          assertEditorNodeCopy(
            node,
            `editor.panels[${panelIndex}].clusters[${clusterIndex}].nodes[${nodeIndex}]`,
            widgetType,
          ),
        );
      }
    });
  });

  const visitUiLabels = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      assertLabelToken(value, path, widgetType);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visitUiLabels(entry, `${path}[${index}]`));
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, entry] of Object.entries(value)) visitUiLabels(entry, `${path}.${key}`);
  };
  visitUiLabels(widget.defaults?.uiLabels, 'defaults.uiLabels');
}

function readResolvedToolDrawerLabels(
  editor: unknown,
  widgetType: string,
): CompiledToolDrawerLabels {
  if (!isRecord(editor) || !isRecord(editor.labels)) {
    throw new Error(`[BobCompiler] ${widgetType} resolved ToolDrawer labels are missing`);
  }
  const labels = editor.labels;
  const components = labels.components;
  const agentActivity = isRecord(components) ? components['agent-activity'] : null;
  if (
    Object.keys(labels).length !== 2 ||
    !isRecord(components) ||
    !isRecord(agentActivity) ||
    Object.keys(agentActivity).length !== 1 ||
    typeof agentActivity.title !== 'string' ||
    !agentActivity.title.trim() ||
    agentActivity.title !== agentActivity.title.trim()
  ) {
    throw new Error(`[BobCompiler] ${widgetType} resolved ToolDrawer labels contract is invalid`);
  }
  return {
    components: {
      'agent-activity': {
        title: agentActivity.title,
      },
    },
  };
}

function resolveLabelTokens(
  value: unknown,
  labels: TooldrawerLabels,
  usedKeys: Set<string>,
  path: string,
): unknown {
  if (typeof value === 'string') {
    if (!value.startsWith(LABEL_TOKEN_PREFIX)) return value;
    const key = value.slice(LABEL_TOKEN_PREFIX.length);
    if (!LABEL_KEY_PATTERN.test(key)) {
      throw new Error(`[BobCompiler] ${labels.widgetType} ToolDrawer label token is invalid at ${path}`);
    }
    const label = labels.labels[key];
    if (label === undefined) {
      throw new Error(
        `[BobCompiler] ${labels.widgetType} ToolDrawer label is missing at ${path}: ${key}`,
      );
    }
    usedKeys.add(key);
    return label;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      resolveLabelTokens(entry, labels, usedKeys, `${path}[${index}]`),
    );
  }
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key] = resolveLabelTokens(entry, labels, usedKeys, `${path}.${key}`);
  }
  return next;
}

export function resolveWidgetTooldrawerLabels(
  widgetJson: RawWidget,
  labelsRaw: unknown,
): ResolvedWidgetTooldrawerLabels {
  const widgetType =
    typeof widgetJson.widgetname === 'string' && widgetJson.widgetname.trim()
      ? widgetJson.widgetname.trim()
      : '';
  if (!widgetType) throw new Error('[BobCompiler] widget JSON missing widgetname');

  const labels = readTooldrawerLabels(labelsRaw, widgetType);
  assertWidgetCopyUsesLabelTokens(widgetJson, widgetType);
  const usedKeys = new Set<string>();
  const widget = cloneJson(widgetJson);
  widget.editor = resolveLabelTokens(widget.editor, labels, usedKeys, 'editor');

  if (widget.defaults && isRecord(widget.defaults.uiLabels)) {
    widget.defaults.uiLabels = resolveLabelTokens(
      widget.defaults.uiLabels,
      labels,
      usedKeys,
      'defaults.uiLabels',
    ) as Record<string, unknown>;
  }

  const panelLabels = {} as Record<(typeof BOB_WIDGET_PANEL_IDS)[number], string>;
  for (const panelId of BOB_WIDGET_PANEL_IDS) {
    const key = `panel.${panelId}`;
    const label = labels.labels[key];
    if (label === undefined) {
      throw new Error(`[BobCompiler] ${widgetType} ToolDrawer panel label is missing: ${key}`);
    }
    usedKeys.add(key);
    panelLabels[panelId] = label;
  }

  const unusedKeys = Object.keys(labels.labels).filter((key) => !usedKeys.has(key));
  if (unusedKeys.length > 0) {
    throw new Error(
      `[BobCompiler] ${widgetType} ToolDrawer labels contain unused keys: ${unusedKeys.join(', ')}`,
    );
  }

  return {
    widget,
    panelLabels,
    toolDrawerLabels: readResolvedToolDrawerLabels(widget.editor, widgetType),
  };
}

export const COMMON_WIDGET_CONTROL_CLUSTER_IDS = [
  'header-content',
  'header-layout',
  'core-size',
  'header-appearance',
  'stagepod-layout',
  'stagepod-appearance',
  'typography',
  'settings',
] as const;

export const WIDGET_SHARED_EDITOR_NODE_IDS = [
  'header-content',
  'header-content-no-header-cta',
  'header-layout',
  'header-layout-no-header-cta',
  'core-size',
  'header-appearance',
  'header-appearance-no-header-cta',
  'stagepod-appearance',
  'stagepod-layout',
  'stagepod-corners',
  'settings-behavior',
] as const;

export type WidgetSharedEditorNodeId = (typeof WIDGET_SHARED_EDITOR_NODE_IDS)[number];

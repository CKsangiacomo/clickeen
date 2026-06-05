export const WIDGET_SHELL_VERSION = 1;

export const SHELL_STATE_FAMILIES = [
  'header',
  'cta',
  'stage',
  'pod',
  'appearance.cta',
  'appearance.localeSwitcher',
  'appearance.podBorder',
  'appearance.cardwrapper',
  'typography',
  'localeSwitcher',
  'behavior.showBacklink',
  'behavior.socialShare.enabled',
] as const;

export const SHELL_EDITABLE_FIELD_PATHS = ['header.title', 'header.subtitleHtml', 'cta.label'] as const;

export const SHELL_REQUIRED_DOM_ROLES = ['stage', 'pod', 'root'] as const;

export const SHELL_REQUIRED_DOM_CLASSES = ['ck-headerLayout', 'ck-header', 'ck-headerLayout__body'] as const;

export const SHELL_EDITOR_CLUSTER_IDS = [
  'header-content',
  'header-layout',
  'core-size',
  'header-appearance',
  'stagepod-layout',
  'stagepod-appearance',
  'typography',
  'settings',
] as const;

export const SHELL_EDITOR_SHARED_NODE_IDS = [
  'header-content',
  'header-content-no-cta',
  'header-layout',
  'header-layout-no-cta',
  'header-appearance',
  'header-appearance-no-cta',
  'stagepod-appearance',
  'stagepod-layout',
  'stagepod-corners',
] as const;

export type ShellEditorSharedNodeId = (typeof SHELL_EDITOR_SHARED_NODE_IDS)[number];

export const SHELL_FORBIDDEN_ALIAS_PATHS = [
  'headline',
  'subheadline',
  'copy',
  'button',
  'primaryCta',
  'secondaryCta',
  'ctaText',
  'ctaUrl',
  'layout.copyWidth',
  'layout.bodyWidth',
  'layout.variant',
] as const;

export const CORE_SIZE_MODES = ['auto', 'fixed', 'responsive'] as const;

export type CoreSizeMode = (typeof CORE_SIZE_MODES)[number];

export type WidgetShellCoreLabels = {
  singular: string;
  plural: string;
  sizeCluster: string;
};

export type WidgetShellCoreSize = {
  mode: CoreSizeMode;
  fixedHeight: number;
  minHeight: number;
  preferredVw: number;
  maxHeight: number;
};

export type WidgetShellContribution = {
  schemaVersion: typeof WIDGET_SHELL_VERSION;
  widgetType: string;
  shellStateFamilies: readonly string[];
  shellEditableFieldPaths: readonly string[];
  shellCssModuleKeys: readonly string[];
  shellRuntimeModuleKeys: readonly string[];
  coreCssModuleKeys: readonly string[];
  coreRuntimeModuleKeys: readonly string[];
};

export type WidgetCoreExtensionContract = {
  widgetType: string;
  coreStatePaths: readonly string[];
  coreEditableFieldPaths: readonly string[];
  coreCssModuleKeys: readonly string[];
  coreRuntimeModuleKeys: readonly string[];
  coreLabels: WidgetShellCoreLabels;
  coreSizeDefaults: WidgetShellCoreSize;
};

export function pathBelongsToShell(path: string): boolean {
  const normalized = path.trim();
  return SHELL_STATE_FAMILIES.some((family) => normalized === family || normalized.startsWith(`${family}.`));
}

export function pathIsForbiddenShellAlias(path: string): boolean {
  const normalized = path.trim();
  return SHELL_FORBIDDEN_ALIAS_PATHS.some((forbidden) => normalized === forbidden || normalized.startsWith(`${forbidden}.`));
}

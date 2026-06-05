import { SHELL_EDITABLE_FIELD_PATHS, SHELL_STATE_FAMILIES, WIDGET_SHELL_VERSION, type WidgetShellContribution } from './contract';

export const WIDGET_SHELL_CSS_MODULE_KEYS = [
  'widget-shell/header.css',
  'widget-shell/stagePod.css',
  'widget-shell/localeSwitcher.css',
  'widget-shell/socialShare.css',
] as const;

export const WIDGET_SHELL_RUNTIME_MODULE_KEYS = [
  'widget-shell/runtime.js',
  'widget-shell/appearance.js',
  'widget-shell/fill.js',
  'widget-shell/header.js',
  'widget-shell/stagePod.js',
  'widget-shell/surface.js',
  'widget-shell/typography.js',
  'widget-shell/localeSwitcher.js',
  'widget-shell/branding.js',
  'widget-shell/socialShare.js',
  'widget-shell/previewL10n.js',
] as const;

export function createWidgetShellContribution(args: {
  widgetType: string;
  coreCssModuleKeys?: readonly string[];
  coreRuntimeModuleKeys?: readonly string[];
}): WidgetShellContribution {
  return {
    schemaVersion: WIDGET_SHELL_VERSION,
    widgetType: args.widgetType,
    shellStateFamilies: SHELL_STATE_FAMILIES,
    shellEditableFieldPaths: SHELL_EDITABLE_FIELD_PATHS,
    shellCssModuleKeys: WIDGET_SHELL_CSS_MODULE_KEYS,
    shellRuntimeModuleKeys: WIDGET_SHELL_RUNTIME_MODULE_KEYS,
    coreCssModuleKeys: args.coreCssModuleKeys ?? [],
    coreRuntimeModuleKeys: args.coreRuntimeModuleKeys ?? [],
  };
}

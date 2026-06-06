import { SHELL_EDITABLE_FIELD_PATHS, SHELL_STATE_FAMILIES, WIDGET_SHELL_VERSION, type WidgetShellContribution } from './contract';

export const WIDGET_SHELL_CSS_MODULE_KEYS = [
  'product/widgets/shared/header.css',
  'product/widgets/shared/localeSwitcher.css',
  'product/widgets/shared/stagePod.css',
  'product/widgets/shared/socialShare.css',
] as const;

export const WIDGET_SHELL_RUNTIME_MODULE_KEYS = [
  'product/widgets/shared/fill.js',
  'product/widgets/shared/appearance.js',
  'product/widgets/shared/runtime.js',
  'product/widgets/shared/header.js',
  'product/widgets/shared/localeSwitcher.js',
  'product/widgets/shared/surface.js',
  'product/widgets/shared/typography-data.js',
  'product/widgets/shared/typography.js',
  'product/widgets/shared/coreSize.js',
  'product/widgets/shared/stagePod.js',
  'product/widgets/shared/branding.js',
  'product/widgets/shared/previewL10n.js',
  'product/widgets/shared/socialShare.js',
] as const;

export const WIDGET_SHELL_OPTIONAL_SUPPORT_FILE_KEYS = [
  'product/widgets/shared/socialShare.css',
  'product/widgets/shared/socialShare.js',
] as const;

export const WIDGET_SHELL_SOCIAL_SHARE_CSS_MODULE_KEY = 'product/widgets/shared/socialShare.css';
export const WIDGET_SHELL_SOCIAL_SHARE_RUNTIME_MODULE_KEY = 'product/widgets/shared/socialShare.js';

export const WIDGET_SHELL_STYLE_CHUNK_END = '/* ck-style-module:end */';
export const WIDGET_SHELL_RUNTIME_PAYLOAD_START = '/* ck-runtime-payload:start */';
export const WIDGET_SHELL_RUNTIME_PAYLOAD_END = '/* ck-runtime-payload:end */';
export const WIDGET_SHELL_RUNTIME_MODULE_END = '/* ck-runtime-module:end */';

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

import { SHELL_EDITOR_CLUSTER_IDS } from './contract';

export type WidgetShellControlPath =
  | 'header.enabled'
  | 'header.title'
  | 'header.showSubtitle'
  | 'header.subtitleHtml'
  | 'headerCta.enabled'
  | 'headerCta.label'
  | 'headerCta.href'
  | 'headerCta.openMode'
  | 'headerCta.iconEnabled'
  | 'headerCta.iconPlacement'
  | 'headerCta.iconName'
  | 'header.placement'
  | 'header.alignment'
  | 'header.gap'
  | 'header.textGap'
  | 'header.ctaPlacement'
  | 'header.innerGap'
  | 'coreSize.mode'
  | 'coreSize.fixedHeight'
  | 'coreSize.minHeight'
  | 'coreSize.preferredVw'
  | 'coreSize.maxHeight'
  | 'behavior.showBacklink'
  | 'behavior.socialShare.enabled';

export type WidgetShellControlCluster = (typeof SHELL_EDITOR_CLUSTER_IDS)[number];

export type WidgetShellControlDefinition = {
  clusterId: WidgetShellControlCluster;
  path: WidgetShellControlPath;
  owner: 'widget-shell';
};

export const WIDGET_SHELL_CONTROL_DEFINITIONS: readonly WidgetShellControlDefinition[] = [
  { clusterId: 'header-content', path: 'header.enabled', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'header.title', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'header.showSubtitle', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'header.subtitleHtml', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'headerCta.enabled', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'headerCta.label', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'headerCta.href', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'headerCta.openMode', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'headerCta.iconEnabled', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'headerCta.iconPlacement', owner: 'widget-shell' },
  { clusterId: 'header-content', path: 'headerCta.iconName', owner: 'widget-shell' },
  { clusterId: 'header-layout', path: 'header.placement', owner: 'widget-shell' },
  { clusterId: 'header-layout', path: 'header.alignment', owner: 'widget-shell' },
  { clusterId: 'header-layout', path: 'header.gap', owner: 'widget-shell' },
  { clusterId: 'header-layout', path: 'header.textGap', owner: 'widget-shell' },
  { clusterId: 'header-layout', path: 'header.ctaPlacement', owner: 'widget-shell' },
  { clusterId: 'header-layout', path: 'header.innerGap', owner: 'widget-shell' },
  { clusterId: 'core-size', path: 'coreSize.mode', owner: 'widget-shell' },
  { clusterId: 'core-size', path: 'coreSize.fixedHeight', owner: 'widget-shell' },
  { clusterId: 'core-size', path: 'coreSize.minHeight', owner: 'widget-shell' },
  { clusterId: 'core-size', path: 'coreSize.preferredVw', owner: 'widget-shell' },
  { clusterId: 'core-size', path: 'coreSize.maxHeight', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.showBacklink', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.enabled', owner: 'widget-shell' },
];

export function listWidgetShellControlPaths(): WidgetShellControlPath[] {
  return WIDGET_SHELL_CONTROL_DEFINITIONS.map((control) => control.path);
}

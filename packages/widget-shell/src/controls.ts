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
  | 'behavior.socialShare.enabled'
  | 'behavior.socialShare.channels.copy'
  | 'behavior.socialShare.channels.sms'
  | 'behavior.socialShare.channels.email'
  | 'behavior.socialShare.channels.whatsapp'
  | 'behavior.socialShare.channels.telegram'
  | 'behavior.socialShare.channels.signal'
  | 'behavior.socialShare.channels.messenger'
  | 'behavior.socialShare.channels.wechat'
  | 'behavior.socialShare.channels.line'
  | 'behavior.socialShare.channels.slack'
  | 'behavior.socialShare.channels.teams'
  | 'behavior.socialShare.channels.discord'
  | 'behavior.socialShare.channels.x'
  | 'behavior.socialShare.channels.linkedin'
  | 'behavior.socialShare.channels.facebook'
  | 'behavior.socialShare.channels.reddit'
  | 'behavior.socialShare.channels.instagram'
  | 'behavior.socialShare.channels.tiktok';

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
  { clusterId: 'settings', path: 'behavior.socialShare.channels.copy', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.sms', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.email', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.whatsapp', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.telegram', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.signal', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.messenger', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.wechat', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.line', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.slack', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.teams', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.discord', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.x', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.linkedin', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.facebook', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.reddit', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.instagram', owner: 'widget-shell' },
  { clusterId: 'settings', path: 'behavior.socialShare.channels.tiktok', owner: 'widget-shell' },
];

export function listWidgetShellControlPaths(): WidgetShellControlPath[] {
  return WIDGET_SHELL_CONTROL_DEFINITIONS.map((control) => control.path);
}

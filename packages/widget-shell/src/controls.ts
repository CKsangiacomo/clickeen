import { SHELL_EDITOR_CLUSTER_IDS } from './contract';

export type WidgetShellControlPath = string;

export type WidgetShellControlCluster = (typeof SHELL_EDITOR_CLUSTER_IDS)[number];

export type WidgetShellControlDefinition = {
  clusterId: WidgetShellControlCluster;
  path: WidgetShellControlPath;
  owner: 'widget-shell';
};

const TYPOGRAPHY_CONTROL_LEAVES = [
  'family',
  'sizePreset',
  'sizeCustom',
  'fontStyle',
  'weight',
  'color',
  'lineHeightPreset',
  'lineHeightCustom',
  'trackingPreset',
  'trackingCustom',
] as const;

const SHELL_TYPOGRAPHY_ROLES = ['title', 'body', 'button', 'localeSwitcher'] as const;

function control(
  clusterId: WidgetShellControlCluster,
  path: WidgetShellControlPath,
): WidgetShellControlDefinition {
  return { clusterId, path, owner: 'widget-shell' };
}

function typographyControls(): WidgetShellControlDefinition[] {
  return [
    control('typography', 'typography.globalFamily'),
    ...SHELL_TYPOGRAPHY_ROLES.flatMap((role) =>
      TYPOGRAPHY_CONTROL_LEAVES.map((leaf) =>
        control('typography', `typography.roles.${role}.${leaf}`),
      ),
    ),
  ];
}

export const WIDGET_SHELL_ACCOUNT_DEFAULT_METADATA_PATHS = ['typography.roleScales'] as const;

export const WIDGET_SHELL_CONTROL_DEFINITIONS: readonly WidgetShellControlDefinition[] = [
  control('header-content', 'header.enabled'),
  control('header-content', 'header.title'),
  control('header-content', 'header.showSubtitle'),
  control('header-content', 'header.subtitleHtml'),
  control('header-content', 'headerCta.enabled'),
  control('header-content', 'headerCta.label'),
  control('header-content', 'headerCta.href'),
  control('header-content', 'headerCta.openMode'),
  control('header-content', 'headerCta.iconEnabled'),
  control('header-content', 'headerCta.iconPlacement'),
  control('header-content', 'headerCta.iconName'),

  control('header-layout', 'header.placement'),
  control('header-layout', 'header.alignment'),
  control('header-layout', 'header.gap'),
  control('header-layout', 'header.textGap'),
  control('header-layout', 'header.ctaPlacement'),
  control('header-layout', 'header.innerGap'),

  control('core-size', 'coreSize.mode'),
  control('core-size', 'coreSize.fixedHeight'),
  control('core-size', 'coreSize.minHeight'),
  control('core-size', 'coreSize.preferredVw'),
  control('core-size', 'coreSize.maxHeight'),

  control('stagepod-layout', 'pod.widthMode'),
  control('stagepod-layout', 'pod.contentWidth'),
  control('stagepod-layout', 'pod.padding.desktop.linked'),
  control('stagepod-layout', 'pod.padding.desktop.all'),
  control('stagepod-layout', 'pod.padding.desktop.top'),
  control('stagepod-layout', 'pod.padding.desktop.right'),
  control('stagepod-layout', 'pod.padding.desktop.bottom'),
  control('stagepod-layout', 'pod.padding.desktop.left'),
  control('stagepod-layout', 'pod.padding.mobile.linked'),
  control('stagepod-layout', 'pod.padding.mobile.all'),
  control('stagepod-layout', 'pod.padding.mobile.top'),
  control('stagepod-layout', 'pod.padding.mobile.right'),
  control('stagepod-layout', 'pod.padding.mobile.bottom'),
  control('stagepod-layout', 'pod.padding.mobile.left'),
  control('stagepod-layout', 'stage.alignment'),
  control('stagepod-layout', 'stage.canvas.mode'),
  control('stagepod-layout', 'stage.canvas.width'),
  control('stagepod-layout', 'stage.canvas.height'),
  control('stagepod-layout', 'stage.padding.desktop.linked'),
  control('stagepod-layout', 'stage.padding.desktop.all'),
  control('stagepod-layout', 'stage.padding.desktop.top'),
  control('stagepod-layout', 'stage.padding.desktop.right'),
  control('stagepod-layout', 'stage.padding.desktop.bottom'),
  control('stagepod-layout', 'stage.padding.desktop.left'),
  control('stagepod-layout', 'stage.padding.mobile.linked'),
  control('stagepod-layout', 'stage.padding.mobile.all'),
  control('stagepod-layout', 'stage.padding.mobile.top'),
  control('stagepod-layout', 'stage.padding.mobile.right'),
  control('stagepod-layout', 'stage.padding.mobile.bottom'),
  control('stagepod-layout', 'stage.padding.mobile.left'),

  control('header-appearance', 'appearance.headerCta.sizePreset'),
  control('header-appearance', 'appearance.headerCta.paddingLinked'),
  control('header-appearance', 'appearance.headerCta.paddingInline'),
  control('header-appearance', 'appearance.headerCta.paddingBlock'),
  control('header-appearance', 'appearance.headerCta.background'),
  control('header-appearance', 'appearance.headerCta.textColor'),
  control('header-appearance', 'appearance.headerCta.border'),
  control('header-appearance', 'appearance.headerCta.radius'),
  control('header-appearance', 'appearance.headerCta.iconSizePreset'),
  control('header-appearance', 'appearance.headerCta.iconSize'),

  control('stagepod-appearance', 'stage.background'),
  control('stagepod-appearance', 'stage.shadow'),
  control('stagepod-appearance', 'stage.insideShadow.linked'),
  control('stagepod-appearance', 'stage.insideShadow.layer'),
  control('stagepod-appearance', 'stage.insideShadow.all'),
  control('stagepod-appearance', 'stage.insideShadow.top'),
  control('stagepod-appearance', 'stage.insideShadow.right'),
  control('stagepod-appearance', 'stage.insideShadow.bottom'),
  control('stagepod-appearance', 'stage.insideShadow.left'),
  control('stagepod-appearance', 'pod.background'),
  control('stagepod-appearance', 'appearance.podBorder'),
  control('stagepod-appearance', 'pod.shadow'),
  control('stagepod-appearance', 'pod.insideShadow.linked'),
  control('stagepod-appearance', 'pod.insideShadow.layer'),
  control('stagepod-appearance', 'pod.insideShadow.all'),
  control('stagepod-appearance', 'pod.insideShadow.top'),
  control('stagepod-appearance', 'pod.insideShadow.right'),
  control('stagepod-appearance', 'pod.insideShadow.bottom'),
  control('stagepod-appearance', 'pod.insideShadow.left'),
  control('stagepod-appearance', 'pod.radiusLinked'),
  control('stagepod-appearance', 'pod.radius'),
  control('stagepod-appearance', 'pod.radiusTL'),
  control('stagepod-appearance', 'pod.radiusTR'),
  control('stagepod-appearance', 'pod.radiusBR'),
  control('stagepod-appearance', 'pod.radiusBL'),
  control('stagepod-appearance', 'appearance.localeSwitcherBackground'),
  control('stagepod-appearance', 'appearance.localeSwitcherTextColor'),
  control('stagepod-appearance', 'appearance.localeSwitcherBorder'),
  control('stagepod-appearance', 'appearance.localeSwitcherRadius'),
  control('stagepod-appearance', 'appearance.localeSwitcherPaddingInline'),
  control('stagepod-appearance', 'appearance.localeSwitcherPaddingBlock'),

  ...typographyControls(),

  control('settings', 'localeSwitcher.enabled'),
  control('settings', 'localeSwitcher.byIp'),
  control('settings', 'localeSwitcher.alwaysShowLocale'),
  control('settings', 'localeSwitcher.attachTo'),
  control('settings', 'localeSwitcher.position'),
  control('settings', 'behavior.showBacklink'),
  control('settings', 'behavior.socialShare.enabled'),
  control('settings', 'behavior.socialShare.channels.copy'),
  control('settings', 'behavior.socialShare.channels.sms'),
  control('settings', 'behavior.socialShare.channels.email'),
  control('settings', 'behavior.socialShare.channels.whatsapp'),
  control('settings', 'behavior.socialShare.channels.telegram'),
  control('settings', 'behavior.socialShare.channels.signal'),
  control('settings', 'behavior.socialShare.channels.messenger'),
  control('settings', 'behavior.socialShare.channels.wechat'),
  control('settings', 'behavior.socialShare.channels.line'),
  control('settings', 'behavior.socialShare.channels.slack'),
  control('settings', 'behavior.socialShare.channels.teams'),
  control('settings', 'behavior.socialShare.channels.discord'),
  control('settings', 'behavior.socialShare.channels.x'),
  control('settings', 'behavior.socialShare.channels.linkedin'),
  control('settings', 'behavior.socialShare.channels.facebook'),
  control('settings', 'behavior.socialShare.channels.reddit'),
  control('settings', 'behavior.socialShare.channels.instagram'),
  control('settings', 'behavior.socialShare.channels.tiktok'),
];

export function listWidgetShellControlPaths(): WidgetShellControlPath[] {
  return WIDGET_SHELL_CONTROL_DEFINITIONS.map((control) => control.path);
}

export function listWidgetShellAccountDefaultMetadataPaths(): string[] {
  return [...WIDGET_SHELL_ACCOUNT_DEFAULT_METADATA_PATHS];
}

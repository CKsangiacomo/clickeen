import { COMMON_WIDGET_CONTROL_CLUSTER_IDS } from './contract';

export type CommonWidgetControlPath = string;

export type CommonWidgetControlCluster = (typeof COMMON_WIDGET_CONTROL_CLUSTER_IDS)[number];

export type CommonWidgetControlDefinition = {
  clusterId: CommonWidgetControlCluster;
  path: CommonWidgetControlPath;
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

export const COMMON_WIDGET_TYPOGRAPHY_ROLE_LABELS = {
  title: 'Title',
  body: 'Subtitle',
  button: 'Button text',
  localeSwitcher: 'Locale switcher',
} as const;

const COMMON_WIDGET_TYPOGRAPHY_ROLES = Object.keys(COMMON_WIDGET_TYPOGRAPHY_ROLE_LABELS) as Array<
  keyof typeof COMMON_WIDGET_TYPOGRAPHY_ROLE_LABELS
>;

function control(
  clusterId: CommonWidgetControlCluster,
  path: CommonWidgetControlPath,
): CommonWidgetControlDefinition {
  return { clusterId, path };
}

function typographyControls(): CommonWidgetControlDefinition[] {
  return [
    control('typography', 'typography.globalFamily'),
    ...COMMON_WIDGET_TYPOGRAPHY_ROLES.flatMap((role) =>
      TYPOGRAPHY_CONTROL_LEAVES.map((leaf) =>
        control('typography', `typography.roles.${role}.${leaf}`),
      ),
    ),
  ];
}

export const COMMON_WIDGET_ACCOUNT_DEFAULT_METADATA_PATHS = ['typography.roleScales'] as const;

export const COMMON_WIDGET_CONTROL_DEFINITIONS: readonly CommonWidgetControlDefinition[] = [
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
  control('settings', 'localeSwitcher.attachTo'),
  control('settings', 'localeSwitcher.position'),
  control('settings', 'behavior.showBacklink'),
  control('settings', 'behavior.socialShare.enabled'),
  control('settings', 'behavior.socialShare.attachTo'),
  control('settings', 'behavior.socialShare.position'),
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

const COMMON_WIDGET_CONTROL_PATHS = new Set(
  COMMON_WIDGET_CONTROL_DEFINITIONS.map((definition) => definition.path),
);

export function isCommonWidgetControlPath(path: string): boolean {
  return COMMON_WIDGET_CONTROL_PATHS.has(path);
}

export function listCommonWidgetControlPaths(): CommonWidgetControlPath[] {
  return COMMON_WIDGET_CONTROL_DEFINITIONS.map((control) => control.path);
}

export function listCommonWidgetAccountDefaultMetadataPaths(): string[] {
  return [...COMMON_WIDGET_ACCOUNT_DEFAULT_METADATA_PATHS];
}

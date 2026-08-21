// Bob module: builds shared Stage/Pod layout fields for all widgets.
// Widgets declare shared Stage/Pod controls explicitly in spec.json.editor; this helper renders those declarations.

import { encodeHtmlEntities } from '../../compiler.shared';
import stagePodCopy from '../../../l10n/editor/stage-pod/en.json';

const encodeOptions = (value: Array<{ label: string; value: string }>) =>
  encodeHtmlEntities(JSON.stringify(value));

const radiusOptions = encodeOptions(
  [
    { label: stagePodCopy.options.none, value: 'none' },
    { label: stagePodCopy.options.small, value: '2xl' },
    { label: stagePodCopy.options.medium, value: '4xl' },
    { label: stagePodCopy.options.large, value: '6xl' },
    { label: stagePodCopy.options.xLarge, value: '10xl' },
  ],
);

const localeSwitcherRadiusOptions = encodeOptions(
  [
    { label: stagePodCopy.options.none, value: 'none' },
    { label: stagePodCopy.options.xSmall, value: 'xs' },
    { label: stagePodCopy.options.small, value: 'sm' },
    { label: stagePodCopy.options.medium, value: 'md' },
    { label: stagePodCopy.options.large, value: 'lg' },
    { label: stagePodCopy.options.xLarge, value: 'xl' },
    { label: stagePodCopy.options.twoXLarge, value: '2xl' },
  ],
);

const widthOptions = encodeOptions(
  [
    { label: stagePodCopy.options.wrapPodToWidget, value: 'wrap' },
    { label: stagePodCopy.options.fullWidth, value: 'full' },
    { label: stagePodCopy.options.fixedWidth, value: 'fixed' },
  ],
);

const alignmentOptions = encodeOptions(
  [
    { label: stagePodCopy.options.center, value: 'center' },
    { label: stagePodCopy.options.alignLeft, value: 'left' },
    { label: stagePodCopy.options.alignRight, value: 'right' },
    { label: stagePodCopy.options.alignTop, value: 'top' },
    { label: stagePodCopy.options.alignBottom, value: 'bottom' },
  ],
);

const canvasOptions = encodeOptions(
  [
    { label: stagePodCopy.options.full, value: 'viewport' },
    { label: stagePodCopy.options.wrapToPod, value: 'wrap' },
    { label: stagePodCopy.options.fixedSize, value: 'fixed' },
  ],
);

const floatingAnchorOptions = encodeOptions(
  [
    { label: stagePodCopy.options.top, value: 'top' },
    { label: stagePodCopy.options.bottom, value: 'bottom' },
    { label: stagePodCopy.options.left, value: 'left' },
    { label: stagePodCopy.options.right, value: 'right' },
    { label: stagePodCopy.options.center, value: 'center' },
    { label: stagePodCopy.options.topLeft, value: 'top-left' },
    { label: stagePodCopy.options.topRight, value: 'top-right' },
    { label: stagePodCopy.options.bottomLeft, value: 'bottom-left' },
    { label: stagePodCopy.options.bottomRight, value: 'bottom-right' },
  ],
);

type StagePodLayoutPanelOptions = {
  includeFloating?: boolean;
};

type StagePodAppearancePanelOptions = {
  includePodBorder?: boolean;
};

export function buildStagePodLayoutPanelFields(options: StagePodLayoutPanelOptions = {}): string[] {
  const includeFloating = options.includeFloating === true;
  const floatingFields = includeFloating
    ? [
        `    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='stage.floating.enabled' label='${stagePodCopy.fields.floating}' value='{{stage.floating.enabled}}' />`,
        `    <tooldrawer-field-podstagelayout group-label='' type='dropdown-actions' size='md' path='stage.floating.anchor' label='${stagePodCopy.fields.position}' value='{{stage.floating.anchor}}' show-if=\"stage.floating.enabled == true\" options='${floatingAnchorOptions}' />`,
        `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.floating.offset' label='${stagePodCopy.fields.viewportInset}' value='{{stage.floating.offset}}' min='0' max='400' step='1' show-if=\"stage.floating.enabled == true && stage.floating.anchor != 'center'\" />`,
      ]
    : [];

  return [
    `  <tooldrawer-cluster label='${stagePodCopy.clusters.podLayout}'>`,
    `    <tooldrawer-field-podstagelayout group-label='' type='dropdown-actions' size='md' path='pod.widthMode' label='${stagePodCopy.fields.podWidth}' placeholder='${stagePodCopy.fields.chooseWidth}' value='{{pod.widthMode}}' options='${widthOptions}' />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.contentWidth' label='${stagePodCopy.fields.widthInPixels}' min='0' show-if=\"pod.widthMode == 'fixed'\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='pod.padding.desktop.linked' label='${stagePodCopy.fields.linkPodPaddingDesktop}' value='{{pod.padding.desktop.linked}}' default='true' />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.all' label='${stagePodCopy.fields.podPaddingDesktop}' min='0' show-if=\"pod.padding.desktop.linked == true\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.top' label='${stagePodCopy.fields.podTopPaddingDesktop}' min='0' show-if=\"pod.padding.desktop.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.right' label='${stagePodCopy.fields.podRightPaddingDesktop}' min='0' show-if=\"pod.padding.desktop.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.bottom' label='${stagePodCopy.fields.podBottomPaddingDesktop}' min='0' show-if=\"pod.padding.desktop.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.left' label='${stagePodCopy.fields.podLeftPaddingDesktop}' min='0' show-if=\"pod.padding.desktop.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='pod.padding.mobile.linked' label='${stagePodCopy.fields.linkPodPaddingMobile}' value='{{pod.padding.mobile.linked}}' default='true' />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.all' label='${stagePodCopy.fields.podPaddingMobile}' min='0' show-if=\"pod.padding.mobile.linked == true\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.top' label='${stagePodCopy.fields.podTopPaddingMobile}' min='0' show-if=\"pod.padding.mobile.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.right' label='${stagePodCopy.fields.podRightPaddingMobile}' min='0' show-if=\"pod.padding.mobile.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.bottom' label='${stagePodCopy.fields.podBottomPaddingMobile}' min='0' show-if=\"pod.padding.mobile.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.left' label='${stagePodCopy.fields.podLeftPaddingMobile}' min='0' show-if=\"pod.padding.mobile.linked == false\" />`,
    '  </tooldrawer-cluster>',
    `  <tooldrawer-cluster label='${stagePodCopy.clusters.stageLayout}'>`,
    `    <tooldrawer-field-podstagelayout group-label='' type='dropdown-actions' size='md' path='stage.alignment' label='${stagePodCopy.fields.podAlignment}' placeholder='${stagePodCopy.fields.chooseAlignment}' value='{{stage.alignment}}' options='${alignmentOptions}' />`,
    ...floatingFields,
    `    <tooldrawer-field-podstagelayout group-label='' type='dropdown-actions' size='md' path='stage.canvas.mode' label='${stagePodCopy.fields.stageSizing}' placeholder='${stagePodCopy.fields.chooseSizing}' value='{{stage.canvas.mode}}' options='${canvasOptions}' />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.canvas.width' label='${stagePodCopy.fields.stageWidth}' min='0' show-if=\"stage.canvas.mode == 'fixed'\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.canvas.height' label='${stagePodCopy.fields.stageHeight}' min='0' show-if=\"stage.canvas.mode == 'fixed'\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='stage.padding.desktop.linked' label='${stagePodCopy.fields.linkStagePaddingDesktop}' value='{{stage.padding.desktop.linked}}' default='true' />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.all' label='${stagePodCopy.fields.stagePaddingDesktop}' min='0' show-if=\"stage.padding.desktop.linked == true\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.top' label='${stagePodCopy.fields.stageTopPaddingDesktop}' min='0' show-if=\"stage.padding.desktop.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.right' label='${stagePodCopy.fields.stageRightPaddingDesktop}' min='0' show-if=\"stage.padding.desktop.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.bottom' label='${stagePodCopy.fields.stageBottomPaddingDesktop}' min='0' show-if=\"stage.padding.desktop.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.left' label='${stagePodCopy.fields.stageLeftPaddingDesktop}' min='0' show-if=\"stage.padding.desktop.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='stage.padding.mobile.linked' label='${stagePodCopy.fields.linkStagePaddingMobile}' value='{{stage.padding.mobile.linked}}' default='true' />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.all' label='${stagePodCopy.fields.stagePaddingMobile}' min='0' show-if=\"stage.padding.mobile.linked == true\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.top' label='${stagePodCopy.fields.stageTopPaddingMobile}' min='0' show-if=\"stage.padding.mobile.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.right' label='${stagePodCopy.fields.stageRightPaddingMobile}' min='0' show-if=\"stage.padding.mobile.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.bottom' label='${stagePodCopy.fields.stageBottomPaddingMobile}' min='0' show-if=\"stage.padding.mobile.linked == false\" />`,
    `    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.left' label='${stagePodCopy.fields.stageLeftPaddingMobile}' min='0' show-if=\"stage.padding.mobile.linked == false\" />`,
    '  </tooldrawer-cluster>',
  ];
}

export function buildStagePodCornerAppearanceFields(): string[] {
  return [
    `    <tooldrawer-field-podstageappearance group-label='' type='toggle' size='md' path='pod.radiusLinked' label='${stagePodCopy.fields.linkPodCorners}' value='{{pod.radiusLinked}}' default='true' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='pod.radius' label='${stagePodCopy.fields.cornerRadius}' placeholder='${stagePodCopy.fields.chooseRadius}' value='{{pod.radius}}' show-if=\"pod.radiusLinked == true\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='pod.radiusTL' label='${stagePodCopy.fields.podTopLeftCorner}' placeholder='${stagePodCopy.fields.chooseRadius}' value='{{pod.radiusTL}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='pod.radiusTR' label='${stagePodCopy.fields.podTopRightCorner}' placeholder='${stagePodCopy.fields.chooseRadius}' value='{{pod.radiusTR}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='pod.radiusBR' label='${stagePodCopy.fields.podBottomRightCorner}' placeholder='${stagePodCopy.fields.chooseRadius}' value='{{pod.radiusBR}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='pod.radiusBL' label='${stagePodCopy.fields.podBottomLeftCorner}' placeholder='${stagePodCopy.fields.chooseRadius}' value='{{pod.radiusBL}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
  ];
}

function buildInsideShadowFields(args: {
  owner: string;
  existingPaths?: ReadonlySet<string>;
}): string[] {
  const owner = args.owner;
  const existingPaths = args.existingPaths;
  const shouldInclude = (path: string) => !existingPaths?.has(path);
  const fields: string[] = [];
  const push = (path: string, line: string) => {
    if (shouldInclude(path)) fields.push(line);
  };
  push(
    `${owner}.insideShadow.linked`,
    `    <tooldrawer-field-podstageappearance group-label='' type='toggle' size='md' path='${owner}.insideShadow.linked' label='' value='{{${owner}.insideShadow.linked}}' default='true' />`,
  );
  push(
    `${owner}.insideShadow.layer`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${owner}.insideShadow.layer' label='' value='{{${owner}.insideShadow.layer}}' options='' />`,
  );
  push(
    `${owner}.insideShadow.all`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='${owner}.insideShadow.all' label='' show-if=\"${owner}.insideShadow.linked == true\" value='{{${owner}.insideShadow.all}}' />`,
  );
  push(
    `${owner}.insideShadow.top`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='y' path='${owner}.insideShadow.top' label='' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.top}}' />`,
  );
  push(
    `${owner}.insideShadow.right`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='x' path='${owner}.insideShadow.right' label='' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.right}}' />`,
  );
  push(
    `${owner}.insideShadow.bottom`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='y' path='${owner}.insideShadow.bottom' label='' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.bottom}}' />`,
  );
  push(
    `${owner}.insideShadow.left`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='x' path='${owner}.insideShadow.left' label='' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.left}}' />`,
  );
  return fields;
}

export function buildLocaleSwitcherAppearancePanelFields(
  existingPaths: ReadonlySet<string> = new Set(),
): string[] {
  const fields: string[] = [];
  const push = (path: string, line: string) => {
    if (!existingPaths.has(path)) fields.push(line);
  };
  push(
    'appearance.localeSwitcherBackground',
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.localeSwitcherBackground' label='' value='{{appearance.localeSwitcherBackground}}' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'appearance.localeSwitcherTextColor',
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.localeSwitcherTextColor' label='' value='{{appearance.localeSwitcherTextColor}}' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'appearance.localeSwitcherBorder',
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-border' size='md' path='appearance.localeSwitcherBorder' label='' value='{{appearance.localeSwitcherBorder}}' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'appearance.localeSwitcherRadius',
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='appearance.localeSwitcherRadius' label='${stagePodCopy.fields.cornerRadius}' value='{{appearance.localeSwitcherRadius}}' options='${localeSwitcherRadiusOptions}' show-if=\"localeSwitcher.enabled == true\" />`,
  );
  push(
    'appearance.localeSwitcherPaddingInline',
    `    <tooldrawer-field-podstageappearance group-label='' type='valuefield' size='md' path='appearance.localeSwitcherPaddingInline' label='${stagePodCopy.fields.horizontalPadding}' min='0' max='48' step='1' value='{{appearance.localeSwitcherPaddingInline}}' show-if=\"localeSwitcher.enabled == true\" />`,
  );
  push(
    'appearance.localeSwitcherPaddingBlock',
    `    <tooldrawer-field-podstageappearance group-label='' type='valuefield' size='md' path='appearance.localeSwitcherPaddingBlock' label='${stagePodCopy.fields.verticalPadding}' min='0' max='32' step='1' value='{{appearance.localeSwitcherPaddingBlock}}' show-if=\"localeSwitcher.enabled == true\" />`,
  );
  return fields.length
    ? [
        `  <tooldrawer-cluster label='${stagePodCopy.clusters.localeSwitcher}' show-if="localeSwitcher.enabled == true">`,
        ...fields,
        '  </tooldrawer-cluster>',
      ]
    : [];
}

export function buildCoreCardWrapperAppearancePanelFields(args: {
  basePath: string;
  existingPaths?: ReadonlySet<string>;
  includeInsideShadow?: boolean;
  itemLabel: string;
}): string[] {
  const basePath = args.basePath;
  const existingPaths = args.existingPaths ?? new Set<string>();
  const itemLabel = args.itemLabel;
  const label = encodeHtmlEntities(itemLabel);
  const interpolateItem = (value: string, item: string) => value.replace('{item}', item);
  const fields: string[] = [];
  const push = (path: string, line: string) => {
    if (!existingPaths.has(path)) fields.push(line);
  };
  push(
    `${basePath}.radiusLinked`,
    `    <tooldrawer-field-podstageappearance group-label='' type='toggle' size='md' path='${basePath}.radiusLinked' label='${interpolateItem(stagePodCopy.fields.linkItemCorners, label)}' value='{{${basePath}.radiusLinked}}' default='true' />`,
  );
  push(
    `${basePath}.radius`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radius' label='${stagePodCopy.fields.cornerRadius}' value='{{${basePath}.radius}}' show-if=\"${basePath}.radiusLinked == true\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.radiusTL`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radiusTL' label='${interpolateItem(stagePodCopy.fields.itemTopLeftCorner, label)}' value='{{${basePath}.radiusTL}}' show-if=\"${basePath}.radiusLinked == false\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.radiusTR`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radiusTR' label='${interpolateItem(stagePodCopy.fields.itemTopRightCorner, label)}' value='{{${basePath}.radiusTR}}' show-if=\"${basePath}.radiusLinked == false\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.radiusBR`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radiusBR' label='${interpolateItem(stagePodCopy.fields.itemBottomRightCorner, label)}' value='{{${basePath}.radiusBR}}' show-if=\"${basePath}.radiusLinked == false\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.radiusBL`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radiusBL' label='${interpolateItem(stagePodCopy.fields.itemBottomLeftCorner, label)}' value='{{${basePath}.radiusBL}}' show-if=\"${basePath}.radiusLinked == false\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.border`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-border' size='md' path='${basePath}.border' label='' value='{{${basePath}.border}}' />`,
  );
  push(
    `${basePath}.shadow`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='${basePath}.shadow' label='' value='{{${basePath}.shadow}}' />`,
  );
  if (args.includeInsideShadow) {
    fields.push(
      ...buildInsideShadowFields({
        owner: basePath,
        existingPaths,
      }),
    );
  }
  return fields.length
    ? [
        `  <tooldrawer-cluster label='${interpolateItem(stagePodCopy.clusters.itemSurface, label)}'>`,
        ...fields,
        '  </tooldrawer-cluster>',
      ]
    : [];
}

export function buildStagePodAppearancePanelFields(
  options: StagePodAppearancePanelOptions = {},
): string[] {
  const podBorderFields = options.includePodBorder
    ? [
        "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-border' size='md' path='appearance.podBorder' label='' value='{{appearance.podBorder}}' />",
      ]
    : [];

  return [
    `  <tooldrawer-cluster label='${stagePodCopy.clusters.stageAppearance}'>`,
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color,gradient,image,video' path='stage.background' label='' value='{{stage.background}}' />",
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='stage.shadow' label='' value='{{stage.shadow}}' />",
    ...buildInsideShadowFields({ owner: 'stage' }),
    '  </tooldrawer-cluster>',
    `  <tooldrawer-cluster label='${stagePodCopy.clusters.podAppearance}'>`,
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color,gradient,image,video' path='pod.background' label='' value='{{pod.background}}' />",
    ...podBorderFields,
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='pod.shadow' label='' value='{{pod.shadow}}' />",
    ...buildInsideShadowFields({ owner: 'pod' }),
    ...buildStagePodCornerAppearanceFields(),
    '  </tooldrawer-cluster>',
  ];
}

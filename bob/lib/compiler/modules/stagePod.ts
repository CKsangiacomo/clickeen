// Bob module: builds shared Stage/Pod layout fields for all widgets.
// Widgets declare shared Stage/Pod controls explicitly in spec.json.editor; this helper renders those declarations.

const radiusOptions =
  '[{\"label\":\"None\",\"value\":\"none\"},{\"label\":\"Small\",\"value\":\"2xl\"},{\"label\":\"Medium\",\"value\":\"4xl\"},{\"label\":\"Large\",\"value\":\"6xl\"},{\"label\":\"X-Large\",\"value\":\"10xl\"}]'.replace(
    /"/g,
    '&quot;',
  );

const widthOptions =
  '[{\"label\":\"Wrap pod to widget\",\"value\":\"wrap\"},{\"label\":\"Full width\",\"value\":\"full\"},{\"label\":\"Fixed width\",\"value\":\"fixed\"}]'.replace(
    /"/g,
    '&quot;',
  );

const alignmentOptions =
  '[{\"label\":\"Center\",\"value\":\"center\"},{\"label\":\"Align left\",\"value\":\"left\"},{\"label\":\"Align right\",\"value\":\"right\"},{\"label\":\"Align top\",\"value\":\"top\"},{\"label\":\"Align bottom\",\"value\":\"bottom\"}]'.replace(
    /"/g,
    '&quot;',
  );

const canvasOptions =
  '[{\"label\":\"Full\",\"value\":\"viewport\"},{\"label\":\"Wrap to pod\",\"value\":\"wrap\"},{\"label\":\"Fixed size\",\"value\":\"fixed\"}]'.replace(
    /"/g,
    '&quot;',
  );

const floatingAnchorOptions =
  '[{\"label\":\"Top\",\"value\":\"top\"},{\"label\":\"Bottom\",\"value\":\"bottom\"},{\"label\":\"Left\",\"value\":\"left\"},{\"label\":\"Right\",\"value\":\"right\"},{\"label\":\"Center\",\"value\":\"center\"},{\"label\":\"Top left\",\"value\":\"top-left\"},{\"label\":\"Top right\",\"value\":\"top-right\"},{\"label\":\"Bottom left\",\"value\":\"bottom-left\"},{\"label\":\"Bottom right\",\"value\":\"bottom-right\"}]'.replace(
    /"/g,
    '&quot;',
  );

type StagePodLayoutPanelOptions = {
  includeFloating?: boolean;
};

type StagePodAppearancePanelOptions = {
  includePodBorder?: boolean;
};

const insideShadowLayerOptions =
  '[{\"label\":\"Show below content\",\"value\":\"below-content\"},{\"label\":\"Show above content\",\"value\":\"above-content\"}]'.replace(
    /"/g,
    '&quot;',
  );

export function buildStagePodLayoutPanelFields(options: StagePodLayoutPanelOptions = {}): string[] {
  const includeFloating = options.includeFloating === true;
  const floatingFields = includeFloating
    ? [
        "    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='stage.floating.enabled' label='Floating' value='{{stage.floating.enabled}}' />",
        `    <tooldrawer-field-podstagelayout group-label='' type='dropdown-actions' size='md' path='stage.floating.anchor' label='Position' value='{{stage.floating.anchor}}' show-if=\"stage.floating.enabled == true\" options='${floatingAnchorOptions}' />`,
        "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.floating.offset' label='Viewport inset (px)' value='{{stage.floating.offset}}' min='0' max='400' step='1' show-if=\"stage.floating.enabled == true && stage.floating.anchor != 'center'\" />",
      ]
    : [];

  return [
    "  <tooldrawer-cluster label='Pod layout'>",
    `    <tooldrawer-field-podstagelayout group-label='' type='dropdown-actions' size='md' path='pod.widthMode' label='Pod width' placeholder='Choose width' value='{{pod.widthMode}}' options='${widthOptions}' />`,
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.contentWidth' label='Width in pixels' show-if=\"pod.widthMode == 'fixed'\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='pod.padding.desktop.linked' label='Link pod padding (desktop)' value='{{pod.padding.desktop.linked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.all' label='Pod padding (desktop px)' show-if=\"pod.padding.desktop.linked == true\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.top' label='Pod top padding (desktop px)' show-if=\"pod.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.right' label='Pod right padding (desktop px)' show-if=\"pod.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.bottom' label='Pod bottom padding (desktop px)' show-if=\"pod.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.desktop.left' label='Pod left padding (desktop px)' show-if=\"pod.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='pod.padding.mobile.linked' label='Link pod padding (mobile)' value='{{pod.padding.mobile.linked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.all' label='Pod padding (mobile px)' show-if=\"pod.padding.mobile.linked == true\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.top' label='Pod top padding (mobile px)' show-if=\"pod.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.right' label='Pod right padding (mobile px)' show-if=\"pod.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.bottom' label='Pod bottom padding (mobile px)' show-if=\"pod.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='pod.padding.mobile.left' label='Pod left padding (mobile px)' show-if=\"pod.padding.mobile.linked == false\" />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster label='Stage layout'>",
    `    <tooldrawer-field-podstagelayout group-label='' type='dropdown-actions' size='md' path='stage.alignment' label='Pod alignment' placeholder='Choose alignment' value='{{stage.alignment}}' options='${alignmentOptions}' />`,
    ...floatingFields,
    `    <tooldrawer-field-podstagelayout group-label='' type='dropdown-actions' size='md' path='stage.canvas.mode' label='Stage sizing' placeholder='Choose sizing' value='{{stage.canvas.mode}}' options='${canvasOptions}' />`,
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.canvas.width' label='Stage width (px)' show-if=\"stage.canvas.mode == 'fixed'\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.canvas.height' label='Stage height (px)' show-if=\"stage.canvas.mode == 'fixed'\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='stage.padding.desktop.linked' label='Link stage padding (desktop)' value='{{stage.padding.desktop.linked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.all' label='Stage padding (desktop px)' show-if=\"stage.padding.desktop.linked == true\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.top' label='Stage top padding (desktop px)' show-if=\"stage.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.right' label='Stage right padding (desktop px)' show-if=\"stage.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.bottom' label='Stage bottom padding (desktop px)' show-if=\"stage.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.desktop.left' label='Stage left padding (desktop px)' show-if=\"stage.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='toggle' size='md' path='stage.padding.mobile.linked' label='Link stage padding (mobile)' value='{{stage.padding.mobile.linked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.all' label='Stage padding (mobile px)' show-if=\"stage.padding.mobile.linked == true\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.top' label='Stage top padding (mobile px)' show-if=\"stage.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.right' label='Stage right padding (mobile px)' show-if=\"stage.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.bottom' label='Stage bottom padding (mobile px)' show-if=\"stage.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout group-label='' type='valuefield' size='md' path='stage.padding.mobile.left' label='Stage left padding (mobile px)' show-if=\"stage.padding.mobile.linked == false\" />",
    "  </tooldrawer-cluster>",
  ];
}

export function buildStagePodCornerAppearanceFields(): string[] {
  return [
    "    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='toggle' size='md' path='pod.radiusLinked' label='Link pod corners' value='{{pod.radiusLinked}}' default='true' />",
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radius' label='Corner radius' placeholder='Choose radius' value='{{pod.radius}}' show-if=\"pod.radiusLinked == true\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radiusTL' label='Pod top-left radius' placeholder='Choose radius' value='{{pod.radiusTL}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radiusTR' label='Pod top-right radius' placeholder='Choose radius' value='{{pod.radiusTR}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radiusBR' label='Pod bottom-right radius' placeholder='Choose radius' value='{{pod.radiusBR}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radiusBL' label='Pod bottom-left radius' placeholder='Choose radius' value='{{pod.radiusBL}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
  ];
}

function buildInsideShadowFields(args: { owner: 'stage' | 'pod'; label: 'Stage' | 'Pod' }): string[] {
  const owner = args.owner;
  const label = args.label;
  return [
    `    <tooldrawer-field-podstageappearance group-label='' type='toggle' size='md' path='${owner}.insideShadow.linked' label='Link ${owner} inside shadows' value='{{${owner}.insideShadow.linked}}' default='true' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${owner}.insideShadow.layer' label='Inside shadow layer' value='{{${owner}.insideShadow.layer}}' options='${insideShadowLayerOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='${owner}.insideShadow.all' label='${label} inside shadow' show-if=\"${owner}.insideShadow.linked == true\" value='{{${owner}.insideShadow.all}}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='y' path='${owner}.insideShadow.top' label='${label} inside shadow (top)' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.top}}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='x' path='${owner}.insideShadow.right' label='${label} inside shadow (right)' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.right}}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='y' path='${owner}.insideShadow.bottom' label='${label} inside shadow (bottom)' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.bottom}}' />`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='x' path='${owner}.insideShadow.left' label='${label} inside shadow (left)' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.left}}' />`,
  ];
}

export function buildStagePodAppearancePanelFields(options: StagePodAppearancePanelOptions = {}): string[] {
  const podBorderFields = options.includePodBorder
    ? [
        "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-border' size='md' path='appearance.podBorder' label='Pod border' value='{{appearance.podBorder}}' />",
      ]
    : [];

  return [
    "  <tooldrawer-cluster label='Stage appearance'>",
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color,gradient,image,video' path='stage.background' label='Stage background' value='{{stage.background}}' />",
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='stage.shadow' label='Stage outside shadow' value='{{stage.shadow}}' />",
    ...buildInsideShadowFields({ owner: 'stage', label: 'Stage' }),
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster label='Pod appearance'>",
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color,gradient,image,video' path='pod.background' label='Pod background' value='{{pod.background}}' />",
    ...podBorderFields,
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='pod.shadow' label='Pod outside shadow' value='{{pod.shadow}}' />",
    ...buildInsideShadowFields({ owner: 'pod', label: 'Pod' }),
    ...buildStagePodCornerAppearanceFields(),
    "  </tooldrawer-cluster>",
  ];
}

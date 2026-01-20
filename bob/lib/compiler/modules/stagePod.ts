// Bob module: builds shared Stage/Pod layout fields for all widgets.
// Widgets declare defaults.stage and defaults.pod; compiler injects these fields into the Layout panel.

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

export function buildStagePodLayoutPanelFields(): string[] {
  return [
    "  <tooldrawer-cluster>",
    "    <tooldrawer-eyebrow text='Pod layout' />",
    `    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.widthMode' label='Pod width' placeholder='Choose width' value='{{pod.widthMode}}' options='${widthOptions}' />`,
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.contentWidth' label='Width in pixels' show-if=\"pod.widthMode == 'fixed'\" />",
    `    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='stage.alignment' label='Pod alignment' placeholder='Choose alignment' value='{{stage.alignment}}' options='${alignmentOptions}' />`,
    "    <tooldrawer-field-podstagelayout type='toggle' size='md' path='pod.padding.desktop.linked' label='Link pod padding (desktop)' value='{{pod.padding.desktop.linked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.desktop.all' label='Pod padding (desktop px)' show-if=\"pod.padding.desktop.linked == true\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.desktop.top' label='Pod top padding (desktop px)' show-if=\"pod.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.desktop.right' label='Pod right padding (desktop px)' show-if=\"pod.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.desktop.bottom' label='Pod bottom padding (desktop px)' show-if=\"pod.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.desktop.left' label='Pod left padding (desktop px)' show-if=\"pod.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='toggle' size='md' path='pod.padding.mobile.linked' label='Link pod padding (mobile)' value='{{pod.padding.mobile.linked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.mobile.all' label='Pod padding (mobile px)' show-if=\"pod.padding.mobile.linked == true\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.mobile.top' label='Pod top padding (mobile px)' show-if=\"pod.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.mobile.right' label='Pod right padding (mobile px)' show-if=\"pod.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.mobile.bottom' label='Pod bottom padding (mobile px)' show-if=\"pod.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='pod.padding.mobile.left' label='Pod left padding (mobile px)' show-if=\"pod.padding.mobile.linked == false\" />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-eyebrow text='Stage layout' />",
    `    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='stage.canvas.mode' label='Stage sizing' placeholder='Choose sizing' value='{{stage.canvas.mode}}' options='${canvasOptions}' />`,
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.canvas.width' label='Stage width (px)' show-if=\"stage.canvas.mode == 'fixed'\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.canvas.height' label='Stage height (px)' show-if=\"stage.canvas.mode == 'fixed'\" />",
    "    <tooldrawer-field-podstagelayout type='toggle' size='md' path='stage.padding.desktop.linked' label='Link stage padding (desktop)' value='{{stage.padding.desktop.linked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.desktop.all' label='Stage padding (desktop px)' show-if=\"stage.padding.desktop.linked == true\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.desktop.top' label='Stage top padding (desktop px)' show-if=\"stage.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.desktop.right' label='Stage right padding (desktop px)' show-if=\"stage.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.desktop.bottom' label='Stage bottom padding (desktop px)' show-if=\"stage.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.desktop.left' label='Stage left padding (desktop px)' show-if=\"stage.padding.desktop.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='toggle' size='md' path='stage.padding.mobile.linked' label='Link stage padding (mobile)' value='{{stage.padding.mobile.linked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.mobile.all' label='Stage padding (mobile px)' show-if=\"stage.padding.mobile.linked == true\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.mobile.top' label='Stage top padding (mobile px)' show-if=\"stage.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.mobile.right' label='Stage right padding (mobile px)' show-if=\"stage.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.mobile.bottom' label='Stage bottom padding (mobile px)' show-if=\"stage.padding.mobile.linked == false\" />",
    "    <tooldrawer-field-podstagelayout type='valuefield' size='md' path='stage.padding.mobile.left' label='Stage left padding (mobile px)' show-if=\"stage.padding.mobile.linked == false\" />",
    "  </tooldrawer-cluster>",
  ];
}

export function buildStagePodCornerAppearanceFields(): string[] {
  return [
    "    <tooldrawer-field-podstageappearance type='toggle' size='md' path='pod.radiusLinked' label='Link pod corners' value='{{pod.radiusLinked}}' default='true' />",
    `    <tooldrawer-field-podstageappearance type='dropdown-actions' size='md' path='pod.radius' label='Corner radius' placeholder='Choose radius' value='{{pod.radius}}' show-if=\"pod.radiusLinked == true\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance type='dropdown-actions' size='md' path='pod.radiusTL' label='Pod top-left radius' placeholder='Choose radius' value='{{pod.radiusTL}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance type='dropdown-actions' size='md' path='pod.radiusTR' label='Pod top-right radius' placeholder='Choose radius' value='{{pod.radiusTR}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance type='dropdown-actions' size='md' path='pod.radiusBR' label='Pod bottom-right radius' placeholder='Choose radius' value='{{pod.radiusBR}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance type='dropdown-actions' size='md' path='pod.radiusBL' label='Pod bottom-left radius' placeholder='Choose radius' value='{{pod.radiusBL}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
  ];
}

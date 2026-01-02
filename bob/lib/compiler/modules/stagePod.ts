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

export function buildStagePodLayoutPanelFields(): string[] {
  return [
    "  <tooldrawer-cluster>",
    "    <tooldrawer-eyebrow text='Stage/Pod layout' />",
    `    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.widthMode' label='Pod width' placeholder='Choose width' value='{{pod.widthMode}}' options='${widthOptions}' />`,
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.contentWidth' label='Width in pixels' show-if=\"pod.widthMode == 'fixed'\" />",
    `    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='stage.alignment' label='Pod alignment' placeholder='Choose alignment' value='{{stage.alignment}}' options='${alignmentOptions}' />`,
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field-podstagelayout type='toggle' size='md' path='pod.paddingLinked' label='Link pod padding' value='{{pod.paddingLinked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.padding' label='Pod padding (px)' show-if=\"pod.paddingLinked == true\" />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.paddingTop' label='Pod top padding (px)' show-if=\"pod.paddingLinked == false\" />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.paddingRight' label='Pod right padding (px)' show-if=\"pod.paddingLinked == false\" />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.paddingBottom' label='Pod bottom padding (px)' show-if=\"pod.paddingLinked == false\" />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.paddingLeft' label='Pod left padding (px)' show-if=\"pod.paddingLinked == false\" />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field-podstagelayout type='toggle' size='md' path='stage.paddingLinked' label='Link stage padding' value='{{stage.paddingLinked}}' default='true' />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.padding' label='Stage padding (px)' show-if=\"stage.paddingLinked == true\" />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.paddingTop' label='Stage top padding (px)' show-if=\"stage.paddingLinked == false\" />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.paddingRight' label='Stage right padding (px)' show-if=\"stage.paddingLinked == false\" />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.paddingBottom' label='Stage bottom padding (px)' show-if=\"stage.paddingLinked == false\" />",
    "    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.paddingLeft' label='Stage left padding (px)' show-if=\"stage.paddingLinked == false\" />",
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

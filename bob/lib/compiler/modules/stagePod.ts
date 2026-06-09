// Bob module: builds shared Stage/Pod layout fields for all widgets.
// Widgets declare shared Stage/Pod controls explicitly in spec.json.editor; this helper renders those declarations.

const radiusOptions =
  '[{\"label\":\"None\",\"value\":\"none\"},{\"label\":\"Small\",\"value\":\"2xl\"},{\"label\":\"Medium\",\"value\":\"4xl\"},{\"label\":\"Large\",\"value\":\"6xl\"},{\"label\":\"X-Large\",\"value\":\"10xl\"}]'.replace(
    /"/g,
    '&quot;',
  );

const localeSwitcherRadiusOptions =
  '[{\"label\":\"None\",\"value\":\"none\"},{\"label\":\"X-Small\",\"value\":\"xs\"},{\"label\":\"Small\",\"value\":\"sm\"},{\"label\":\"Medium\",\"value\":\"md\"},{\"label\":\"Large\",\"value\":\"lg\"},{\"label\":\"X-Large\",\"value\":\"xl\"},{\"label\":\"2X-Large\",\"value\":\"2xl\"}]'.replace(
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
    '  </tooldrawer-cluster>',
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
    '  </tooldrawer-cluster>',
  ];
}

export function buildStagePodCornerAppearanceFields(): string[] {
  return [
    "    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='toggle' size='md' path='pod.radiusLinked' label='Link pod corners' value='{{pod.radiusLinked}}' default='true' />",
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radius' label='Corner radius' placeholder='Choose radius' value='{{pod.radius}}' show-if=\"pod.radiusLinked == true\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radiusTL' label='Pod top-left corner' placeholder='Choose radius' value='{{pod.radiusTL}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radiusTR' label='Pod top-right corner' placeholder='Choose radius' value='{{pod.radiusTR}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radiusBR' label='Pod bottom-right corner' placeholder='Choose radius' value='{{pod.radiusBR}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
    `    <tooldrawer-field-podstageappearance group-label='Stage/Pod' type='dropdown-actions' size='md' path='pod.radiusBL' label='Pod bottom-left corner' placeholder='Choose radius' value='{{pod.radiusBL}}' show-if=\"pod.radiusLinked == false\" options='${radiusOptions}' />`,
  ];
}

function buildInsideShadowFields(args: {
  owner: string;
  label: 'Stage' | 'Pod' | 'Core item';
  existingPaths?: ReadonlySet<string>;
}): string[] {
  const owner = args.owner;
  const label = args.label;
  const existingPaths = args.existingPaths;
  const shouldInclude = (path: string) => !existingPaths?.has(path);
  const fields: string[] = [];
  const push = (path: string, line: string) => {
    if (shouldInclude(path)) fields.push(line);
  };
  push(
    `${owner}.insideShadow.linked`,
    `    <tooldrawer-field-podstageappearance group-label='' type='toggle' size='md' path='${owner}.insideShadow.linked' label='Link ${label.toLowerCase()} inside shadows' value='{{${owner}.insideShadow.linked}}' default='true' />`,
  );
  push(
    `${owner}.insideShadow.layer`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${owner}.insideShadow.layer' label='Inside shadow layer' value='{{${owner}.insideShadow.layer}}' options='${insideShadowLayerOptions}' />`,
  );
  push(
    `${owner}.insideShadow.all`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='${owner}.insideShadow.all' label='${label} inside shadow' show-if=\"${owner}.insideShadow.linked == true\" value='{{${owner}.insideShadow.all}}' />`,
  );
  push(
    `${owner}.insideShadow.top`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='y' path='${owner}.insideShadow.top' label='${label} inside shadow (top)' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.top}}' />`,
  );
  push(
    `${owner}.insideShadow.right`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='x' path='${owner}.insideShadow.right' label='${label} inside shadow (right)' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.right}}' />`,
  );
  push(
    `${owner}.insideShadow.bottom`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='y' path='${owner}.insideShadow.bottom' label='${label} inside shadow (bottom)' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.bottom}}' />`,
  );
  push(
    `${owner}.insideShadow.left`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' axis='x' path='${owner}.insideShadow.left' label='${label} inside shadow (left)' show-if=\"${owner}.insideShadow.linked == false\" value='{{${owner}.insideShadow.left}}' />`,
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
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.localeSwitcherBackground' label='Background' value='{{appearance.localeSwitcherBackground}}' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'appearance.localeSwitcherTextColor',
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.localeSwitcherTextColor' label='Text color' value='{{appearance.localeSwitcherTextColor}}' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'appearance.localeSwitcherBorder',
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-border' size='md' path='appearance.localeSwitcherBorder' label='Border' value='{{appearance.localeSwitcherBorder}}' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'appearance.localeSwitcherRadius',
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='appearance.localeSwitcherRadius' label='Corner radius' value='{{appearance.localeSwitcherRadius}}' options='${localeSwitcherRadiusOptions}' show-if=\"localeSwitcher.enabled == true\" />`,
  );
  push(
    'appearance.localeSwitcherPaddingInline',
    "    <tooldrawer-field-podstageappearance group-label='' type='valuefield' size='md' path='appearance.localeSwitcherPaddingInline' label='Horizontal padding (px)' min='0' max='48' step='1' value='{{appearance.localeSwitcherPaddingInline}}' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'appearance.localeSwitcherPaddingBlock',
    "    <tooldrawer-field-podstageappearance group-label='' type='valuefield' size='md' path='appearance.localeSwitcherPaddingBlock' label='Vertical padding (px)' min='0' max='32' step='1' value='{{appearance.localeSwitcherPaddingBlock}}' show-if=\"localeSwitcher.enabled == true\" />",
  );
  return fields.length
    ? ["  <tooldrawer-cluster label='Locale switcher'>", ...fields, '  </tooldrawer-cluster>']
    : [];
}

export function buildCoreCardWrapperAppearancePanelFields(
  args: {
    basePath: string;
    existingPaths?: ReadonlySet<string>;
    includeInsideShadow?: boolean;
  },
): string[] {
  const basePath = args.basePath;
  const existingPaths = args.existingPaths ?? new Set<string>();
  const fields: string[] = [];
  const push = (path: string, line: string) => {
    if (!existingPaths.has(path)) fields.push(line);
  };
  push(
    `${basePath}.radiusLinked`,
    `    <tooldrawer-field-podstageappearance group-label='' type='toggle' size='md' path='${basePath}.radiusLinked' label='Link item corners' value='{{${basePath}.radiusLinked}}' default='true' />`,
  );
  push(
    `${basePath}.radius`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radius' label='Corner radius' value='{{${basePath}.radius}}' show-if=\"${basePath}.radiusLinked == true\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.radiusTL`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radiusTL' label='Item top-left corner' value='{{${basePath}.radiusTL}}' show-if=\"${basePath}.radiusLinked == false\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.radiusTR`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radiusTR' label='Item top-right corner' value='{{${basePath}.radiusTR}}' show-if=\"${basePath}.radiusLinked == false\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.radiusBR`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radiusBR' label='Item bottom-right corner' value='{{${basePath}.radiusBR}}' show-if=\"${basePath}.radiusLinked == false\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.radiusBL`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-actions' size='md' path='${basePath}.radiusBL' label='Item bottom-left corner' value='{{${basePath}.radiusBL}}' show-if=\"${basePath}.radiusLinked == false\" options='${radiusOptions}' />`,
  );
  push(
    `${basePath}.border`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-border' size='md' path='${basePath}.border' label='Item border' value='{{${basePath}.border}}' />`,
  );
  push(
    `${basePath}.shadow`,
    `    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='${basePath}.shadow' label='Item outside shadow' value='{{${basePath}.shadow}}' />`,
  );
  if (args.includeInsideShadow) {
    fields.push(
      ...buildInsideShadowFields({
        owner: basePath,
        label: 'Core item',
        existingPaths,
      }),
    );
  }
  return fields.length
    ? ["  <tooldrawer-cluster label='Item surface'>", ...fields, '  </tooldrawer-cluster>']
    : [];
}

export function buildStagePodAppearancePanelFields(
  options: StagePodAppearancePanelOptions = {},
): string[] {
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
    '  </tooldrawer-cluster>',
    "  <tooldrawer-cluster label='Pod appearance'>",
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-fill' size='md' fill-modes='color,gradient,image,video' path='pod.background' label='Pod background' value='{{pod.background}}' />",
    ...podBorderFields,
    "    <tooldrawer-field-podstageappearance group-label='' type='dropdown-shadow' size='md' path='pod.shadow' label='Pod outside shadow' value='{{pod.shadow}}' />",
    ...buildInsideShadowFields({ owner: 'pod', label: 'Pod' }),
    ...buildStagePodCornerAppearanceFields(),
    '  </tooldrawer-cluster>',
  ];
}

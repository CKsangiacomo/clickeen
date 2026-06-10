// Bob module: builds shared Header controls for widgets that declare defaults.header + defaults.headerCta.
// Content owns: enable + copy (title/subtitle/header CTA label+href)
// Layout owns: positioning (header placement/alignment/header CTA placement)
// Appearance owns: header CTA styling (fill/colors/border/radius + sizing presets)

const headerPlacementOptions =
  '[{\"label\":\"Top\",\"value\":\"top\"},{\"label\":\"Bottom\",\"value\":\"bottom\"},{\"label\":\"Left\",\"value\":\"left\"},{\"label\":\"Right\",\"value\":\"right\"}]'.replace(
    /"/g,
    '&quot;',
  );

const headerAlignmentOptions =
  '[{\"label\":\"Left\",\"value\":\"left\"},{\"label\":\"Center\",\"value\":\"center\"},{\"label\":\"Right\",\"value\":\"right\"}]'.replace(
    /"/g,
    '&quot;',
  );

const headerCtaPlacementOptions =
  '[{\"label\":\"Right of title\",\"value\":\"right\"},{\"label\":\"Under title\",\"value\":\"below\"}]'.replace(
    /"/g,
    '&quot;',
  );

const iconPlacementOptions =
  '[{\"label\":\"Left\",\"value\":\"left\"},{\"label\":\"Right\",\"value\":\"right\"}]'.replace(/"/g, '&quot;');

const iconNameOptions =
  '[{\"label\":\"Checkmark\",\"value\":\"checkmark\"},{\"label\":\"Arrow right\",\"value\":\"arrow.right\"},{\"label\":\"Chevron right\",\"value\":\"chevron.right\"},{\"label\":\"Arrowshape forward\",\"value\":\"arrowshape.forward\"},{\"label\":\"Arrowshape turn up right\",\"value\":\"arrowshape.turn.up.right\"}]'.replace(
    /"/g,
    '&quot;',
  );

const headerCtaOpenModeOptions =
  '[{\"label\":\"Same tab\",\"value\":\"same-tab\"},{\"label\":\"New tab\",\"value\":\"new-tab\"},{\"label\":\"New window\",\"value\":\"new-window\"}]'.replace(
    /"/g,
    '&quot;',
  );

const sizePresetOptions =
  '[{\"label\":\"X-Small\",\"value\":\"xs\"},{\"label\":\"Small\",\"value\":\"s\"},{\"label\":\"Medium\",\"value\":\"m\"},{\"label\":\"Large\",\"value\":\"l\"},{\"label\":\"X-Large\",\"value\":\"xl\"},{\"label\":\"Custom\",\"value\":\"custom\"}]'.replace(
    /"/g,
    '&quot;',
  );

const radiusOptions =
  '[{\"label\":\"None\",\"value\":\"none\"},{\"label\":\"Small\",\"value\":\"sm\"},{\"label\":\"Medium\",\"value\":\"md\"},{\"label\":\"Large\",\"value\":\"lg\"},{\"label\":\"X-Large\",\"value\":\"xl\"},{\"label\":\"2XL\",\"value\":\"2xl\"}]'.replace(
    /"/g,
    '&quot;',
  );

type HeaderPanelFieldOptions = {
  includeCta?: boolean;
};

export function buildHeaderContentPanelFields({ includeCta = true }: HeaderPanelFieldOptions = {}): string[] {
  const fields = [
    '  <tooldrawer-cluster label=\'Header\'>',
      "    <tooldrawer-field-headercontent group-label='' type='toggle' size='md' path='header.enabled' label='Show header' />",
    "    <tooldrawer-field-headercontent group-label='' type='dropdown-edit' size='lg' path='header.title' label='Title' placeholder='Add title text' show-if=\"header.enabled == true\" />",
    "    <tooldrawer-field-headercontent group-label='' type='toggle' size='md' path='header.showSubtitle' label='Show subtitle' show-if=\"header.enabled == true\" />",
    "    <tooldrawer-field-headercontent group-label='' type='dropdown-edit' size='md' path='header.subtitleHtml' label='Subtitle' placeholder='Add subtitle text' show-if=\"header.enabled == true && header.showSubtitle == true\" />",
  ];

  if (includeCta) {
    fields.push(
      "    <tooldrawer-field-headercta group-label='' type='toggle' size='md' path='headerCta.enabled' label='Show header CTA' show-if=\"header.enabled == true\" />",
      "    <tooldrawer-field-headercta group-label='' type='textfield' size='md' path='headerCta.label' label='Header CTA label' show-if=\"header.enabled == true && headerCta.enabled == true\" />",
      "    <tooldrawer-field-headercta group-label='' type='textfield' size='lg' path='headerCta.href' label='Header CTA link' placeholder='https://example.com' show-if=\"header.enabled == true && headerCta.enabled == true\" />",
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='headerCta.openMode' label='Open link in' placeholder='Choose target' value='{{headerCta.openMode}}' options='${headerCtaOpenModeOptions}' show-if=\"header.enabled == true && headerCta.enabled == true\" />`,
      "    <tooldrawer-field-headercta group-label='' type='toggle' size='md' path='headerCta.iconEnabled' label='Show icon' show-if=\"header.enabled == true && headerCta.enabled == true\" />",
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='headerCta.iconPlacement' label='Icon position' placeholder='Choose position' value='{{headerCta.iconPlacement}}' options='${iconPlacementOptions}' show-if=\"header.enabled == true && headerCta.enabled == true && headerCta.iconEnabled == true\" />`,
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='headerCta.iconName' label='Icon' placeholder='Choose icon' value='{{headerCta.iconName}}' options='${iconNameOptions}' show-if=\"header.enabled == true && headerCta.enabled == true && headerCta.iconEnabled == true\" />`,
    );
  }

  fields.push('  </tooldrawer-cluster>');
  return fields;
}

export function buildHeaderLayoutPanelFields({ includeCta = true }: HeaderPanelFieldOptions = {}): string[] {
  const fields = [
    '  <tooldrawer-cluster label=\'Header\'>',
    `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.placement' label='Header placement' placeholder='Choose placement' value='{{header.placement}}' options='${headerPlacementOptions}' show-if=\"header.enabled == true\" />`,
    `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.alignment' label='Header alignment' placeholder='Choose alignment' value='{{header.alignment}}' options='${headerAlignmentOptions}' show-if=\"header.enabled == true\" />`,
    `    <tooldrawer-field-headerlayout group-label='' type='valuefield' size='md' path='header.gap' label='Header/content gap (px)' show-if=\"header.enabled == true\" />`,
    `    <tooldrawer-field-headerlayout group-label='' type='valuefield' size='md' path='header.textGap' label='Title/subtitle gap (px)' show-if=\"header.enabled == true && header.showSubtitle == true\" />`,
  ];

  if (includeCta) {
    fields.push(
      `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.ctaPlacement' label='Header CTA position' placeholder='Choose position' value='{{header.ctaPlacement}}' options='${headerCtaPlacementOptions}' show-if=\"header.enabled == true && headerCta.enabled == true\" />`,
      `    <tooldrawer-field-headerlayout group-label='' type='valuefield' size='md' path='header.innerGap' label='Text/header CTA gap (px)' show-if=\"header.enabled == true && headerCta.enabled == true\" />`,
    );
  }

  fields.push('  </tooldrawer-cluster>');
  return fields;
}

export function buildHeaderAppearancePanelFields({ includeCta = true }: HeaderPanelFieldOptions = {}): string[] {
  if (!includeCta) return [];

  return [
    '  <tooldrawer-cluster label=\'Header CTA\' show-if=\"header.enabled == true && headerCta.enabled == true\">',
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.headerCta.sizePreset' label='Size' placeholder='Choose size' value='{{appearance.headerCta.sizePreset}}' options='${sizePresetOptions}' />`,
    "    <tooldrawer-field-headerappearance group-label='' type='toggle' size='md' path='appearance.headerCta.paddingLinked' label='Link padding' value='{{appearance.headerCta.paddingLinked}}' default='true' />",
    "    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.headerCta.paddingInline' label='Padding (px)' show-if=\"appearance.headerCta.paddingLinked == true\" />",
    "    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.headerCta.paddingInline' label='Horizontal padding (px)' show-if=\"appearance.headerCta.paddingLinked == false\" />",
    "    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.headerCta.paddingBlock' label='Vertical padding (px)' show-if=\"appearance.headerCta.paddingLinked == false\" />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.headerCta.background' label='Background' value='{{appearance.headerCta.background}}' />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.headerCta.textColor' label='Text color' value='{{appearance.headerCta.textColor}}' />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-border' size='md' path='appearance.headerCta.border' label='Border' placeholder='Select a border' value='{{appearance.headerCta.border}}' />",
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.headerCta.radius' label='Corner radius' placeholder='Choose radius' value='{{appearance.headerCta.radius}}' options='${radiusOptions}' />`,
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.headerCta.iconSizePreset' label='Icon size' placeholder='Choose size' value='{{appearance.headerCta.iconSizePreset}}' options='${sizePresetOptions}' show-if=\"headerCta.iconEnabled == true\" />`,
    "    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.headerCta.iconSize' label='Custom icon size (px)' show-if=\"headerCta.iconEnabled == true && appearance.headerCta.iconSizePreset == 'custom'\" />",
    '  </tooldrawer-cluster>',
  ];
}

export function buildHeaderPresets(): Record<
  string,
  { customValue?: string; values: Record<string, Record<string, unknown>> }
> {
  return {
    'appearance.headerCta.sizePreset': {
      customValue: 'custom',
      values: {
        xs: {
          'typography.roles.button.sizePreset': 'xs',
          'appearance.headerCta.paddingLinked': false,
          'appearance.headerCta.paddingInline': 12,
          'appearance.headerCta.paddingBlock': 8,
        },
        s: {
          'typography.roles.button.sizePreset': 's',
          'appearance.headerCta.paddingLinked': false,
          'appearance.headerCta.paddingInline': 14,
          'appearance.headerCta.paddingBlock': 10,
        },
        m: {
          'typography.roles.button.sizePreset': 'm',
          'appearance.headerCta.paddingLinked': false,
          'appearance.headerCta.paddingInline': 16,
          'appearance.headerCta.paddingBlock': 12,
        },
        l: {
          'typography.roles.button.sizePreset': 'l',
          'appearance.headerCta.paddingLinked': false,
          'appearance.headerCta.paddingInline': 18,
          'appearance.headerCta.paddingBlock': 14,
        },
        xl: {
          'typography.roles.button.sizePreset': 'xl',
          'appearance.headerCta.paddingLinked': false,
          'appearance.headerCta.paddingInline': 20,
          'appearance.headerCta.paddingBlock': 16,
        },
      },
    },
    'appearance.headerCta.iconSizePreset': {
      customValue: 'custom',
      values: {
        xs: { 'appearance.headerCta.iconSize': 12 },
        s: { 'appearance.headerCta.iconSize': 14 },
        m: { 'appearance.headerCta.iconSize': 16 },
        l: { 'appearance.headerCta.iconSize': 20 },
        xl: { 'appearance.headerCta.iconSize': 24 },
      },
    },
  };
}

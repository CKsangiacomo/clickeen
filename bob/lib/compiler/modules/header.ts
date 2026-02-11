// Bob module: builds shared Header controls for widgets that declare defaults.header + defaults.cta.
// Content owns: enable + copy (title/subtitle/CTA label+href)
// Layout owns: positioning (header placement/alignment/CTA placement)
// Appearance owns: CTA styling (fill/colors/border/radius + sizing presets)

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

const ctaOpenModeOptions =
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
      "    <tooldrawer-field-headercta group-label='' type='toggle' size='md' path='cta.enabled' label='Show CTA button' show-if=\"header.enabled == true\" />",
      "    <tooldrawer-field-headercta group-label='' type='textfield' size='md' path='cta.label' label='CTA label' show-if=\"header.enabled == true && cta.enabled == true\" />",
      "    <tooldrawer-field-headercta group-label='' type='textfield' size='lg' path='cta.href' label='CTA link' placeholder='https://example.com' show-if=\"header.enabled == true && cta.enabled == true\" />",
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='cta.openMode' label='Open link in' placeholder='Choose target' value='{{cta.openMode}}' options='${ctaOpenModeOptions}' show-if=\"header.enabled == true && cta.enabled == true\" />`,
      "    <tooldrawer-field-headercta group-label='' type='toggle' size='md' path='cta.iconEnabled' label='Show icon' show-if=\"header.enabled == true && cta.enabled == true\" />",
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='cta.iconPlacement' label='Icon position' placeholder='Choose position' value='{{cta.iconPlacement}}' options='${iconPlacementOptions}' show-if=\"header.enabled == true && cta.enabled == true && cta.iconEnabled == true\" />`,
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='cta.iconName' label='Icon' placeholder='Choose icon' value='{{cta.iconName}}' options='${iconNameOptions}' show-if=\"header.enabled == true && cta.enabled == true && cta.iconEnabled == true\" />`,
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
      `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.ctaPlacement' label='CTA position' placeholder='Choose position' value='{{header.ctaPlacement}}' options='${headerCtaPlacementOptions}' show-if=\"header.enabled == true && cta.enabled == true\" />`,
      `    <tooldrawer-field-headerlayout group-label='' type='valuefield' size='md' path='header.innerGap' label='Text/CTA gap (px)' show-if=\"header.enabled == true && cta.enabled == true\" />`,
    );
  }

  fields.push('  </tooldrawer-cluster>');
  return fields;
}

export function buildHeaderAppearancePanelFields({ includeCta = true }: HeaderPanelFieldOptions = {}): string[] {
  if (!includeCta) return [];

  return [
    '  <tooldrawer-cluster label=\'CTA\' show-if=\"header.enabled == true && cta.enabled == true\">',
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.ctaSizePreset' label='Size' placeholder='Choose size' value='{{appearance.ctaSizePreset}}' options='${sizePresetOptions}' />`,
    "    <tooldrawer-field-headerappearance group-label='' type='toggle' size='md' path='appearance.ctaPaddingLinked' label='Link CTA padding' value='{{appearance.ctaPaddingLinked}}' default='true' />",
    "    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.ctaPaddingInline' label='Padding (px)' show-if=\"appearance.ctaPaddingLinked == true\" />",
    "    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.ctaPaddingInline' label='Horizontal padding (px)' show-if=\"appearance.ctaPaddingLinked == false\" />",
    "    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.ctaPaddingBlock' label='Vertical padding (px)' show-if=\"appearance.ctaPaddingLinked == false\" />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.ctaBackground' label='Background' value='{{appearance.ctaBackground}}' />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.ctaTextColor' label='Text color' value='{{appearance.ctaTextColor}}' />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-border' size='md' path='appearance.ctaBorder' label='Border' placeholder='Select a border' value='{{appearance.ctaBorder}}' />",
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.ctaRadius' label='Radius' placeholder='Choose radius' value='{{appearance.ctaRadius}}' options='${radiusOptions}' />`,
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.ctaIconSizePreset' label='Icon size' placeholder='Choose size' value='{{appearance.ctaIconSizePreset}}' options='${sizePresetOptions}' show-if=\"cta.iconEnabled == true\" />`,
    "    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.ctaIconSize' label='Custom icon size (px)' show-if=\"cta.iconEnabled == true && appearance.ctaIconSizePreset == 'custom'\" />",
    '  </tooldrawer-cluster>',
  ];
}

export function buildHeaderPresets(): Record<
  string,
  { customValue?: string; values: Record<string, Record<string, unknown>> }
> {
  return {
    'appearance.ctaSizePreset': {
      customValue: 'custom',
      values: {
        xs: {
          'typography.roles.button.sizePreset': 'xs',
          'appearance.ctaPaddingLinked': false,
          'appearance.ctaPaddingInline': 12,
          'appearance.ctaPaddingBlock': 8,
        },
        s: {
          'typography.roles.button.sizePreset': 's',
          'appearance.ctaPaddingLinked': false,
          'appearance.ctaPaddingInline': 14,
          'appearance.ctaPaddingBlock': 10,
        },
        m: {
          'typography.roles.button.sizePreset': 'm',
          'appearance.ctaPaddingLinked': false,
          'appearance.ctaPaddingInline': 16,
          'appearance.ctaPaddingBlock': 12,
        },
        l: {
          'typography.roles.button.sizePreset': 'l',
          'appearance.ctaPaddingLinked': false,
          'appearance.ctaPaddingInline': 18,
          'appearance.ctaPaddingBlock': 14,
        },
        xl: {
          'typography.roles.button.sizePreset': 'xl',
          'appearance.ctaPaddingLinked': false,
          'appearance.ctaPaddingInline': 20,
          'appearance.ctaPaddingBlock': 16,
        },
      },
    },
    'appearance.ctaIconSizePreset': {
      customValue: 'custom',
      values: {
        xs: { 'appearance.ctaIconSize': 12 },
        s: { 'appearance.ctaIconSize': 14 },
        m: { 'appearance.ctaIconSize': 16 },
        l: { 'appearance.ctaIconSize': 20 },
        xl: { 'appearance.ctaIconSize': 24 },
      },
    },
  };
}

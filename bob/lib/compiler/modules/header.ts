// Bob module: builds shared Header controls for widgets that declare defaults.header + defaults.cta.
// Content owns: enable + copy (title/subtitle/CTA label+href)
// Layout owns: positioning (header placement/alignment/CTA placement)
// Appearance owns: CTA styling (fill/colors/radius/variant)

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

const ctaVariantOptions =
  '[{\"label\":\"Filled\",\"value\":\"filled\"},{\"label\":\"Outline\",\"value\":\"outline\"}]'.replace(/"/g, '&quot;');

const radiusOptions =
  '[{\"label\":\"None\",\"value\":\"none\"},{\"label\":\"Small\",\"value\":\"sm\"},{\"label\":\"Medium\",\"value\":\"md\"},{\"label\":\"Large\",\"value\":\"lg\"},{\"label\":\"X-Large\",\"value\":\"xl\"},{\"label\":\"2XL\",\"value\":\"2xl\"}]'.replace(
    /"/g,
    '&quot;',
  );

export function buildHeaderContentPanelFields(): string[] {
  return [
    '  <tooldrawer-cluster label=\'Header\'>',
    "    <tooldrawer-field-headercontent group-label='' type='toggle' size='md' path='header.enabled' label='Show header' />",
    "    <tooldrawer-field-headercontent group-label='' type='dropdown-edit' size='lg' path='header.title' label='Title' placeholder='Add title text' show-if=\"header.enabled == true\" />",
    "    <tooldrawer-field-headercontent group-label='' type='toggle' size='md' path='header.showSubtitle' label='Show subtitle' show-if=\"header.enabled == true\" />",
    "    <tooldrawer-field-headercontent group-label='' type='dropdown-edit' size='md' path='header.subtitleHtml' label='Subtitle' placeholder='Add subtitle text' show-if=\"header.enabled == true && header.showSubtitle == true\" />",
    "    <tooldrawer-field-headercta group-label='' type='toggle' size='md' path='cta.enabled' label='Show CTA button' show-if=\"header.enabled == true\" />",
    "    <tooldrawer-field-headercta group-label='' type='textfield' size='md' path='cta.label' label='CTA label' show-if=\"header.enabled == true && cta.enabled == true\" />",
    "    <tooldrawer-field-headercta group-label='' type='textfield' size='lg' path='cta.href' label='CTA link' placeholder='https://example.com' show-if=\"header.enabled == true && cta.enabled == true\" />",
    '  </tooldrawer-cluster>',
  ];
}

export function buildHeaderLayoutPanelFields(): string[] {
  return [
    '  <tooldrawer-cluster label=\'Header\'>',
    `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.placement' label='Header placement' placeholder='Choose placement' value='{{header.placement}}' options='${headerPlacementOptions}' show-if=\"header.enabled == true\" />`,
    `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.alignment' label='Header alignment' placeholder='Choose alignment' value='{{header.alignment}}' options='${headerAlignmentOptions}' show-if=\"header.enabled == true\" />`,
    `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.ctaPlacement' label='CTA position' placeholder='Choose position' value='{{header.ctaPlacement}}' options='${headerCtaPlacementOptions}' show-if=\"header.enabled == true && cta.enabled == true\" />`,
    '  </tooldrawer-cluster>',
  ];
}

export function buildHeaderAppearancePanelFields(): string[] {
  return [
    '  <tooldrawer-cluster label=\'CTA\' show-if=\"header.enabled == true && cta.enabled == true\">',
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.ctaBackground' label='CTA background' value='{{appearance.ctaBackground}}' />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.ctaTextColor' label='CTA text color' value='{{appearance.ctaTextColor}}' />",
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.ctaRadius' label='CTA radius' placeholder='Choose radius' value='{{appearance.ctaRadius}}' options='${radiusOptions}' />`,
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='cta.style' label='CTA style' placeholder='Choose style' value='{{cta.style}}' options='${ctaVariantOptions}' />`,
    '  </tooldrawer-cluster>',
  ];
}

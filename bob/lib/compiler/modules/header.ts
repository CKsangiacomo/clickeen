// Bob module: builds shared Header controls for widgets that declare defaults.header + defaults.headerCta.
// Content owns: enable + copy (title/subtitle/header CTA label+href)
// Layout owns: positioning (header placement/alignment/header CTA placement)
// Appearance owns: header CTA styling (fill/colors/border/radius + sizing presets)

import { encodeHtmlEntities } from '../../compiler.shared';
import headerCopy from '../../../l10n/editor/header/en.json';

const encodeOptions = (value: Array<{ label: string; value: string }>) =>
  encodeHtmlEntities(JSON.stringify(value));

const headerPlacementOptions = encodeOptions(
  [
    { label: headerCopy.options.top, value: 'top' },
    { label: headerCopy.options.bottom, value: 'bottom' },
    { label: headerCopy.options.left, value: 'left' },
    { label: headerCopy.options.right, value: 'right' },
  ],
);

const headerAlignmentOptions = encodeOptions(
  [
    { label: headerCopy.options.left, value: 'left' },
    { label: headerCopy.options.center, value: 'center' },
    { label: headerCopy.options.right, value: 'right' },
  ],
);

const headerCtaPlacementOptions = encodeOptions(
  [
    { label: headerCopy.options.rightOfTitle, value: 'right' },
    { label: headerCopy.options.underTitle, value: 'below' },
  ],
);

const iconPlacementOptions = encodeOptions(
  [
    { label: headerCopy.options.left, value: 'left' },
    { label: headerCopy.options.right, value: 'right' },
  ],
);

const iconNameOptions = encodeOptions(
  [
    { label: headerCopy.options.checkmark, value: 'checkmark' },
    { label: headerCopy.options.arrowRight, value: 'arrow.right' },
    { label: headerCopy.options.chevronRight, value: 'chevron.right' },
    { label: headerCopy.options.arrowshapeForward, value: 'arrowshape.forward' },
    { label: headerCopy.options.arrowshapeTurnUpRight, value: 'arrowshape.turn.up.right' },
  ],
);

const headerCtaOpenModeOptions = encodeOptions(
  [
    { label: headerCopy.options.sameTab, value: 'same-tab' },
    { label: headerCopy.options.newTab, value: 'new-tab' },
    { label: headerCopy.options.newWindow, value: 'new-window' },
  ],
);

const sizePresetOptions = encodeOptions(
  [
    { label: headerCopy.options.xSmall, value: 'xs' },
    { label: headerCopy.options.small, value: 's' },
    { label: headerCopy.options.medium, value: 'm' },
    { label: headerCopy.options.large, value: 'l' },
    { label: headerCopy.options.xLarge, value: 'xl' },
    { label: headerCopy.options.custom, value: 'custom' },
  ],
);

const radiusOptions = encodeOptions(
  [
    { label: headerCopy.options.none, value: 'none' },
    { label: headerCopy.options.small, value: 'sm' },
    { label: headerCopy.options.medium, value: 'md' },
    { label: headerCopy.options.large, value: 'lg' },
    { label: headerCopy.options.xLarge, value: 'xl' },
    { label: headerCopy.options.twoXL, value: '2xl' },
  ],
);

type HeaderPanelFieldOptions = {
  includeCta?: boolean;
};

export function buildHeaderContentPanelFields({
  includeCta = true,
}: HeaderPanelFieldOptions = {}): string[] {
  const fields = [
    `  <tooldrawer-cluster label='${headerCopy.clusters.header}' initially-open='true'>`,
    `    <tooldrawer-field-headercontent group-label='' type='toggle' size='md' path='header.enabled' label='${headerCopy.fields.showHeader}' />`,
    `    <tooldrawer-field-headercontent group-label='' type='dropdown-edit' size='lg' path='header.title' label='${headerCopy.fields.title}' placeholder='${headerCopy.fields.titlePlaceholder}' show-if="header.enabled == true" />`,
    `    <tooldrawer-field-headercontent group-label='' type='toggle' size='md' path='header.showSubtitle' label='${headerCopy.fields.showSubtitle}' show-if="header.enabled == true" />`,
    `    <tooldrawer-field-headercontent group-label='' type='dropdown-edit' size='md' path='header.subtitleHtml' label='${headerCopy.fields.subtitle}' placeholder='${headerCopy.fields.subtitlePlaceholder}' show-if="header.enabled == true && header.showSubtitle == true" />`,
  ];

  if (includeCta) {
    fields.push(
      `    <tooldrawer-field-headercta group-label='' type='toggle' size='md' path='headerCta.enabled' label='${headerCopy.fields.showHeaderCta}' show-if="header.enabled == true" />`,
      `    <tooldrawer-field-headercta group-label='' type='textfield' size='md' path='headerCta.label' label='${headerCopy.fields.headerCtaLabel}' show-if="header.enabled == true && headerCta.enabled == true" />`,
      `    <tooldrawer-field-headercta group-label='' type='textfield' size='lg' path='headerCta.href' label='${headerCopy.fields.headerCtaLink}' placeholder='${headerCopy.fields.headerCtaLinkPlaceholder}' show-if="header.enabled == true && headerCta.enabled == true" />`,
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='headerCta.openMode' label='${headerCopy.fields.openLinkIn}' placeholder='${headerCopy.fields.chooseTarget}' value='{{headerCta.openMode}}' options='${headerCtaOpenModeOptions}' show-if="header.enabled == true && headerCta.enabled == true" />`,
      `    <tooldrawer-field-headercta group-label='' type='toggle' size='md' path='headerCta.iconEnabled' label='${headerCopy.fields.showIcon}' show-if="header.enabled == true && headerCta.enabled == true" />`,
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='headerCta.iconPlacement' label='${headerCopy.fields.iconPosition}' placeholder='${headerCopy.fields.choosePosition}' value='{{headerCta.iconPlacement}}' options='${iconPlacementOptions}' show-if="header.enabled == true && headerCta.enabled == true && headerCta.iconEnabled == true" />`,
      `    <tooldrawer-field-headercta group-label='' type='dropdown-actions' size='md' path='headerCta.iconName' label='${headerCopy.fields.icon}' placeholder='${headerCopy.fields.chooseIcon}' value='{{headerCta.iconName}}' options='${iconNameOptions}' show-if="header.enabled == true && headerCta.enabled == true && headerCta.iconEnabled == true" />`,
    );
  }

  fields.push('  </tooldrawer-cluster>');
  return fields;
}

export function buildHeaderLayoutPanelFields({
  includeCta = true,
}: HeaderPanelFieldOptions = {}): string[] {
  const fields = [
    `  <tooldrawer-cluster label='${headerCopy.clusters.header}'>`,
    `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.placement' label='${headerCopy.fields.headerPlacement}' placeholder='${headerCopy.fields.choosePlacement}' value='{{header.placement}}' options='${headerPlacementOptions}' show-if="header.enabled == true" />`,
    `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.alignment' label='${headerCopy.fields.headerAlignment}' placeholder='${headerCopy.fields.chooseAlignment}' value='{{header.alignment}}' options='${headerAlignmentOptions}' show-if="header.enabled == true" />`,
    `    <tooldrawer-field-headerlayout group-label='' type='valuefield' size='md' path='header.gap' label='${headerCopy.fields.headerContentGap}' min='0' show-if="header.enabled == true" />`,
    `    <tooldrawer-field-headerlayout group-label='' type='valuefield' size='md' path='header.textGap' label='${headerCopy.fields.titleSubtitleGap}' min='0' show-if="header.enabled == true && header.showSubtitle == true" />`,
  ];

  if (includeCta) {
    fields.push(
      `    <tooldrawer-field-headerlayout group-label='' type='dropdown-actions' size='md' path='header.ctaPlacement' label='${headerCopy.fields.headerCtaPosition}' placeholder='${headerCopy.fields.choosePosition}' value='{{header.ctaPlacement}}' options='${headerCtaPlacementOptions}' show-if="header.enabled == true && headerCta.enabled == true" />`,
      `    <tooldrawer-field-headerlayout group-label='' type='valuefield' size='md' path='header.innerGap' label='${headerCopy.fields.textHeaderCtaGap}' min='0' show-if="header.enabled == true && headerCta.enabled == true" />`,
    );
  }

  fields.push('  </tooldrawer-cluster>');
  return fields;
}

export function buildHeaderAppearancePanelFields({
  includeCta = true,
}: HeaderPanelFieldOptions = {}): string[] {
  if (!includeCta) return [];

  return [
    `  <tooldrawer-cluster label='${headerCopy.clusters.headerCta}' show-if="header.enabled == true && headerCta.enabled == true">`,
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.headerCta.sizePreset' label='${headerCopy.fields.size}' placeholder='${headerCopy.fields.chooseSize}' value='{{appearance.headerCta.sizePreset}}' options='${sizePresetOptions}' />`,
    `    <tooldrawer-field-headerappearance group-label='' type='toggle' size='md' path='appearance.headerCta.paddingLinked' label='${headerCopy.fields.linkPadding}' value='{{appearance.headerCta.paddingLinked}}' default='true' />`,
    `    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.headerCta.paddingInline' label='${headerCopy.fields.padding}' min='0' show-if="appearance.headerCta.paddingLinked == true" />`,
    `    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.headerCta.paddingInline' label='${headerCopy.fields.horizontalPadding}' min='0' show-if="appearance.headerCta.paddingLinked == false" />`,
    `    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.headerCta.paddingBlock' label='${headerCopy.fields.verticalPadding}' min='0' show-if="appearance.headerCta.paddingLinked == false" />`,
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.headerCta.background' label='' value='{{appearance.headerCta.background}}' />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-fill' size='md' fill-modes='color' path='appearance.headerCta.textColor' label='' value='{{appearance.headerCta.textColor}}' />",
    "    <tooldrawer-field-headerappearance group-label='' type='dropdown-border' size='md' path='appearance.headerCta.border' label='' value='{{appearance.headerCta.border}}' />",
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.headerCta.radius' label='${headerCopy.fields.cornerRadius}' placeholder='${headerCopy.fields.chooseRadius}' value='{{appearance.headerCta.radius}}' options='${radiusOptions}' />`,
    `    <tooldrawer-field-headerappearance group-label='' type='dropdown-actions' size='md' path='appearance.headerCta.iconSizePreset' label='${headerCopy.fields.iconSize}' placeholder='${headerCopy.fields.chooseSize}' value='{{appearance.headerCta.iconSizePreset}}' options='${sizePresetOptions}' show-if="headerCta.iconEnabled == true" />`,
    `    <tooldrawer-field-headerappearance group-label='' type='valuefield' size='md' path='appearance.headerCta.iconSize' label='${headerCopy.fields.customIconSize}' min='0' show-if="headerCta.iconEnabled == true && appearance.headerCta.iconSizePreset == 'custom'" />`,
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

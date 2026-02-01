// Bob module: builds standardized Typography panel markup for widgets that declare typography roles.
// Specs should declare defaults.typography.roles + defaults.typography.roleScales; the compiler injects the panel using this helper.

import {
  CK_TYPOGRAPHY_FONTS,
  CK_TYPOGRAPHY_WEIGHT_OPTIONS,
  getCkTypographyAllowedStyles,
  getCkTypographyAllowedWeights,
} from '../../edit/typography-fonts';

export const TYPOGRAPHY_SIZE_OPTIONS = [
  { label: 'X-Small', value: 'xs' },
  { label: 'Small', value: 's' },
  { label: 'Medium', value: 'm' },
  { label: 'Large', value: 'l' },
  { label: 'X-Large', value: 'xl' },
  { label: 'Custom', value: 'custom' },
];

export const TYPOGRAPHY_STYLE_OPTIONS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Italic', value: 'italic' },
];

function encodeOptions(options: Array<Record<string, string>>): string {
  return JSON.stringify(options).replace(/"/g, '&quot;');
}

export function buildTypographyPanel(args: {
  roles: Record<string, unknown>;
  roleScales?: Record<string, Record<string, string>>;
}): string[] {
  const fontsOptions = encodeOptions(
    CK_TYPOGRAPHY_FONTS.map((font) => ({
      label: font,
      value: font,
      weights: getCkTypographyAllowedWeights(font).join(','),
      styles: getCkTypographyAllowedStyles(font).join(','),
    })),
  );
  const sizeOptions = encodeOptions(TYPOGRAPHY_SIZE_OPTIONS);
  const styleOptions = encodeOptions(TYPOGRAPHY_STYLE_OPTIONS);
  const weightOptions = encodeOptions(CK_TYPOGRAPHY_WEIGHT_OPTIONS);

  const roleEntries: Array<{ key: string; label: string }> = [
    { key: 'title', label: 'Title' },
    { key: 'section', label: 'Section' },
    { key: 'question', label: 'Questions' },
    { key: 'answer', label: 'Answers' },
    { key: 'heading', label: 'Heading' },
    { key: 'timer', label: 'Timer' },
    { key: 'label', label: 'Labels' },
    { key: 'button', label: 'CTA' },
  ].filter((entry) => args.roles && Object.prototype.hasOwnProperty.call(args.roles, entry.key));

  if (roleEntries.length === 0) return [];

  const lines: string[] = ["<bob-panel id='typography'>"];
  const groupAttr = "group-label=''";
  lines.push(
    `  <tooldrawer-field-typofields ${groupAttr} type='textfield' size='md' path='typography.globalFamily' label='Global font family' value='{{typography.globalFamily}}' show-if="false" />`,
  );
  roleEntries.forEach((role) => {
    const roleLabel = role.label;
    lines.push(`  <tooldrawer-cluster label='${roleLabel}'>`);
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.family' label='Font family' placeholder='Choose font' value='{{typography.roles.${role.key}.family}}' options='${fontsOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.sizePreset' label='Size' placeholder='Choose size' value='{{typography.roles.${role.key}.sizePreset}}' options='${sizeOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='valuefield' size='md' path='typography.roles.${role.key}.sizeCustom' label='Custom size (px)' min='0' max='200' step='1' value='{{typography.roles.${role.key}.sizeCustom}}' show-if=\"typography.roles.${role.key}.sizePreset == 'custom'\" />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.fontStyle' label='Style' placeholder='Choose style' value='{{typography.roles.${role.key}.fontStyle}}' options='${styleOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.weight' label='Weight' placeholder='Choose weight' value='{{typography.roles.${role.key}.weight}}' options='${weightOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-fill' size='md' allow-image='false' path='typography.roles.${role.key}.color' label='Color' value='{{typography.roles.${role.key}.color}}' />`,
    );
    lines.push('  </tooldrawer-cluster>');
  });
  lines.push('</bob-panel>');
  return lines;
}

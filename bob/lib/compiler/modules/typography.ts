// Bob module: builds standardized Typography panel markup for widgets that declare typography roles.
// Specs should declare defaults.typography.roles + defaults.typography.roleScales; the compiler injects the panel using this helper.

import {
  CK_TYPOGRAPHY_WEIGHT_OPTIONS,
  buildCkTypographyFamilyOptions,
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

export const TYPOGRAPHY_TRACKING_OPTIONS = [
  { label: 'Tighter', value: 'tighter' },
  { label: 'Tight', value: 'tight' },
  { label: 'Normal', value: 'normal' },
  { label: 'Wide', value: 'wide' },
  { label: 'Wider', value: 'wider' },
  { label: 'Custom', value: 'custom' },
];

export const TYPOGRAPHY_LINE_HEIGHT_OPTIONS = [
  { label: 'Snug', value: 'snug' },
  { label: 'Tight', value: 'tight' },
  { label: 'Normal', value: 'normal' },
  { label: 'Relaxed', value: 'relaxed' },
  { label: 'Loose', value: 'loose' },
  { label: 'Custom', value: 'custom' },
];

function encodeOptions(options: unknown[]): string {
  return JSON.stringify(options).replace(/"/g, '&quot;');
}

export function buildTypographyPanel(args: {
  roles: Record<string, unknown>;
  roleScales?: Record<string, Record<string, string>>;
}): string[] {
  const fontsOptions = encodeOptions(buildCkTypographyFamilyOptions());
  const sizeOptions = encodeOptions(TYPOGRAPHY_SIZE_OPTIONS);
  const styleOptions = encodeOptions(TYPOGRAPHY_STYLE_OPTIONS);
  const weightOptions = encodeOptions(CK_TYPOGRAPHY_WEIGHT_OPTIONS);
  const trackingOptions = encodeOptions(TYPOGRAPHY_TRACKING_OPTIONS);
  const lineHeightOptions = encodeOptions(TYPOGRAPHY_LINE_HEIGHT_OPTIONS);
  const hasRole = (roleKey: string) => {
    if (!args.roles || !Object.prototype.hasOwnProperty.call(args.roles, roleKey)) return false;
    const value = (args.roles as Record<string, unknown>)[roleKey];
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  };

  const roleEntries: Array<{ key: string; label: string }> = [
    { key: 'title', label: 'Title' },
    { key: 'body', label: 'Body' },
    { key: 'section', label: 'Eyebrow' },
    { key: 'question', label: 'Question' },
    { key: 'answer', label: 'Answer' },
    { key: 'heading', label: 'Heading' },
    { key: 'timer', label: 'Timer' },
    { key: 'label', label: 'Labels' },
    { key: 'button', label: 'CTA' },
  ].filter((entry) => hasRole(entry.key));

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
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.lineHeightPreset' label='Line spacing' placeholder='Choose line spacing' value='{{typography.roles.${role.key}.lineHeightPreset}}' options='${lineHeightOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='valuefield' size='md' path='typography.roles.${role.key}.lineHeightCustom' label='Custom line spacing' min='0.5' max='3' step='0.01' value='{{typography.roles.${role.key}.lineHeightCustom}}' show-if=\"typography.roles.${role.key}.lineHeightPreset == 'custom'\" />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.trackingPreset' label='Letter spacing' placeholder='Choose spacing' value='{{typography.roles.${role.key}.trackingPreset}}' options='${trackingOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='valuefield' size='md' path='typography.roles.${role.key}.trackingCustom' label='Custom letter spacing (em)' min='-2' max='2' step='0.001' value='{{typography.roles.${role.key}.trackingCustom}}' show-if=\"typography.roles.${role.key}.trackingPreset == 'custom'\" />`,
    );
    lines.push('  </tooldrawer-cluster>');
  });
  lines.push('</bob-panel>');
  return lines;
}

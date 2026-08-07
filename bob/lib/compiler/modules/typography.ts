// Bob module: builds standardized Typography panel markup for widgets that declare typography roles.
// Specs declare the shared typography panel explicitly in spec.json.editor; this helper renders that declared panel.

import { COMMON_WIDGET_TYPOGRAPHY_ROLE_LABELS } from '@clickeen/widget-foundation';
import { encodeHtmlEntities } from '../../compiler.shared';

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

const TYPOGRAPHY_WEIGHT_LABELS: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra light',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semi-bold',
  '700': 'Bold',
  '800': 'Extra bold',
  '900': 'Black',
};

export const TYPOGRAPHY_WEIGHT_OPTIONS = Object.entries(TYPOGRAPHY_WEIGHT_LABELS).map(
  ([value, label]) => ({ label: `${label} (${value})`, value }),
);

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
  return encodeHtmlEntities(JSON.stringify(options));
}

export function buildTypographyPanel(args: {
  roles: Record<string, unknown>;
  roleLabels?: Record<string, string>;
}): string[] {
  const fontsOptions = encodeOptions([]);
  const sizeOptions = encodeOptions(TYPOGRAPHY_SIZE_OPTIONS);
  const styleOptions = encodeOptions(TYPOGRAPHY_STYLE_OPTIONS);
  const weightOptions = encodeOptions(TYPOGRAPHY_WEIGHT_OPTIONS);
  const trackingOptions = encodeOptions(TYPOGRAPHY_TRACKING_OPTIONS);
  const lineHeightOptions = encodeOptions(TYPOGRAPHY_LINE_HEIGHT_OPTIONS);
  const suppliedRoleLabels = args.roleLabels ?? {};
  for (const roleKey of Object.keys(suppliedRoleLabels)) {
    if (!Object.prototype.hasOwnProperty.call(args.roles, roleKey)) {
      throw new Error(`[BobCompiler] typography role label "${roleKey}" has no composed role`);
    }
  }
  const composedRoleKeys = Object.keys(args.roles);
  const composedWidgetRoleKeys = composedRoleKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(COMMON_WIDGET_TYPOGRAPHY_ROLE_LABELS, key),
  );
  const declaredWidgetRoleKeys = Object.keys(suppliedRoleLabels).filter((key) =>
    composedWidgetRoleKeys.includes(key),
  );
  const widgetRoleKeys = [
    ...declaredWidgetRoleKeys,
    ...composedWidgetRoleKeys.filter((key) => !declaredWidgetRoleKeys.includes(key)),
  ];
  const orderedRoleKeys = ['title', 'body', ...widgetRoleKeys, 'button', 'localeSwitcher'].filter(
    (key, index, keys) => composedRoleKeys.includes(key) && keys.indexOf(key) === index,
  );
  const roleEntries: Array<{ key: string; label: string }> = orderedRoleKeys.map((key) => {
    const value = args.roles[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[BobCompiler] typography role "${key}" must be an object`);
    }
    const label =
      suppliedRoleLabels[key] ??
      COMMON_WIDGET_TYPOGRAPHY_ROLE_LABELS[key as keyof typeof COMMON_WIDGET_TYPOGRAPHY_ROLE_LABELS];
    if (!label) {
      throw new Error(`[BobCompiler] typography role "${key}" requires a product label`);
    }
    return { key, label };
  });

  if (roleEntries.length === 0) return [];

  const lines: string[] = ["<bob-panel id='typography'>"];
  lines.push(
    `  <tooldrawer-field-typofields group-label='' type='textfield' size='md' path='typography.globalFamily' label='Global font family' value='{{typography.globalFamily}}' show-if="false" />`,
  );
  roleEntries.forEach((role) => {
    const roleLabel = encodeHtmlEntities(role.label);
    const groupAttr = `group-label='${roleLabel}'`;
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
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-fill' size='md' fill-modes='color' path='typography.roles.${role.key}.color' label='Color' value='{{typography.roles.${role.key}.color}}' />`,
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

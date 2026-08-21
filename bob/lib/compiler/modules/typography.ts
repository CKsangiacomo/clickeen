// Bob module: builds standardized Typography panel markup for widgets that declare typography roles.
// Specs declare the shared typography panel explicitly in spec.json.editor; this helper renders that declared panel.

import { COMMON_WIDGET_TYPOGRAPHY_ROLES } from '@clickeen/widget-foundation';
import { encodeHtmlEntities } from '../../compiler.shared';
import typographyCopy from '../../../l10n/editor/typography/en.json';

export const TYPOGRAPHY_SIZE_OPTIONS = [
  { label: typographyCopy.options.xSmall, value: 'xs' },
  { label: typographyCopy.options.small, value: 's' },
  { label: typographyCopy.options.medium, value: 'm' },
  { label: typographyCopy.options.large, value: 'l' },
  { label: typographyCopy.options.xLarge, value: 'xl' },
  { label: typographyCopy.options.custom, value: 'custom' },
];

export const TYPOGRAPHY_STYLE_OPTIONS = [
  { label: typographyCopy.options.normal, value: 'normal' },
  { label: typographyCopy.options.italic, value: 'italic' },
];

const TYPOGRAPHY_WEIGHT_LABELS: Record<string, string> = {
  '100': typographyCopy.options.thin,
  '200': typographyCopy.options.extraLight,
  '300': typographyCopy.options.light,
  '400': typographyCopy.options.regular,
  '500': typographyCopy.options.medium,
  '600': typographyCopy.options.semiBold,
  '700': typographyCopy.options.bold,
  '800': typographyCopy.options.extraBold,
  '900': typographyCopy.options.black,
};

const COMMON_WIDGET_TYPOGRAPHY_ROLE_LABELS: Record<
  (typeof COMMON_WIDGET_TYPOGRAPHY_ROLES)[number],
  string
> = {
  title: typographyCopy.roles.title,
  body: typographyCopy.roles.body,
  button: typographyCopy.roles.button,
  localeSwitcher: typographyCopy.roles.localeSwitcher,
};

export const TYPOGRAPHY_WEIGHT_OPTIONS = Object.entries(TYPOGRAPHY_WEIGHT_LABELS).map(
  ([value, label]) => ({
    label: typographyCopy.formats.weightOption
      .replace('{label}', label)
      .replace('{value}', value),
    value,
  }),
);

export const TYPOGRAPHY_TRACKING_OPTIONS = [
  { label: typographyCopy.options.tighter, value: 'tighter' },
  { label: typographyCopy.options.tight, value: 'tight' },
  { label: typographyCopy.options.normal, value: 'normal' },
  { label: typographyCopy.options.wide, value: 'wide' },
  { label: typographyCopy.options.wider, value: 'wider' },
  { label: typographyCopy.options.custom, value: 'custom' },
];

export const TYPOGRAPHY_LINE_HEIGHT_OPTIONS = [
  { label: typographyCopy.options.snug, value: 'snug' },
  { label: typographyCopy.options.tight, value: 'tight' },
  { label: typographyCopy.options.normal, value: 'normal' },
  { label: typographyCopy.options.relaxed, value: 'relaxed' },
  { label: typographyCopy.options.loose, value: 'loose' },
  { label: typographyCopy.options.custom, value: 'custom' },
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
    `  <tooldrawer-field-typofields group-label='' type='textfield' size='md' path='typography.globalFamily' label='${typographyCopy.fields.globalFontFamily}' value='{{typography.globalFamily}}' show-if="false" />`,
  );
  roleEntries.forEach((role) => {
    const roleLabel = encodeHtmlEntities(role.label);
    const groupAttr = `group-label='${roleLabel}'`;
    lines.push(`  <tooldrawer-cluster label='${roleLabel}'>`);
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.family' label='${typographyCopy.fields.fontFamily}' placeholder='${typographyCopy.fields.chooseFont}' value='{{typography.roles.${role.key}.family}}' options='${fontsOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.sizePreset' label='${typographyCopy.fields.size}' placeholder='${typographyCopy.fields.chooseSize}' value='{{typography.roles.${role.key}.sizePreset}}' options='${sizeOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='valuefield' size='md' path='typography.roles.${role.key}.sizeCustom' label='${typographyCopy.fields.customSize}' min='0' max='200' step='1' value='{{typography.roles.${role.key}.sizeCustom}}' show-if="typography.roles.${role.key}.sizePreset == 'custom'" />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.fontStyle' label='${typographyCopy.fields.style}' placeholder='${typographyCopy.fields.chooseStyle}' value='{{typography.roles.${role.key}.fontStyle}}' options='${styleOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.weight' label='${typographyCopy.fields.weight}' placeholder='${typographyCopy.fields.chooseWeight}' value='{{typography.roles.${role.key}.weight}}' options='${weightOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-fill' size='md' fill-modes='color' path='typography.roles.${role.key}.color' label='' value='{{typography.roles.${role.key}.color}}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.lineHeightPreset' label='${typographyCopy.fields.lineSpacing}' placeholder='${typographyCopy.fields.chooseLineSpacing}' value='{{typography.roles.${role.key}.lineHeightPreset}}' options='${lineHeightOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='valuefield' size='md' path='typography.roles.${role.key}.lineHeightCustom' label='${typographyCopy.fields.customLineSpacing}' min='0.5' max='3' step='0.01' value='{{typography.roles.${role.key}.lineHeightCustom}}' show-if="typography.roles.${role.key}.lineHeightPreset == 'custom'" />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='dropdown-actions' size='md' path='typography.roles.${role.key}.trackingPreset' label='${typographyCopy.fields.letterSpacing}' placeholder='${typographyCopy.fields.chooseSpacing}' value='{{typography.roles.${role.key}.trackingPreset}}' options='${trackingOptions}' />`,
    );
    lines.push(
      `    <tooldrawer-field-typofields ${groupAttr} type='valuefield' size='md' path='typography.roles.${role.key}.trackingCustom' label='${typographyCopy.fields.customLetterSpacing}' min='-2' max='2' step='0.001' value='{{typography.roles.${role.key}.trackingCustom}}' show-if="typography.roles.${role.key}.trackingPreset == 'custom'" />`,
    );
    lines.push('  </tooldrawer-cluster>');
  });
  lines.push('</bob-panel>');
  return lines;
}

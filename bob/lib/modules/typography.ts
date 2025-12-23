// Bob module: builds standardized Typography panel markup for widgets that declare typography roles.
// Specs should only declare defaults.typography.roles; the compiler injects the panel using this helper.

export const TYPOGRAPHY_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Google Sans',
  'Playfair Display',
  'Ubuntu',
  'Rubik',
  'Roboto Slab',
  'DM Sans',
  'Merriweather',
  'IBM Plex Sans',
  'Barlow',
  'Bebas Neue',
  'DM Serif Text',
  'Zalando Sans Expanded',
  'Caprasimo',
  'Pacifico',
];

export const TYPOGRAPHY_SIZE_OPTIONS = [
  { label: 'Small', value: 's' },
  { label: 'Medium', value: 'm' },
  { label: 'Large', value: 'l' },
  { label: 'X-Large', value: 'xl' },
];

export const TYPOGRAPHY_WEIGHT_OPTIONS = [
  { label: 'Normal', value: '400' },
  { label: 'Semi-bold', value: '600' },
];

function encodeOptions(options: Array<Record<string, string>>): string {
  return JSON.stringify(options).replace(/"/g, '&quot;');
}

export function buildTypographyPanel(roles: Record<string, unknown>): string[] {
  const fontsOptions = encodeOptions(TYPOGRAPHY_FONTS.map((font) => ({ label: font, value: font })));
  const sizeOptions = encodeOptions(TYPOGRAPHY_SIZE_OPTIONS);
  const weightOptions = encodeOptions(TYPOGRAPHY_WEIGHT_OPTIONS);

  const roleEntries: Array<{ key: string; label: string }> = [
    { key: 'title', label: 'Title' },
    { key: 'section', label: 'Section title' },
    { key: 'question', label: 'Questions' },
    { key: 'answer', label: 'Answers' },
    { key: 'heading', label: 'Heading' },
    { key: 'timer', label: 'Timer' },
    { key: 'label', label: 'Labels' },
    { key: 'button', label: 'Buttons' },
  ].filter((entry) => roles && Object.prototype.hasOwnProperty.call(roles, entry.key));

  if (roleEntries.length === 0) return [];

  const lines: string[] = ["<bob-panel id='typography'>"];
  roleEntries.forEach((role) => {
    lines.push(`  <tooldrawer-eyebrow text='${role.label}' />`);
    lines.push(
      `  <tooldrawer-field type='dropdown-actions' size='md' path='typography.roles.${role.key}.family' label='Font family' placeholder='Choose font' options='${fontsOptions}' />`,
    );
    lines.push(
      `  <tooldrawer-field type='dropdown-actions' size='md' path='typography.roles.${role.key}.sizePreset' label='Size' options='${sizeOptions}' />`,
    );
    lines.push(
      `  <tooldrawer-field type='dropdown-actions' size='md' path='typography.roles.${role.key}.weight' label='Weight' options='${weightOptions}' />`,
    );
  });
  lines.push('</bob-panel>');
  return lines;
}

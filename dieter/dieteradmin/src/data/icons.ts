const iconModules = import.meta.glob('@dieter/icons/svg/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const icons: Record<string, string> = {};

for (const [path, markup] of Object.entries(iconModules)) {
  const name = path.split('/').pop()?.replace(/\.svg$/, '');
  if (!name) continue;
  const normalized = markup.includes('aria-hidden')
    ? markup
    : markup.replace('<svg', '<svg aria-hidden="true" focusable="false"');
  icons[name] = normalized;
}

export const ICONS = icons;
export type IconName = keyof typeof icons;

export function getIcon(name: string) {
  return icons[name];
}

export function resolvePragueHref(opts: { href: string; locale: string; widget?: string }): string {
  const raw = String(opts.href || '').trim();
  if (!raw) return '#';

  // Anchor links are locale-free and safe to pass through.
  if (raw.startsWith('#')) return raw;

  const withPlaceholders = opts.widget ? raw.replaceAll('{widget}', opts.widget) : raw;

  // If this is already a fully qualified URL, do not touch it.
  // (We generally shouldn't use these in scalable Prague specs, but keep it safe.)
  if (/^https?:\/\//i.test(withPlaceholders)) return withPlaceholders;

  // Ensure it starts with "/" so we can prefix locale.
  const path = withPlaceholders.startsWith('/') ? withPlaceholders : `/${withPlaceholders}`;

  // If already locale-prefixed (e.g. /en/...), keep it.
  if (/^\/[a-z]{2}(?:-[a-z0-9]{2,8})?\//i.test(path)) return path;

  const locale = String(opts.locale || '').trim() || 'en';
  return `/${locale}${path}`;
}



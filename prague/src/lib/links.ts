export function resolvePragueHref(opts: { href: string; market: string; locale: string; widget?: string }): string {
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

  // If already market+locale-prefixed, keep it.
  if (/^\/[a-z][a-z0-9-]{0,31}\/[a-z]{2,3}(?:-[a-z0-9]+)*\//i.test(path)) return path;

  const market = String(opts.market || '').trim();
  const locale = String(opts.locale || '').trim();
  if (!market || !locale) return path;
  return `/${market}/${locale}${path}`;
}

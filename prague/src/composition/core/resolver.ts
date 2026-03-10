export type OutputFormat = 'web' | 'email' | 'ad' | 'social';

export type LayoutMap<T> = {
  web: T;
  email?: T;
  ad?: T;
  social?: T;
};

export function resolveLayout<T>(layouts: LayoutMap<T>, format: OutputFormat): T {
  if (format === 'email' && layouts.email) return layouts.email;
  if (format === 'ad' && layouts.ad) return layouts.ad;
  if (format === 'social' && layouts.social) return layouts.social;
  return layouts.web;
}

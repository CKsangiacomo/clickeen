export function resolveBerlinBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.BERLIN_BASE_URL ?? process.env.NEXT_PUBLIC_BERLIN_URL ?? process.env.BERLIN_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return 'http://localhost:3005';
  }

  if (
    typeof process !== 'undefined' &&
    !(
      process.env.CF_PAGES ||
      process.env.CF_PAGES_URL ||
      process.env.CF_PAGES_BRANCH ||
      process.env.CF_PAGES_COMMIT_SHA ||
      process.env.VERCEL ||
      process.env.NETLIFY
    )
  ) {
    return 'http://localhost:3005';
  }

  throw new Error('[Roma] Missing BERLIN_BASE_URL (base URL for Berlin auth service)');
}

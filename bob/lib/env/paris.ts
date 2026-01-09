export function resolveParisBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.PARIS_BASE_URL ??
          process.env.NEXT_PUBLIC_PARIS_URL ??
          process.env.PARIS_URL ??
          undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }

  // Allow local production builds without env wiring (e.g. `next build` for sanity checks).
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
    return 'http://localhost:3001';
  }

  throw new Error('[Bob] Missing PARIS_BASE_URL (base URL for Paris API)');
}

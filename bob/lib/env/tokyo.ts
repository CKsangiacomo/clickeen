export function resolveTokyoBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_TOKYO_URL ?? process.env.TOKYO_URL ?? process.env.TOKYO_BASE_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  // Local dev default.
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return 'http://localhost:4000';
  }

  // Allow local production builds without env wiring (e.g. `next build` for sanity checks).
  // Cloudflare Pages/Vercel/etc must set an explicit Tokyo URL.
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
    return 'http://localhost:4000';
  }

  // Fail-fast in deployed environments: pointing at the wrong Tokyo is catastrophic (wrong widget software plane).
  throw new Error('[Bob] Missing NEXT_PUBLIC_TOKYO_URL (base URL for Tokyo widget assets)');
}

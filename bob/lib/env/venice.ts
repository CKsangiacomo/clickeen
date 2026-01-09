export function resolveVeniceBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_VENICE_URL ?? process.env.VENICE_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  // Local default (Venice is started by scripts/dev-up.sh).
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return 'http://localhost:3003';
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
    return 'http://localhost:3003';
  }

  // Fail-fast in deployed environments: Bob preview-shadow must point to the correct embed origin.
  throw new Error('[Bob] Missing NEXT_PUBLIC_VENICE_URL (base URL for Venice embed runtime)');
}

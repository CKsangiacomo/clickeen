export function resolveTokyoBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_TOKYO_URL ?? process.env.TOKYO_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv;

  // Cloudflare Pages build/runtime (dev). Keep this stable even if env vars aren't wired yet.
  if (
    typeof process !== 'undefined' &&
    (process.env.CF_PAGES ||
      process.env.CF_PAGES_BRANCH ||
      process.env.CF_PAGES_COMMIT_SHA ||
      process.env.CF_PAGES_URL)
  ) {
    return 'https://tokyo.dev.clickeen.com';
  }

  // Local default.
  return 'http://localhost:4000';
}

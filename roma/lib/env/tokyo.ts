const TOKYO_BASE_ENV_KEYS = 'NEXT_PUBLIC_TOKYO_URL/TOKYO_URL/TOKYO_BASE_URL';
const TOKYO_LEGACY_PATH_PREFIXES = new Set([
  '/assets',
  '/dieter',
  '/widgets',
  '/renders',
  '/l10n',
  '/i18n',
  '/fonts',
]);

function normalizeTokyoBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const normalized = trimmed.replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  if (parsed.search || parsed.hash) {
    throw new Error(`[Roma] Invalid ${TOKYO_BASE_ENV_KEYS}: query/hash is not allowed (${trimmed})`);
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/') return parsed.origin;
  if (TOKYO_LEGACY_PATH_PREFIXES.has(normalizedPath)) return parsed.origin;

  throw new Error(`[Roma] Invalid ${TOKYO_BASE_ENV_KEYS}: expected Tokyo origin, got path "${parsed.pathname}"`);
}

export function resolveTokyoBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_TOKYO_URL ?? process.env.TOKYO_URL ?? process.env.TOKYO_BASE_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return normalizeTokyoBaseUrl(fromEnv);

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return 'http://localhost:4000';
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
    return 'http://localhost:4000';
  }

  throw new Error('[Roma] Missing NEXT_PUBLIC_TOKYO_URL (base URL for Tokyo assets)');
}

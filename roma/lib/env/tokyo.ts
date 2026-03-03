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

  const inferFromUrl = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const url = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
      const hostname = new URL(url).hostname.trim().toLowerCase();
      if (!hostname) return null;
      if (hostname === 'clickeen.com' || hostname.endsWith('.clickeen.com')) {
        if (hostname === 'clickeen.com' || hostname === 'app.clickeen.com' || !hostname.includes('.dev.')) {
          return 'https://tokyo.clickeen.com';
        }
        return 'https://tokyo.dev.clickeen.com';
      }
      if (hostname.endsWith('.pages.dev') || hostname.endsWith('.workers.dev')) {
        return 'https://tokyo.dev.clickeen.com';
      }
      return null;
    } catch {
      return null;
    }
  };

  const inferred =
    inferFromUrl(process.env.CF_PAGES_URL) ||
    inferFromUrl(process.env.VERCEL_URL) ||
    inferFromUrl(process.env.NETLIFY_URL) ||
    inferFromUrl(process.env.URL);
  if (inferred) return normalizeTokyoBaseUrl(inferred);

  const isCloudEnv = Boolean(
    typeof process !== 'undefined' &&
      (process.env.CF_PAGES ||
        process.env.CF_PAGES_URL ||
        process.env.CF_PAGES_BRANCH ||
        process.env.CF_PAGES_COMMIT_SHA ||
        process.env.VERCEL ||
        process.env.NETLIFY),
  );
  if (!isCloudEnv) return normalizeTokyoBaseUrl('https://tokyo.dev.clickeen.com');

  throw new Error('[Roma] Missing NEXT_PUBLIC_TOKYO_URL (base URL for Tokyo assets; Roma is cloud-only)');
}

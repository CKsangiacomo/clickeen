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

export function normalizeTokyoBaseUrl(raw: string, envKeys = TOKYO_BASE_ENV_KEYS): string {
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
    throw new Error(`[Roma] Invalid ${envKeys}: query/hash is not allowed (${trimmed})`);
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/') return parsed.origin;
  if (TOKYO_LEGACY_PATH_PREFIXES.has(normalizedPath)) return parsed.origin;

  throw new Error(`[Roma] Invalid ${envKeys}: expected Tokyo origin, got path "${parsed.pathname}"`);
}

export function resolveTokyoBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_TOKYO_URL ?? process.env.TOKYO_URL ?? process.env.TOKYO_BASE_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return normalizeTokyoBaseUrl(fromEnv);
  throw new Error('[Roma] Missing NEXT_PUBLIC_TOKYO_URL (explicit Tokyo base URL required)');
}

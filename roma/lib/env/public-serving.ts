const PUBLIC_SERVING_ENV_KEY = 'NEXT_PUBLIC_CLK_LIVE_URL';

export function normalizePublicServingBaseUrl(raw: string, envKey = PUBLIC_SERVING_ENV_KEY): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`[Roma] Missing ${envKey} (explicit public-serving origin required)`);

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`[Roma] Invalid ${envKey}: expected absolute http(s) origin`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`[Roma] Invalid ${envKey}: expected http(s) origin`);
  }

  if (parsed.search || parsed.hash) {
    throw new Error(`[Roma] Invalid ${envKey}: query/hash is not allowed (${trimmed})`);
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath !== '/') {
    throw new Error(`[Roma] Invalid ${envKey}: expected public-serving origin, got path "${parsed.pathname}"`);
  }

  return parsed.origin;
}

export function resolvePublicServingBaseUrl(): string {
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CLK_LIVE_URL : undefined;
  return normalizePublicServingBaseUrl(String(raw || ''));
}

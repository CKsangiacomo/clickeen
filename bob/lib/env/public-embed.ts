const CLK_LIVE_ENV_KEYS = 'NEXT_PUBLIC_CLK_LIVE_URL/CLK_LIVE_URL';

function normalizePublicEmbedBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  const parsed = new URL(trimmed);
  if (parsed.search || parsed.hash || parsed.pathname.replace(/\/+$/, '') !== '') {
    throw new Error(`[Bob] Invalid ${CLK_LIVE_ENV_KEYS}: expected origin only`);
  }
  return parsed.origin;
}

export function resolvePublicEmbedBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_CLK_LIVE_URL ?? process.env.CLK_LIVE_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  return fromEnv ? normalizePublicEmbedBaseUrl(fromEnv) : 'https://clk.live';
}

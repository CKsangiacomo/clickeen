export function resolveBerlinBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.BERLIN_BASE_URL ?? process.env.NEXT_PUBLIC_BERLIN_URL ?? process.env.BERLIN_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  throw new Error('[Roma] Missing BERLIN_BASE_URL (explicit Berlin base URL required)');
}

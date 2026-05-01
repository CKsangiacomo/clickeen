export function resolveSanfranciscoBaseUrl(): string {
  const raw = typeof process !== 'undefined' ? process.env.SANFRANCISCO_BASE_URL : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  throw new Error(
    '[Roma] Missing SANFRANCISCO_BASE_URL (explicit internal base URL required for Roma -> San Francisco calls)',
  );
}

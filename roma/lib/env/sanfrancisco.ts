export function resolveSanfranciscoBaseUrl(): string {
  const raw = typeof process !== 'undefined' ? process.env.SANFRANCISCO_BASE_URL : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  throw new Error(
    '[Roma] Missing SANFRANCISCO_BASE_URL (explicit internal base URL required for Roma -> San Francisco calls)',
  );
}

export function resolveSanfranciscoInternalToken(): string {
  const token =
    typeof process !== 'undefined' ? (process.env.CK_INTERNAL_SERVICE_JWT ?? '').trim() : '';
  if (token) return token;
  throw new Error(
    '[Roma] Missing CK_INTERNAL_SERVICE_JWT (internal auth token required for Roma -> San Francisco l10n route)',
  );
}

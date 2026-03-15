export function resolveSanfranciscoBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.SANFRANCISCO_BASE_URL ??
        process.env.NEXT_PUBLIC_SANFRANCISCO_URL ??
        process.env.SANFRANCISCO_URL ??
        undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const inferFromUrl = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const url =
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://${trimmed}`;
      const hostname = new URL(url).hostname.trim().toLowerCase();
      if (!hostname) return null;
      if (hostname === 'clickeen.com' || hostname.endsWith('.clickeen.com')) {
        if (
          hostname === 'clickeen.com' ||
          hostname === 'app.clickeen.com' ||
          !hostname.includes('.dev.')
        ) {
          return 'https://sanfrancisco.clickeen.com';
        }
        return 'https://sanfrancisco.dev.clickeen.com';
      }
      if (hostname.endsWith('.pages.dev') || hostname.endsWith('.workers.dev')) {
        return 'https://sanfrancisco.dev.clickeen.com';
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
  if (inferred) return inferred;

  const isCloudEnv = Boolean(
    typeof process !== 'undefined' &&
      (process.env.CF_PAGES ||
        process.env.CF_PAGES_URL ||
        process.env.CF_PAGES_BRANCH ||
        process.env.CF_PAGES_COMMIT_SHA ||
        process.env.VERCEL ||
        process.env.NETLIFY),
  );
  if (!isCloudEnv) return 'http://localhost:3002';

  throw new Error(
    '[Roma] Missing SANFRANCISCO_BASE_URL (base URL for San Francisco service; Roma is cloud-only)',
  );
}

export function resolveSanfranciscoInternalToken(): string {
  const token =
    typeof process !== 'undefined' ? (process.env.PARIS_DEV_JWT ?? '').trim() : '';
  if (token) return token;
  throw new Error(
    '[Roma] Missing PARIS_DEV_JWT (internal auth token required for Roma -> San Francisco l10n route)',
  );
}

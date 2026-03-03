export function resolveParisBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.PARIS_BASE_URL ?? process.env.NEXT_PUBLIC_PARIS_URL ?? process.env.PARIS_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

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
          return 'https://paris.clickeen.com';
        }
        return 'https://paris.dev.clickeen.com';
      }
      if (hostname.endsWith('.pages.dev') || hostname.endsWith('.workers.dev')) {
        return 'https://paris.dev.clickeen.com';
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
  if (!isCloudEnv) return 'https://paris.dev.clickeen.com';

  throw new Error('[Roma] Missing PARIS_BASE_URL (base URL for Paris API; Roma is cloud-only)');
}

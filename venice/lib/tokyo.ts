export function getTokyoBase() {
  const configured = process.env.TOKYO_URL || process.env.TOKYO_BASE_URL || process.env.NEXT_PUBLIC_TOKYO_URL;
  if (configured) return configured.replace(/\/$/, '');

  // Local dev default.
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:4000';
  }

  // Fail-fast in deployed environments: Tokyo base is an infrastructure contract and must be explicit.
  throw new Error('[Venice] Missing TOKYO_URL (base URL for Tokyo widget assets)');
}

type NextRevalidate = { revalidate?: number };

function resolveTokyoCache(pathname: string): { cache: RequestCache; next?: NextRevalidate } {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const isL10n = normalized.startsWith('/l10n/');
  const isL10nIndex = isL10n && normalized.endsWith('/index.json');
  const isL10nOverlay = isL10n && normalized.endsWith('.ops.json');
  const isI18n = normalized.startsWith('/i18n/');
  const isI18nManifest = isI18n && normalized.endsWith('/manifest.json');
  const isWorkspaceAsset = normalized.startsWith('/workspace-assets/');
  const isCuratedAsset = normalized.startsWith('/curated-assets/');
  const isDieter = normalized.startsWith('/dieter/');
  const isWidget = normalized.startsWith('/widgets/');

  if (isL10nOverlay || isWorkspaceAsset || isCuratedAsset) {
    return { cache: 'force-cache', next: { revalidate: 31536000 } };
  }
  if (isI18n && !isI18nManifest) {
    return { cache: 'force-cache', next: { revalidate: 31536000 } };
  }
  if (isL10nIndex || isI18nManifest) {
    return { cache: 'force-cache', next: { revalidate: 300 } };
  }
  if (isDieter || isWidget) {
    return { cache: 'force-cache', next: { revalidate: 300 } };
  }
  return { cache: 'no-store' };
}

export async function tokyoFetch(pathname: string, init: RequestInit = {}) {
  const base = getTokyoBase();
  const url = `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const headers = new Headers(init.headers as HeadersInit);
    if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', crypto.randomUUID());
    const requestInit = {
      ...init,
      headers,
      signal: controller.signal,
    } as RequestInit & { next?: NextRevalidate };
    if (!requestInit.cache) {
      const cachePolicy = resolveTokyoCache(pathname);
      requestInit.cache = cachePolicy.cache;
      if (!requestInit.next && cachePolicy.next) {
        requestInit.next = cachePolicy.next;
      }
    }
    try {
      return await fetch(url, requestInit);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Unsupported cache mode')) {
        const fallbackInit: RequestInit = { ...requestInit, cache: 'no-store' };
        delete (fallbackInit as RequestInit & { next?: NextRevalidate }).next;
        return await fetch(url, fallbackInit);
      }
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

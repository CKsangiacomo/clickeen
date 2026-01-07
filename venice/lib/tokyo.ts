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

export async function tokyoFetch(pathname: string, init: RequestInit = {}) {
  const base = getTokyoBase();
  const url = `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const headers = new Headers(init.headers as HeadersInit);
    if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', crypto.randomUUID());
    return await fetch(url, { ...init, headers, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

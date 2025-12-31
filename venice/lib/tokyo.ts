const DEFAULT_TOKYO_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:4000'
  : 'https://tokyo.clickeen.com';

export function getTokyoBase() {
  const configured = process.env.TOKYO_URL || process.env.TOKYO_BASE_URL || process.env.NEXT_PUBLIC_TOKYO_URL;
  if (!configured) return DEFAULT_TOKYO_BASE;
  return configured.replace(/\/$/, '');
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


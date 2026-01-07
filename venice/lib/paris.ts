export function getParisBase() {
  const configured = process.env.PARIS_URL || process.env.NEXT_PUBLIC_PARIS_URL;
  if (configured) return configured.replace(/\/$/, '');

  // Local dev default.
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }

  // Fail-fast in deployed environments: Paris base is an infrastructure contract and must be explicit.
  throw new Error('[Venice] Missing PARIS_URL (base URL for Paris instance API)');
}

export async function parisFetch(path: string, init: RequestInit = {}) {
  const base = getParisBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const headers = new Headers(init.headers as HeadersInit);
    if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', crypto.randomUUID());
    // Venice is public embed runtime; it must never use dev auth bypasses.
    return await fetch(url, { ...init, headers, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export async function parisJson<T>(path: string, init: RequestInit = {}) {
  const res = await parisFetch(path, init);
  const body = await res.json().catch(() => ({}));
  return { res, body: body as T };
}

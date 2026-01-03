const DEFAULT_PARIS_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001'
  : 'https://c-keen-api.vercel.app';

export function getParisBase() {
  const configured = process.env.PARIS_URL || process.env.NEXT_PUBLIC_PARIS_URL;
  if (!configured) return DEFAULT_PARIS_BASE;
  return configured.replace(/\/$/, '');
}

export async function parisFetch(path: string, init: RequestInit = {}) {
  const base = getParisBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const headers = new Headers(init.headers as HeadersInit);
    if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', crypto.randomUUID());
    const devJwt = process.env.PARIS_DEV_JWT?.trim();
    if (devJwt && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${devJwt}`);
    }
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

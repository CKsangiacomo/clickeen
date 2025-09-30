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
  return fetch(url, init);
}

export async function parisJson<T>(path: string, init: RequestInit = {}) {
  const res = await parisFetch(path, init);
  const body = await res.json().catch(() => ({}));
  return { res, body: body as T };
}

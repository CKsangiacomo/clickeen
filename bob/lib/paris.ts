// Tiny client-side helper to talk to Paris from Bob during dev.
// In production, Bob will call Paris with proper auth; for local spikes,
// we optionally read NEXT_PUBLIC_DEV_JWT to attach Authorization.

export function getParisBase(): string {
  const env = (process.env.NEXT_PUBLIC_PARIS_URL || process.env.PARIS_URL || '').trim();
  const base = env.length > 0 ? env : 'http://localhost:3001';
  return base.replace(/\/$/, '');
}

export function getDevJwt(): string | undefined {
  const jwt = process.env.NEXT_PUBLIC_DEV_JWT as string | undefined;
  return (jwt && jwt.trim().length > 0) ? jwt.trim() : undefined;
}

async function parisFetch(path: string, init: RequestInit = {}, jwt?: string, timeoutMs = 5000) {
  // If path starts with /api, it's a local proxy route - use it as-is
  // Otherwise, prepend Paris base URL for direct server-side calls
  const url = path.startsWith('/api/')
    ? path
    : `${getParisBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers as HeadersInit);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', crypto.randomUUID());
  if (jwt && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${jwt}`);
  const controller = new AbortController();
  const t = setTimeout(() => {
    try { controller.abort(); } catch {}
  }, Math.max(100, timeoutMs));
  const res = await fetch(url, { ...init, headers, cache: 'no-store', signal: controller.signal });
  clearTimeout(t);
  return res;
}

export interface ParisInstance {
  publicId: string;
  status: 'draft' | 'published' | 'inactive';
  widgetType?: string | null;
  templateId?: string | null;
  schemaVersion?: string | null;
  config: Record<string, unknown>;
  branding?: { hide?: boolean; enforced?: boolean };
  updatedAt?: string;
}

export async function parisGetInstance(publicId: string, jwt?: string) {
  // In browser, go through local proxy to avoid CORS and keep JWT server-side
  const path = (typeof window !== 'undefined')
    ? `/api/paris/instance/${encodeURIComponent(publicId)}`
    : `/api/instance/${encodeURIComponent(publicId)}`;
  const res = await parisFetch(path, { method: 'GET' }, jwt);
  let body: any = undefined;
  try { body = await res.json(); } catch { body = undefined; }
  return { res, body: (body as ParisInstance | { error?: string }) } as const;
}

export async function parisUpdateInstance(
  publicId: string,
  payload: { config?: Record<string, unknown>; status?: 'draft' | 'published' | 'inactive'; templateId?: string },
  jwt?: string,
) {
  const path = (typeof window !== 'undefined')
    ? `/api/paris/instance/${encodeURIComponent(publicId)}`
    : `/api/instance/${encodeURIComponent(publicId)}`;
  const res = await parisFetch(path, { method: 'PUT', body: JSON.stringify(payload || {}) }, jwt);
  let body: any = undefined;
  try { body = await res.json(); } catch { body = undefined; }
  return { res, body: (body as ParisInstance | { error?: string }) } as const;
}

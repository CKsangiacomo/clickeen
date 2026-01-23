import type { Env } from './types';
import { requireEnv } from './auth';

export async function supabaseFetch(env: Env, pathnameWithQuery: string, init?: RequestInit) {
  const baseUrl = requireEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const key = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');

  const headers = new Headers(init?.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');

  return fetch(`${baseUrl}${pathnameWithQuery}`, {
    ...init,
    headers,
  });
}

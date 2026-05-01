import type { Env } from './types';

function requireSupabaseEnv(env: Env, key: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = env[key];
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error(`[tokyo] Missing required env var: ${key}`);
  }
  return value.trim();
}

export async function supabaseFetch(env: Env, pathnameWithQuery: string, init?: RequestInit) {
  const baseUrl = requireSupabaseEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const key = requireSupabaseEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const headers = new Headers(init?.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
  return fetch(`${baseUrl}${pathnameWithQuery}`, { ...init, headers });
}

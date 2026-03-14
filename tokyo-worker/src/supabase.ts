import { INTERNAL_SERVICE_HEADER, TOKYO_INTERNAL_SERVICE_PARIS_LOCAL } from './auth';
import type { Env } from './types';

function requireSupabaseEnv(env: Env, key: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = env[key];
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error(`[tokyo] Missing required env var: ${key}`);
  }
  return value.trim();
}

export function resolveL10nHttpBase(env: Env): string | null {
  const raw = typeof env.TOKYO_L10N_HTTP_BASE === 'string' ? env.TOKYO_L10N_HTTP_BASE.trim() : '';
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

const TOKYO_L10N_BRIDGE_HEADER = 'x-tokyo-l10n-bridge';

export function buildL10nBridgeHeaders(env: Env, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set(TOKYO_L10N_BRIDGE_HEADER, '1');
  const token = (env.TOKYO_DEV_JWT || '').trim();
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`);
  }
  if (!headers.has(INTERNAL_SERVICE_HEADER)) {
    headers.set(INTERNAL_SERVICE_HEADER, TOKYO_INTERNAL_SERVICE_PARIS_LOCAL);
  }
  return headers;
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

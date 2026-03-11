import { claimAsString, internalError } from './helpers';
import { type Env } from './types';

function resolveSupabaseAdminConfig(env: Env): { baseUrl: string; serviceRoleKey: string } | null {
  const baseUrl = (typeof env.SUPABASE_URL === 'string' ? env.SUPABASE_URL.trim() : '').replace(/\/+$/, '');
  const serviceRoleKey =
    typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' ? env.SUPABASE_SERVICE_ROLE_KEY.trim() : '';
  if (!baseUrl || !serviceRoleKey) return null;
  return { baseUrl, serviceRoleKey };
}

export async function supabaseAdminFetch(
  env: Env,
  pathnameWithQuery: string,
  init?: RequestInit,
): Promise<Response> {
  const config = resolveSupabaseAdminConfig(env);
  if (!config) {
    throw new Error('berlin.errors.auth.config_missing');
  }

  const headers = new Headers(init?.headers);
  headers.set('apikey', config.serviceRoleKey);
  headers.set('authorization', `Bearer ${config.serviceRoleKey}`);
  headers.set('accept', 'application/json');
  if (!headers.has('content-type') && init?.body) headers.set('content-type', 'application/json');

  return fetch(`${config.baseUrl}${pathnameWithQuery}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

export async function readSupabaseAdminJson<T>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function supabaseAdminErrorResponse(
  reasonKey: string,
  status: number,
  payload: unknown,
): Response {
  const detail =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? claimAsString((payload as Record<string, unknown>).message) ||
        claimAsString((payload as Record<string, unknown>).error_description) ||
        claimAsString((payload as Record<string, unknown>).error)
      : null;
  return internalError(reasonKey, detail || `supabase_status_${status}`);
}

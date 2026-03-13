import { type Env, type SupabaseTokenResponse, type SupabaseUserResponse } from './types';
import { claimAsString } from './helpers';

const SUPABASE_PKCE_CHALLENGE_METHOD = 'S256';

function normalizeProvider(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function resolveSupabaseConfig(env: Env): { baseUrl: string; anonKey: string } | null {
  const baseUrl = (typeof env.SUPABASE_URL === 'string' ? env.SUPABASE_URL.trim() : '').replace(/\/+$/, '');
  const anonKey = typeof env.SUPABASE_ANON_KEY === 'string' ? env.SUPABASE_ANON_KEY.trim() : '';
  if (!baseUrl || !anonKey) return null;
  return { baseUrl, anonKey };
}

export async function requestSupabasePasswordGrant(
  env: Env,
  email: string,
  password: string,
): Promise<{ ok: true; payload: SupabaseTokenResponse } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json().catch(() => null)) as SupabaseTokenResponse | Record<string, unknown> | null;
  if (response.ok && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ok: true, payload: payload as SupabaseTokenResponse };
  }

  const detail = claimAsString((payload as Record<string, unknown> | null)?.error_description) || claimAsString((payload as Record<string, unknown> | null)?.error) || undefined;
  const status = response.status === 400 || response.status === 401 ? 401 : 502;
  const reason = status === 401 ? 'coreui.errors.auth.invalid_credentials' : 'coreui.errors.auth.login_failed';
  return { ok: false, status, reason, detail };
}

export async function requestSupabaseRefreshGrant(
  env: Env,
  refreshToken: string,
): Promise<{ ok: true; payload: SupabaseTokenResponse } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const payload = (await response.json().catch(() => null)) as SupabaseTokenResponse | Record<string, unknown> | null;
  if (response.ok && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ok: true, payload: payload as SupabaseTokenResponse };
  }

  const detail = claimAsString((payload as Record<string, unknown> | null)?.error_description) || claimAsString((payload as Record<string, unknown> | null)?.error) || undefined;
  return {
    ok: false,
    status: response.status === 401 ? 401 : 502,
    reason: 'coreui.errors.auth.required',
    detail,
  };
}

export async function requestSupabasePkceGrant(
  env: Env,
  code: string,
  codeVerifier: string,
): Promise<{ ok: true; payload: SupabaseTokenResponse } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      auth_code: code,
      code_verifier: codeVerifier,
    }),
  });

  const payload = (await response.json().catch(() => null)) as SupabaseTokenResponse | Record<string, unknown> | null;
  if (response.ok && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ok: true, payload: payload as SupabaseTokenResponse };
  }

  const detail = claimAsString((payload as Record<string, unknown> | null)?.error_description) || claimAsString((payload as Record<string, unknown> | null)?.error) || undefined;
  return { ok: false, status: response.status === 401 ? 401 : 502, reason: 'coreui.errors.auth.provider.exchangeFailed', detail };
}

export async function requestSupabaseOAuthUrl(
  env: Env,
  args: {
    provider: string;
    redirectTo: string;
    state: string;
    codeChallenge: string;
    scopes?: string;
    jwt?: string;
    link?: boolean;
  },
): Promise<{ ok: true; url: string } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const provider = normalizeProvider(args.provider);
  if (!provider) return { ok: false, status: 422, reason: 'coreui.errors.auth.provider.invalid' };

  const params = new URLSearchParams();
  params.set('provider', provider);
  params.set('redirect_to', args.redirectTo);
  params.set('state', args.state);
  params.set('code_challenge', args.codeChallenge);
  params.set('code_challenge_method', SUPABASE_PKCE_CHALLENGE_METHOD);
  if (args.scopes) params.set('scopes', args.scopes);

  if (!args.link) {
    const url = `${config.baseUrl}/auth/v1/authorize?${params.toString()}`;
    return { ok: true, url };
  }

  const endpoint = '/auth/v1/user/identities/authorize';
  const headers: Record<string, string> = {
    apikey: config.anonKey,
    authorization: `Bearer ${config.anonKey}`,
    accept: 'application/json',
  };
  if (args.jwt) headers.authorization = `Bearer ${args.jwt}`;
  const response = await fetch(`${config.baseUrl}${endpoint}?${params.toString()}`, {
    method: 'GET',
    headers,
    redirect: 'manual',
    cache: 'no-store',
  });
  const location = claimAsString(response.headers.get('location'));
  if (!response.ok || !location) {
    return {
      ok: false,
      status: response.status || 502,
      reason: 'coreui.errors.auth.provider.linkFailed',
      detail: location || undefined,
    };
  }
  return { ok: true, url: location };
}

export async function requestSupabaseUser(
  env: Env,
  accessToken: string,
): Promise<{ ok: true; user: SupabaseUserResponse } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as SupabaseUserResponse | Record<string, unknown> | null;
  if (response.ok && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ok: true, user: payload as SupabaseUserResponse };
  }
  const detail = claimAsString((payload as Record<string, unknown> | null)?.error_description) || claimAsString((payload as Record<string, unknown> | null)?.error) || undefined;
  return { ok: false, status: response.status || 502, reason: 'coreui.errors.auth.required', detail };
}

export async function requestSupabaseUpdateUserEmail(
  env: Env,
  accessToken: string,
  email: string,
): Promise<{ ok: true; user: SupabaseUserResponse } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ email }),
  });
  const payload = (await response.json().catch(() => null)) as SupabaseUserResponse | Record<string, unknown> | null;
  if (response.ok && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ok: true, user: payload as SupabaseUserResponse };
  }

  const detail =
    claimAsString((payload as Record<string, unknown> | null)?.error_description) ||
    claimAsString((payload as Record<string, unknown> | null)?.msg) ||
    claimAsString((payload as Record<string, unknown> | null)?.error) ||
    undefined;

  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: 401, reason: 'coreui.errors.auth.required', detail };
  }
  if (response.status === 409) {
    return { ok: false, status: 409, reason: 'coreui.errors.user.email.conflict', detail };
  }
  if (response.status === 400 || response.status === 422) {
    return { ok: false, status: 422, reason: 'coreui.errors.user.email.invalid', detail };
  }

  return {
    ok: false,
    status: response.status || 502,
    reason: 'coreui.errors.user.email.changeFailed',
    detail,
  };
}

export async function requestSupabaseUnlinkIdentity(
  env: Env,
  accessToken: string,
  identityId: string,
): Promise<{ ok: true } | { ok: false; status: number; reason: string; detail?: string }> {
  const config = resolveSupabaseConfig(env);
  if (!config) return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing' };

  const response = await fetch(`${config.baseUrl}/auth/v1/user/identities/${encodeURIComponent(identityId)}`, {
    method: 'DELETE',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (response.ok) return { ok: true };
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const detail = claimAsString(payload?.error_description) || claimAsString(payload?.error) || undefined;
  return {
    ok: false,
    status: response.status || 502,
    reason: 'coreui.errors.auth.provider.unlinkFailed',
    detail,
  };
}

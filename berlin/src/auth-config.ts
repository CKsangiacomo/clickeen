import { DEFAULT_AUDIENCE, DEFAULT_ISSUER, type Env, type LoginIntent } from './types';

export function normalizeProvider(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function parseAllowedProviders(env: Env): Set<string> {
  const configured = (typeof env.BERLIN_ALLOWED_PROVIDERS === 'string' ? env.BERLIN_ALLOWED_PROVIDERS.trim() : '') ||
    'google';
  const values = configured
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values);
}

export function normalizeIntent(value: unknown): LoginIntent | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'signin':
      return 'signin';
    case 'signup_prague':
      return 'signup_prague';
    default:
      return null;
  }
}

export function normalizeNextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 2048) return null;
  if (!normalized.startsWith('/')) return null;
  if (normalized.startsWith('//')) return null;
  return normalized;
}

export function resolveIssuer(env: Env): string {
  const configured = typeof env.BERLIN_ISSUER === 'string' ? env.BERLIN_ISSUER.trim() : '';
  return (configured || DEFAULT_ISSUER).replace(/\/+$/, '');
}

export function resolveLoginCallbackUrl(env: Env): string {
  const configured = typeof env.BERLIN_LOGIN_CALLBACK_URL === 'string' ? env.BERLIN_LOGIN_CALLBACK_URL.trim() : '';
  if (configured) {
    try {
      return new URL(configured).toString();
    } catch {
      throw new Error('[berlin] Invalid BERLIN_LOGIN_CALLBACK_URL');
    }
  }
  return `${resolveIssuer(env)}/auth/login/provider/callback`;
}

export function resolveFinishRedirectUrl(env: Env): string | null {
  const configured = typeof env.BERLIN_FINISH_REDIRECT_URL === 'string' ? env.BERLIN_FINISH_REDIRECT_URL.trim() : '';
  if (configured) {
    try {
      return new URL(configured).toString();
    } catch {
      throw new Error('[berlin] Invalid BERLIN_FINISH_REDIRECT_URL');
    }
  }

  const loginCallback = typeof env.BERLIN_LOGIN_CALLBACK_URL === 'string' ? env.BERLIN_LOGIN_CALLBACK_URL.trim() : '';
  if (!loginCallback) return null;
  try {
    const fallback = new URL(loginCallback);
    fallback.pathname = '/api/session/finish';
    fallback.search = '';
    fallback.hash = '';
    return fallback.toString();
  } catch {
    return null;
  }
}

export function resolveLoginErrorRedirectUrl(env: Env, reasonKey: string): string | null {
  const finishUrl = resolveFinishRedirectUrl(env);
  if (!finishUrl) return null;
  try {
    const loginUrl = new URL('/login', finishUrl);
    loginUrl.searchParams.set('error', reasonKey);
    return loginUrl.toString();
  } catch {
    return null;
  }
}

export function resolveAudience(env: Env): string {
  const configured = typeof env.BERLIN_AUDIENCE === 'string' ? env.BERLIN_AUDIENCE.trim() : '';
  return configured || DEFAULT_AUDIENCE;
}

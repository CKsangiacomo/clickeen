import { DEFAULT_AUDIENCE, DEFAULT_ISSUER, type Env, type LoginIntent } from '../types';

const FINISH_REDIRECT_URL_MAX_LENGTH = 2048;

export class BerlinAuthConfigError extends Error {
  readonly reasonKey = 'berlin.errors.auth.config_missing';
  readonly detail: string;

  constructor(detail: string) {
    super('berlin auth config missing');
    this.name = 'BerlinAuthConfigError';
    this.detail = detail;
  }
}

export function normalizeProvider(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function parseAllowedProviders(env: Env): Set<string> {
  const values = (typeof env.BERLIN_ALLOWED_PROVIDERS === 'string' ? env.BERLIN_ALLOWED_PROVIDERS.trim() : '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!values.length) throw new BerlinAuthConfigError('provider_policy_missing');
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

export function normalizeFinishRedirectUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > FINISH_REDIRECT_URL_MAX_LENGTH) return null;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveIssuer(env: Env): string {
  const configured = typeof env.BERLIN_ISSUER === 'string' ? env.BERLIN_ISSUER.trim() : '';
  return (configured || DEFAULT_ISSUER).replace(/\/+$/, '');
}

export function resolveFinishRedirectUrl(env: Env): string | null {
  const configured = typeof env.BERLIN_FINISH_REDIRECT_URL === 'string' ? env.BERLIN_FINISH_REDIRECT_URL.trim() : '';
  if (configured) {
    const normalized = normalizeFinishRedirectUrl(configured);
    if (!normalized) {
      throw new Error('[berlin] Invalid BERLIN_FINISH_REDIRECT_URL');
    }
    return normalized;
  }
  return null;
}

export function parseAllowedFinishRedirectUrls(env: Env): Set<string> {
  const allowed = new Set<string>();
  const defaultFinishUrl = resolveFinishRedirectUrl(env);
  if (defaultFinishUrl) allowed.add(defaultFinishUrl);

  const configured =
    typeof env.BERLIN_ALLOWED_FINISH_REDIRECT_URLS === 'string' ? env.BERLIN_ALLOWED_FINISH_REDIRECT_URLS.trim() : '';
  if (!configured) return allowed;

  for (const item of configured.split(',')) {
    const raw = item.trim();
    if (!raw) continue;
    const normalized = normalizeFinishRedirectUrl(raw);
    if (!normalized) {
      throw new Error('[berlin] Invalid BERLIN_ALLOWED_FINISH_REDIRECT_URLS');
    }
    allowed.add(normalized);
  }
  return allowed;
}

export function resolveRequestedFinishRedirectUrl(
  env: Env,
  value: unknown,
  hasRequestedValue: boolean,
): { ok: true; url: string | null } | { ok: false; detail: string } {
  if (!hasRequestedValue) return { ok: true, url: resolveFinishRedirectUrl(env) };

  const normalized = normalizeFinishRedirectUrl(value);
  if (!normalized) return { ok: false, detail: 'finish_redirect_url_invalid' };

  const allowed = parseAllowedFinishRedirectUrls(env);
  if (!allowed.has(normalized)) return { ok: false, detail: 'finish_redirect_url_not_allowed' };

  return { ok: true, url: normalized };
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

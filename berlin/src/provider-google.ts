import { resolveIssuer } from './auth-config';
import { type ProviderIdentity } from './account-reconcile';
import { claimAsString } from './helpers';
import { type Env } from './types';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_SCOPE = 'openid email profile';

type ProviderFailure = { ok: false; status: number; reason: string; detail?: string };

type GoogleTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  id_token?: unknown;
  scope?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
};

type GoogleUserInfoResponse = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  picture?: unknown;
  locale?: unknown;
  error?: unknown;
  error_description?: unknown;
};

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return false;
}

function normalizeEmail(value: unknown): string | null {
  const email = claimAsString(value);
  return email ? email.toLowerCase() : null;
}

function resolveGoogleCallbackUrl(env: Env): string {
  const configured =
    typeof env.BERLIN_GOOGLE_CALLBACK_URL === 'string' ? env.BERLIN_GOOGLE_CALLBACK_URL.trim() : '';
  if (configured) return new URL(configured).toString();
  return `${resolveIssuer(env)}/auth/login/google/callback`;
}

function resolveGoogleConfig(env: Env): { clientId: string; clientSecret: string; callbackUrl: string } | null {
  const clientId = typeof env.BERLIN_GOOGLE_CLIENT_ID === 'string' ? env.BERLIN_GOOGLE_CLIENT_ID.trim() : '';
  const clientSecret =
    typeof env.BERLIN_GOOGLE_CLIENT_SECRET === 'string' ? env.BERLIN_GOOGLE_CLIENT_SECRET.trim() : '';
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    callbackUrl: resolveGoogleCallbackUrl(env),
  };
}

export function buildGoogleAuthorizeUrl(
  env: Env,
  args: {
    state: string;
    codeChallenge: string;
  },
): { ok: true; url: string } | ProviderFailure {
  const config = resolveGoogleConfig(env);
  if (!config) {
    return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing', detail: 'google_oauth_config_missing' };
  }

  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', args.state);
  url.searchParams.set('code_challenge', args.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return { ok: true, url: url.toString() };
}

export async function exchangeGoogleCallback(
  env: Env,
  args: {
    code: string;
    codeVerifier: string;
  },
): Promise<{ ok: true; identity: ProviderIdentity } | ProviderFailure> {
  const config = resolveGoogleConfig(env);
  if (!config) {
    return { ok: false, status: 503, reason: 'berlin.errors.auth.config_missing', detail: 'google_oauth_config_missing' };
  }

  const body = new URLSearchParams();
  body.set('client_id', config.clientId);
  body.set('client_secret', config.clientSecret);
  body.set('code', args.code);
  body.set('code_verifier', args.codeVerifier);
  body.set('grant_type', 'authorization_code');
  body.set('redirect_uri', config.callbackUrl);

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  const tokenPayload = (await tokenResponse.json().catch(() => null)) as GoogleTokenResponse | null;
  const accessToken = claimAsString(tokenPayload?.access_token);
  if (!tokenResponse.ok || !accessToken) {
    return {
      ok: false,
      status: tokenResponse.status === 400 || tokenResponse.status === 401 ? 401 : 502,
      reason: 'coreui.errors.auth.provider.exchangeFailed',
      detail:
        claimAsString(tokenPayload?.error_description) ||
        claimAsString(tokenPayload?.error) ||
        'google_token_exchange_failed',
    };
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  const userInfo = (await userInfoResponse.json().catch(() => null)) as GoogleUserInfoResponse | null;
  const subject = claimAsString(userInfo?.sub);
  if (!userInfoResponse.ok || !subject) {
    return {
      ok: false,
      status: userInfoResponse.status === 401 ? 401 : 502,
      reason: 'coreui.errors.auth.provider.exchangeFailed',
      detail:
        claimAsString(userInfo?.error_description) ||
        claimAsString(userInfo?.error) ||
        'google_userinfo_failed',
    };
  }

  return {
    ok: true,
    identity: {
      provider: 'google',
      providerSubject: subject,
      email: normalizeEmail(userInfo?.email),
      emailVerified: normalizeBoolean(userInfo?.email_verified),
      displayName: claimAsString(userInfo?.name),
      givenName: claimAsString(userInfo?.given_name),
      familyName: claimAsString(userInfo?.family_name),
      avatarUrl: claimAsString(userInfo?.picture),
      primaryLanguage: claimAsString(userInfo?.locale),
    },
  };
}

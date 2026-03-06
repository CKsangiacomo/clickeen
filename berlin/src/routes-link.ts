import { authError, claimAsString, conflictError, json, validationError } from './helpers';
import { readJsonBody } from './auth-request';
import { normalizeProvider, parseAllowedProviders, resolveIssuer } from './auth-config';
import {
  consumeOauthTransaction,
  createOauthStateId,
  createPkceCodeChallenge,
  createPkceCodeVerifier,
  isValidOauthStateId,
  saveOauthTransaction,
} from './auth-tickets';
import {
  ensureSupabaseAccessToken,
  issueSession,
  resolvePrincipalSession,
  resolveSupabaseAccessExp,
  resolveUserIdFromSupabaseResponse,
  toIdentityRecord,
} from './auth-session';
import { loadSessionState } from './session-kv';
import { requestSupabaseOAuthUrl, requestSupabasePkceGrant, requestSupabaseUnlinkIdentity, requestSupabaseUser } from './supabase-client';
import { OAUTH_STATE_TTL_SECONDS, type Env, type OAuthTransaction } from './types';

export async function handleLinkStart(request: Request, env: Env): Promise<Response> {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return principal.response;

  const body = await readJsonBody(request);
  const provider = normalizeProvider(body?.provider);
  if (!provider) return validationError('coreui.errors.auth.provider.invalid');

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(provider)) {
    return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${provider}`);
  }

  const supabaseAuth = await ensureSupabaseAccessToken(env, principal.session);
  if (!supabaseAuth.ok) return supabaseAuth.response;

  const userLookup = await requestSupabaseUser(env, supabaseAuth.accessToken);
  if (!userLookup.ok) return authError(userLookup.reason, userLookup.status, userLookup.detail);

  const identities = Array.isArray(userLookup.user.identities)
    ? userLookup.user.identities.map(toIdentityRecord).filter((value): value is NonNullable<typeof value> => Boolean(value))
    : [];
  if (identities.some((identity) => identity.provider === provider)) {
    return conflictError('coreui.errors.auth.provider.alreadyLinked', `provider=${provider}`);
  }

  const codeVerifier = createPkceCodeVerifier();
  const codeChallenge = await createPkceCodeChallenge(codeVerifier);
  const nowSec = Math.floor(Date.now() / 1000);
  const stateId = createOauthStateId();
  const transaction: OAuthTransaction = {
    v: 1,
    flow: 'link',
    provider,
    codeVerifier,
    sid: principal.sid,
    userId: principal.userId,
    createdAt: nowSec,
    expiresAt: nowSec + OAUTH_STATE_TTL_SECONDS,
  };
  const stored = await saveOauthTransaction(env, stateId, transaction);
  if (!stored) return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store');

  const callbackUrl = `${resolveIssuer(env)}/auth/link/callback`;
  const oauth = await requestSupabaseOAuthUrl(env, {
    provider,
    redirectTo: callbackUrl,
    state: stateId,
    codeChallenge,
    jwt: supabaseAuth.accessToken,
    link: true,
  });
  if (!oauth.ok) return authError(oauth.reason, oauth.status, oauth.detail);

  return json({
    ok: true,
    provider,
    url: oauth.url,
    expiresAt: new Date(transaction.expiresAt * 1000).toISOString(),
  });
}

export async function handleLinkCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const error = claimAsString(url.searchParams.get('error'));
  const errorDescription = claimAsString(url.searchParams.get('error_description'));
  if (error) {
    return authError('coreui.errors.auth.provider.linkFailed', 401, `${error}${errorDescription ? `: ${errorDescription}` : ''}`);
  }

  const authCode = claimAsString(url.searchParams.get('code'));
  const stateId = claimAsString(url.searchParams.get('state'));
  if (!authCode || !isValidOauthStateId(stateId)) return validationError('coreui.errors.auth.provider.invalidCallback');

  if (!env.BERLIN_AUTH_TICKETS) {
    return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store');
  }
  const consumedState = await consumeOauthTransaction(env, stateId);
  if (consumedState.outcome === 'storeUnavailable') {
    return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store');
  }
  if (consumedState.outcome !== 'ok') {
    return validationError('coreui.errors.auth.provider.invalidCallback');
  }
  const transaction = consumedState.ticket;
  if (transaction.flow !== 'link' || !transaction.sid || !transaction.userId) {
    return validationError('coreui.errors.auth.provider.invalidCallback');
  }

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(transaction.provider)) {
    return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${transaction.provider}`);
  }

  const existing = await loadSessionState(env, transaction.sid);
  if (!existing || existing.revoked) return authError('coreui.errors.auth.required', 401, 'session_revoked');
  if (existing.userId !== transaction.userId) return authError('coreui.errors.auth.required', 401, 'session_subject_mismatch');

  const grant = await requestSupabasePkceGrant(env, authCode, transaction.codeVerifier);
  if (!grant.ok) return authError(grant.reason, grant.status, grant.detail);

  const nowSec = Math.floor(Date.now() / 1000);
  const supabaseAccessToken = claimAsString(grant.payload.access_token);
  const supabaseRefreshToken = claimAsString(grant.payload.refresh_token);
  const userId = resolveUserIdFromSupabaseResponse(grant.payload);
  if (!supabaseAccessToken || !supabaseRefreshToken || !userId) {
    return authError('coreui.errors.auth.provider.linkFailed', 502);
  }

  if (userId !== transaction.userId) {
    return conflictError('coreui.errors.auth.provider.linkConflict', 'provider_identity_owned_by_another_user');
  }

  const session = await issueSession(env, {
    sid: transaction.sid,
    ver: existing.ver,
    userId,
    supabaseRefreshToken,
    supabaseAccessToken,
    supabaseAccessExp: resolveSupabaseAccessExp(nowSec, grant.payload),
  });

  return json({
    ok: true,
    provider: transaction.provider,
    sessionId: session.sid,
    userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
  });
}

export async function handleUnlink(request: Request, env: Env): Promise<Response> {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return principal.response;

  const body = await readJsonBody(request);
  const provider = normalizeProvider(body?.provider);
  const requestedIdentityId = claimAsString(body?.identityId);
  if (!provider && !requestedIdentityId) {
    return validationError('coreui.errors.auth.provider.invalid');
  }

  const supabaseAuth = await ensureSupabaseAccessToken(env, principal.session);
  if (!supabaseAuth.ok) return supabaseAuth.response;

  const userLookup = await requestSupabaseUser(env, supabaseAuth.accessToken);
  if (!userLookup.ok) return authError(userLookup.reason, userLookup.status, userLookup.detail);

  const identities = Array.isArray(userLookup.user.identities)
    ? userLookup.user.identities.map(toIdentityRecord).filter((value): value is NonNullable<typeof value> => Boolean(value))
    : [];

  if (identities.length <= 1) {
    return conflictError('coreui.errors.auth.provider.unlink.lastMethod');
  }

  const candidate = identities.find((identity) => {
    if (requestedIdentityId && identity.identityId === requestedIdentityId) return true;
    if (provider && identity.provider === provider) return true;
    return false;
  });

  if (!candidate) {
    return validationError('coreui.errors.auth.provider.unlink.notFound');
  }

  const unlink = await requestSupabaseUnlinkIdentity(env, supabaseAuth.accessToken, candidate.identityId);
  if (!unlink.ok) return authError(unlink.reason, unlink.status, unlink.detail);

  return json({
    ok: true,
    provider: candidate.provider,
    identityId: candidate.identityId,
  });
}

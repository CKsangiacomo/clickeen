import { authError, claimAsString, conflictError, json, redirect, validationError } from './helpers';
import { readJsonBody } from './auth-request';
import {
  normalizeEmail,
  normalizeHandoffId,
  normalizeIntent,
  normalizeNextPath,
  normalizePassword,
  normalizeProvider,
  parseAllowedProviders,
  resolveFinishRedirectUrl,
  resolveLoginCallbackUrl,
  resolveLoginErrorRedirectUrl,
} from './auth-config';
import {
  consumeOauthFinishTransaction,
  consumeOauthTransaction,
  createFinishId,
  createOauthStateId,
  createPkceCodeChallenge,
  createPkceCodeVerifier,
  isValidFinishId,
  isValidOauthStateId,
  saveOauthFinishTransaction,
  saveOauthTransaction,
} from './auth-tickets';
import { issueSession, resolveSupabaseAccessExp, resolveUserIdFromSupabaseResponse } from './auth-session';
import { requestSupabaseOAuthUrl, requestSupabasePasswordGrant, requestSupabasePkceGrant } from './supabase-client';
import { OAUTH_FINISH_TTL_SECONDS, OAUTH_STATE_TTL_SECONDS, type Env, type OAuthFinishTransaction, type OAuthTransaction } from './types';
import { loadSessionState } from './session-kv';

export async function handlePasswordLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body?.email);
  const password = normalizePassword(body?.password);
  if (!email || !password) {
    return validationError('coreui.errors.auth.invalid_credentials');
  }

  const grant = await requestSupabasePasswordGrant(env, email, password);
  if (!grant.ok) return authError(grant.reason, grant.status, grant.detail);

  const nowSec = Math.floor(Date.now() / 1000);
  const supabaseAccessToken = claimAsString(grant.payload.access_token);
  const supabaseRefreshToken = claimAsString(grant.payload.refresh_token);
  const userId = resolveUserIdFromSupabaseResponse(grant.payload);
  if (!supabaseAccessToken || !supabaseRefreshToken || !userId) {
    return authError('coreui.errors.auth.login_failed', 502);
  }

  const session = await issueSession(env, {
    userId,
    supabaseRefreshToken,
    supabaseAccessToken,
    supabaseAccessExp: resolveSupabaseAccessExp(nowSec, grant.payload),
  });

  return json({
    ok: true,
    sessionId: session.sid,
    userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
  });
}

export async function handleProviderLoginStart(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const provider = normalizeProvider(body?.provider);
  if (!provider) return validationError('coreui.errors.auth.provider.invalid');

  const hasIntent = Boolean(body && Object.prototype.hasOwnProperty.call(body, 'intent'));
  const intent = normalizeIntent(body?.intent);
  if (hasIntent && !intent) return validationError('coreui.errors.auth.intent.invalid');

  const hasNext = Boolean(body && Object.prototype.hasOwnProperty.call(body, 'next'));
  const nextPath = normalizeNextPath(body?.next);
  if (hasNext && !nextPath) return validationError('coreui.errors.auth.next.invalid');

  const hasHandoffId = Boolean(body && Object.prototype.hasOwnProperty.call(body, 'handoffId'));
  const handoffId = normalizeHandoffId(body?.handoffId);
  if (hasHandoffId && !handoffId) return validationError('coreui.errors.minibobHandoff.idInvalid');

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(provider)) {
    return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${provider}`);
  }

  const codeVerifier = createPkceCodeVerifier();
  const codeChallenge = await createPkceCodeChallenge(codeVerifier);
  const nowSec = Math.floor(Date.now() / 1000);
  const stateId = createOauthStateId();
  const transaction: OAuthTransaction = {
    v: 1,
    flow: 'login',
    provider,
    codeVerifier,
    createdAt: nowSec,
    expiresAt: nowSec + OAUTH_STATE_TTL_SECONDS,
    intent: intent || 'signin',
    next: nextPath || '/home',
    ...(handoffId ? { handoffId } : {}),
  };
  const stored = await saveOauthTransaction(env, stateId, transaction);
  if (!stored) return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store');

  const callbackUrl = resolveLoginCallbackUrl(env);
  const oauth = await requestSupabaseOAuthUrl(env, {
    provider,
    redirectTo: callbackUrl,
    state: stateId,
    codeChallenge,
  });
  if (!oauth.ok) return authError(oauth.reason, oauth.status, oauth.detail);

  return json({
    ok: true,
    provider,
    url: oauth.url,
    expiresAt: new Date(transaction.expiresAt * 1000).toISOString(),
    continuation: {
      intent: transaction.intent || 'signin',
      next: transaction.next || '/home',
      ...(transaction.handoffId ? { handoffId: transaction.handoffId } : {}),
    },
  });
}

export async function handleProviderLoginCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const error = claimAsString(url.searchParams.get('error'));
  const errorDescription = claimAsString(url.searchParams.get('error_description'));
  const stateForError = claimAsString(url.searchParams.get('state'));
  if (error) {
    if (isValidOauthStateId(stateForError)) {
      await consumeOauthTransaction(env, stateForError);
      const loginRedirectUrl = resolveLoginErrorRedirectUrl(env, 'coreui.errors.auth.provider.denied');
      if (loginRedirectUrl) return redirect(loginRedirectUrl);
    }
    return authError('coreui.errors.auth.provider.denied', 401, `${error}${errorDescription ? `: ${errorDescription}` : ''}`);
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
  if (consumedState.outcome !== 'ok' || consumedState.ticket.flow !== 'login') {
    return validationError('coreui.errors.auth.provider.invalidCallback');
  }
  const transaction = consumedState.ticket;

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(transaction.provider)) {
    return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${transaction.provider}`);
  }

  const grant = await requestSupabasePkceGrant(env, authCode, transaction.codeVerifier);
  if (!grant.ok) return authError(grant.reason, grant.status, grant.detail);

  const nowSec = Math.floor(Date.now() / 1000);
  const supabaseAccessToken = claimAsString(grant.payload.access_token);
  const supabaseRefreshToken = claimAsString(grant.payload.refresh_token);
  const userId = resolveUserIdFromSupabaseResponse(grant.payload);
  if (!supabaseAccessToken || !supabaseRefreshToken || !userId) {
    return authError('coreui.errors.auth.provider.exchangeFailed', 502);
  }

  const session = await issueSession(env, {
    userId,
    supabaseRefreshToken,
    supabaseAccessToken,
    supabaseAccessExp: resolveSupabaseAccessExp(nowSec, grant.payload),
  });

  const intent = transaction.intent || 'signin';
  const nextPath = transaction.next || '/home';
  const finishRedirectUrl = resolveFinishRedirectUrl(env);
  if (!finishRedirectUrl) return authError('berlin.errors.auth.config_missing', 503, 'missing_finish_redirect_url');

  const finishId = createFinishId();
  const finishTransaction: OAuthFinishTransaction = {
    v: 1,
    provider: transaction.provider,
    sessionId: session.sid,
    userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
    intent,
    next: nextPath,
    ...(transaction.handoffId ? { handoffId: transaction.handoffId } : {}),
    createdAt: nowSec,
    finishExpiresAt: nowSec + OAUTH_FINISH_TTL_SECONDS,
  };
  const stored = await saveOauthFinishTransaction(env, finishId, finishTransaction);
  if (!stored) return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_finish_store');

  const destination = new URL(finishRedirectUrl);
  destination.searchParams.set('finishId', finishId);
  return redirect(destination.toString());
}

export async function handleFinish(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const finishFromBody = claimAsString(body?.finishId);
  const finishFromQuery = claimAsString(new URL(request.url).searchParams.get('finishId'));
  const finishId = finishFromBody || finishFromQuery;
  if (!isValidFinishId(finishId)) return authError('coreui.errors.auth.finish.invalidOrExpired', 401);

  const consumedFinish = await consumeOauthFinishTransaction(env, finishId);
  if (consumedFinish.outcome === 'storeUnavailable') {
    return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_finish_store');
  }
  if (consumedFinish.outcome === 'alreadyConsumed') {
    return conflictError('coreui.errors.auth.finish.alreadyConsumed', 'finish_replayed');
  }
  if (consumedFinish.outcome === 'expired') {
    return authError('coreui.errors.auth.finish.invalidOrExpired', 410, 'finish_expired');
  }
  if (consumedFinish.outcome !== 'ok') {
    return authError('coreui.errors.auth.finish.invalidOrExpired', 401);
  }
  const transaction = consumedFinish.ticket;

  const session = await loadSessionState(env, transaction.sessionId);
  if (!session || session.revoked || session.userId !== transaction.userId) {
    return authError('coreui.errors.auth.finish.invalidOrExpired', 401, 'session_missing_or_revoked');
  }

  return json({
    ok: true,
    provider: transaction.provider,
    sessionId: transaction.sessionId,
    userId: transaction.userId,
    accessToken: transaction.accessToken,
    refreshToken: transaction.refreshToken,
    accessTokenMaxAge: transaction.accessTokenMaxAge,
    refreshTokenMaxAge: transaction.refreshTokenMaxAge,
    expiresAt: transaction.expiresAt,
    continuation: {
      intent: transaction.intent,
      next: transaction.next,
      ...(transaction.handoffId ? { handoffId: transaction.handoffId } : {}),
    },
  });
}

import { authError, claimAsString, conflictError, json, redirect, validationError } from './helpers';
import { readJsonBody } from './auth-request';
import {
  normalizeEmail,
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
import { requestSupabaseOAuthUrl, requestSupabasePasswordGrant, requestSupabasePkceGrant, requestSupabaseUser } from './supabase-client';
import { OAUTH_FINISH_TTL_SECONDS, OAUTH_STATE_TTL_SECONDS, type Env, type OAuthFinishTransaction, type OAuthTransaction, type SupabaseTokenResponse } from './types';
import { loadSessionState } from './session-kv';
import { ensureProductAccountState } from './account-reconcile';

async function issueProductSessionFromGrant(
  env: Env,
  payload: SupabaseTokenResponse,
  failureReasonKey: string,
): Promise<{ ok: true; session: Awaited<ReturnType<typeof issueSession>>; userId: string } | { ok: false; response: Response }> {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const supabaseAccessToken = claimAsString(payload.access_token);
    const supabaseRefreshToken = claimAsString(payload.refresh_token);
    const userId = resolveUserIdFromSupabaseResponse(payload);
    if (!supabaseAccessToken || !supabaseRefreshToken || !userId) {
      return { ok: false, response: authError(failureReasonKey, 502, 'missing_supabase_grant_payload') };
    }

    const userRes = await requestSupabaseUser(env, supabaseAccessToken);
    if (!userRes.ok) {
      return { ok: false, response: authError(failureReasonKey, userRes.status, userRes.detail || 'supabase_user_unavailable') };
    }

    const reconciled = await ensureProductAccountState(env, userRes.user);
    if (!reconciled.ok) {
      return { ok: false, response: reconciled.response };
    }

    const session = await issueSession(env, {
      userId,
      supabaseRefreshToken,
      supabaseAccessToken,
      supabaseAccessExp: resolveSupabaseAccessExp(nowSec, payload),
    });

    return { ok: true, session, userId };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: authError(failureReasonKey, 500, detail || 'account_reconcile_failed') };
  }
}

export async function handlePasswordLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body?.email);
  const password = normalizePassword(body?.password);
  if (!email || !password) {
    return validationError('coreui.errors.auth.invalid_credentials');
  }

  const grant = await requestSupabasePasswordGrant(env, email, password);
  if (!grant.ok) return authError(grant.reason, grant.status, grant.detail);
  const issued = await issueProductSessionFromGrant(env, grant.payload, 'coreui.errors.auth.login_failed');
  if (!issued.ok) return issued.response;
  const { session, userId } = issued;

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
  const issued = await issueProductSessionFromGrant(env, grant.payload, 'coreui.errors.auth.provider.exchangeFailed');
  if (!issued.ok) return issued.response;
  const { session, userId } = issued;
  const nowSec = Math.floor(Date.now() / 1000);

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
  if (!isValidFinishId(finishId)) return validationError('coreui.errors.auth.finish.invalidOrExpired');

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
    return validationError('coreui.errors.auth.finish.invalidOrExpired');
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
    },
  });
}

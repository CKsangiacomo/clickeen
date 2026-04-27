import { authError, claimAsString, conflictError, json, redirect, validationError } from './helpers';
import { readJsonBody } from './auth-request';
import {
  normalizeIntent,
  normalizeNextPath,
  normalizeProvider,
  parseAllowedProviders,
  resolveFinishRedirectUrl,
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
import { issueSession } from './auth-session';
import { OAUTH_FINISH_TTL_SECONDS, OAUTH_STATE_TTL_SECONDS, type Env, type OAuthFinishTransaction, type OAuthTransaction } from './types';
import { loadSessionState } from './session-kv';
import { ensureProductAccountStateForIdentity, type ProviderIdentity } from './account-reconcile';
import { buildGoogleAuthorizeUrl, exchangeGoogleCallback } from './provider-google';

type AuthLogLevel = 'info' | 'warn' | 'error';
const INVITE_NEXT_PATTERN = /^\/accept-invite\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

function safeDetail(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return fallback;
  if (/^[a-z0-9_.:-]{1,96}$/i.test(normalized)) return normalized;
  return fallback;
}

function logAuthFlow(
  request: Request,
  level: AuthLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const url = new URL(request.url);
  const payload = {
    event,
    service: 'berlin',
    component: 'auth',
    method: request.method,
    path: url.pathname.replace(/\/+$/, '') || '/',
    cfRay: String(request.headers.get('cf-ray') || '').trim() || null,
    ...fields,
  };
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
}

async function issueProductSessionFromProviderIdentity(
  env: Env,
  identity: ProviderIdentity,
  failureReasonKey: string,
  options: { invitationId?: string | null } = {},
): Promise<{ ok: true; session: Awaited<ReturnType<typeof issueSession>>; userId: string } | { ok: false; response: Response }> {
  try {
    const reconciled = await ensureProductAccountStateForIdentity(env, identity, options);
    if (!reconciled.ok) {
      return { ok: false, response: reconciled.response };
    }

    const session = await issueSession(env, {
      userId: reconciled.userId,
      authMode: 'direct_provider',
    });

    return { ok: true, session, userId: reconciled.userId };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'auth.session.issue.unexpected',
        service: 'berlin',
        component: 'auth',
        reasonKey: failureReasonKey,
        errorDetail: error instanceof Error ? error.message : String(error),
      }),
    );
    return { ok: false, response: authError(failureReasonKey, 500, 'account_reconcile_failed') };
  }
}

function resolveInvitationIdFromNextPath(nextPath: string | null): string | null {
  const normalized = String(nextPath || '').trim();
  const match = normalized.match(INVITE_NEXT_PATTERN);
  return match?.[1] || null;
}

function buildProviderAuthorizeUrl(
  env: Env,
  args: { provider: string; stateId: string; codeChallenge: string },
): { ok: true; url: string } | { ok: false; status: number; reason: string; detail?: string } {
  if (args.provider === 'google') {
    return buildGoogleAuthorizeUrl(env, {
      state: args.stateId,
      codeChallenge: args.codeChallenge,
    });
  }
  return { ok: false, status: 422, reason: 'coreui.errors.auth.provider.invalid', detail: 'unsupported_provider' };
}

async function exchangeProviderCallback(
  env: Env,
  args: { provider: string; code: string; codeVerifier: string },
): Promise<{ ok: true; identity: ProviderIdentity } | { ok: false; status: number; reason: string; detail?: string }> {
  if (args.provider === 'google') {
    return exchangeGoogleCallback(env, {
      code: args.code,
      codeVerifier: args.codeVerifier,
    });
  }
  return { ok: false, status: 422, reason: 'coreui.errors.auth.provider.invalid', detail: 'unsupported_provider' };
}

async function createProviderLoginStart(args: {
  request: Request;
  env: Env;
  providerRaw: unknown;
  intentRaw: unknown;
  nextRaw: unknown;
  hasIntent: boolean;
  hasNext: boolean;
}): Promise<
  | {
      ok: true;
      provider: string;
      url: string;
      transaction: OAuthTransaction;
    }
  | { ok: false; response: Response }
> {
  const provider = normalizeProvider(args.providerRaw);
  if (!provider) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', { reasonKey: 'coreui.errors.auth.provider.invalid' });
    return { ok: false, response: validationError('coreui.errors.auth.provider.invalid') };
  }

  const intent = normalizeIntent(args.intentRaw);
  if (args.hasIntent && !intent) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', {
      provider,
      reasonKey: 'coreui.errors.auth.intent.invalid',
    });
    return { ok: false, response: validationError('coreui.errors.auth.intent.invalid') };
  }

  const nextPath = normalizeNextPath(args.nextRaw);
  if (args.hasNext && !nextPath) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', {
      provider,
      reasonKey: 'coreui.errors.auth.next.invalid',
    });
    return { ok: false, response: validationError('coreui.errors.auth.next.invalid') };
  }

  const allowed = parseAllowedProviders(args.env);
  if (!allowed.has(provider)) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', {
      provider,
      reasonKey: 'coreui.errors.auth.provider.notEnabled',
    });
    return { ok: false, response: authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${provider}`) };
  }

  logAuthFlow(args.request, 'info', 'auth.provider.start.begin', {
    provider,
    intent: intent || 'signin',
    next: nextPath || '/home',
  });

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
  const invitationId = resolveInvitationIdFromNextPath(transaction.next || null);
  if (invitationId) {
    transaction.invitationId = invitationId;
  }
  const stored = await saveOauthTransaction(args.env, stateId, transaction);
  if (!stored) {
    logAuthFlow(args.request, 'error', 'auth.provider.start.failed', {
      provider,
      reasonKey: 'berlin.errors.auth.config_missing',
      detailCode: 'missing_oauth_state_store',
    });
    return { ok: false, response: authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store') };
  }

  const oauth = buildProviderAuthorizeUrl(args.env, {
    provider,
    stateId,
    codeChallenge,
  });
  if (!oauth.ok) {
    logAuthFlow(args.request, 'error', 'auth.provider.start.failed', {
      provider,
      reasonKey: oauth.reason,
      status: oauth.status,
      detailCode: safeDetail(oauth.detail, 'provider_authorize_url_failed'),
    });
    return {
      ok: false,
      response: authError(oauth.reason, oauth.status, safeDetail(oauth.detail, 'provider_authorize_url_failed')),
    };
  }

  logAuthFlow(args.request, 'info', 'auth.provider.start.ready', {
    provider,
    expiresAt: new Date(transaction.expiresAt * 1000).toISOString(),
  });

  return { ok: true, provider, url: oauth.url, transaction };
}

export async function handleProviderLoginStart(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const started = await createProviderLoginStart({
    request,
    env,
    providerRaw: body?.provider,
    intentRaw: body?.intent,
    nextRaw: body?.next,
    hasIntent: Boolean(body && Object.prototype.hasOwnProperty.call(body, 'intent')),
    hasNext: Boolean(body && Object.prototype.hasOwnProperty.call(body, 'next')),
  });
  if (!started.ok) return started.response;

  return json({
    ok: true,
    provider: started.provider,
    url: started.url,
    expiresAt: new Date(started.transaction.expiresAt * 1000).toISOString(),
    continuation: {
      intent: started.transaction.intent || 'signin',
      next: started.transaction.next || '/home',
    },
  });
}

export async function handleProviderLoginRedirectStart(
  request: Request,
  env: Env,
  providerRaw: string,
): Promise<Response> {
  const url = new URL(request.url);
  const started = await createProviderLoginStart({
    request,
    env,
    providerRaw,
    intentRaw: url.searchParams.get('intent'),
    nextRaw: url.searchParams.get('next'),
    hasIntent: url.searchParams.has('intent'),
    hasNext: url.searchParams.has('next'),
  });
  if (!started.ok) return started.response;
  return redirect(started.url);
}

export async function handleProviderLoginCallback(
  request: Request,
  env: Env,
  providerFromPath?: string,
): Promise<Response> {
  const url = new URL(request.url);
  const error = claimAsString(url.searchParams.get('error'));
  const errorDescription = claimAsString(url.searchParams.get('error_description'));
  const stateForError = claimAsString(url.searchParams.get('state'));
  if (error) {
    logAuthFlow(request, 'warn', 'auth.provider.callback.denied', {
      providerError: safeDetail(error, 'provider_denied'),
      stateValid: isValidOauthStateId(stateForError),
    });
    if (isValidOauthStateId(stateForError)) {
      await consumeOauthTransaction(env, stateForError);
      const loginRedirectUrl = resolveLoginErrorRedirectUrl(env, 'coreui.errors.auth.provider.denied');
      if (loginRedirectUrl) return redirect(loginRedirectUrl);
    }
    return authError('coreui.errors.auth.provider.denied', 401, safeDetail(errorDescription || error, 'provider_denied'));
  }

  const authCode = claimAsString(url.searchParams.get('code'));
  const stateId = claimAsString(url.searchParams.get('state'));
  if (!authCode || !isValidOauthStateId(stateId)) {
    logAuthFlow(request, 'warn', 'auth.provider.callback.rejected', {
      reasonKey: 'coreui.errors.auth.provider.invalidCallback',
      hasCode: Boolean(authCode),
      stateValid: isValidOauthStateId(stateId),
    });
    return validationError('coreui.errors.auth.provider.invalidCallback');
  }

  logAuthFlow(request, 'info', 'auth.provider.callback.begin', {
    hasCode: true,
    stateValid: true,
  });

  if (!env.BERLIN_AUTH_TICKETS) {
    logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
      reasonKey: 'berlin.errors.auth.config_missing',
      detailCode: 'missing_oauth_state_store',
    });
    return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store');
  }
  const consumedState = await consumeOauthTransaction(env, stateId);
  if (consumedState.outcome === 'storeUnavailable') {
    logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
      reasonKey: 'berlin.errors.auth.config_missing',
      detailCode: 'missing_oauth_state_store',
    });
    return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store');
  }
  if (consumedState.outcome !== 'ok' || consumedState.ticket.flow !== 'login') {
    logAuthFlow(request, 'warn', 'auth.provider.callback.rejected', {
      reasonKey: 'coreui.errors.auth.provider.invalidCallback',
      stateOutcome: consumedState.outcome,
      flow: consumedState.outcome === 'ok' ? consumedState.ticket.flow : null,
    });
    return validationError('coreui.errors.auth.provider.invalidCallback');
  }
  const transaction = consumedState.ticket;
  const callbackProvider = normalizeProvider(providerFromPath) || transaction.provider;
  if (callbackProvider !== transaction.provider) {
    logAuthFlow(request, 'warn', 'auth.provider.callback.rejected', {
      provider: callbackProvider,
      transactionProvider: transaction.provider,
      reasonKey: 'coreui.errors.auth.provider.invalidCallback',
    });
    return validationError('coreui.errors.auth.provider.invalidCallback');
  }

  const allowed = parseAllowedProviders(env);
  if (!allowed.has(transaction.provider)) {
    logAuthFlow(request, 'warn', 'auth.provider.callback.rejected', {
      provider: transaction.provider,
      reasonKey: 'coreui.errors.auth.provider.notEnabled',
    });
    return authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${transaction.provider}`);
  }

  const exchanged = await exchangeProviderCallback(env, {
    provider: transaction.provider,
    code: authCode,
    codeVerifier: transaction.codeVerifier,
  });
  if (!exchanged.ok) {
    logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
      provider: transaction.provider,
      reasonKey: exchanged.reason,
      status: exchanged.status,
      detailCode: safeDetail(exchanged.detail, 'provider_token_exchange_failed'),
    });
    return authError(exchanged.reason, exchanged.status, safeDetail(exchanged.detail, 'provider_token_exchange_failed'));
  }
  const issued = await issueProductSessionFromProviderIdentity(env, exchanged.identity, 'coreui.errors.auth.provider.exchangeFailed', {
    invitationId: transaction.invitationId,
  });
  if (!issued.ok) {
    logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
      provider: transaction.provider,
      reasonKey: 'coreui.errors.auth.provider.exchangeFailed',
      detailCode: 'session_or_account_reconcile_failed',
    });
    return issued.response;
  }
  const { session, userId } = issued;
  const nowSec = Math.floor(Date.now() / 1000);

  const intent = transaction.intent || 'signin';
  const nextPath = transaction.next || '/home';
  const finishRedirectUrl = resolveFinishRedirectUrl(env);
  if (!finishRedirectUrl) {
    logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
      provider: transaction.provider,
      reasonKey: 'berlin.errors.auth.config_missing',
      detailCode: 'missing_finish_redirect_url',
    });
    return authError('berlin.errors.auth.config_missing', 503, 'missing_finish_redirect_url');
  }

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
  if (!stored) {
    logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
      provider: transaction.provider,
      reasonKey: 'berlin.errors.auth.config_missing',
      detailCode: 'missing_oauth_finish_store',
    });
    return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_finish_store');
  }

  const destination = new URL(finishRedirectUrl);
  destination.searchParams.set('finishId', finishId);
  logAuthFlow(request, 'info', 'auth.provider.callback.ready', {
    provider: transaction.provider,
    intent,
    next: nextPath,
    userId,
  });
  return redirect(destination.toString());
}

export async function handleFinish(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const finishFromBody = claimAsString(body?.finishId);
  const finishFromQuery = claimAsString(new URL(request.url).searchParams.get('finishId'));
  const finishId = finishFromBody || finishFromQuery;
  if (!isValidFinishId(finishId)) {
    logAuthFlow(request, 'warn', 'auth.finish.rejected', {
      reasonKey: 'coreui.errors.auth.finish.invalidOrExpired',
      source: finishFromBody ? 'body' : finishFromQuery ? 'query' : 'missing',
    });
    return validationError('coreui.errors.auth.finish.invalidOrExpired');
  }

  logAuthFlow(request, 'info', 'auth.finish.begin', {
    source: finishFromBody ? 'body' : 'query',
  });

  const consumedFinish = await consumeOauthFinishTransaction(env, finishId);
  if (consumedFinish.outcome === 'storeUnavailable') {
    logAuthFlow(request, 'error', 'auth.finish.failed', {
      reasonKey: 'berlin.errors.auth.config_missing',
      detailCode: 'missing_oauth_finish_store',
    });
    return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_finish_store');
  }
  if (consumedFinish.outcome === 'alreadyConsumed') {
    logAuthFlow(request, 'warn', 'auth.finish.rejected', {
      reasonKey: 'coreui.errors.auth.finish.alreadyConsumed',
      detailCode: 'finish_replayed',
    });
    return conflictError('coreui.errors.auth.finish.alreadyConsumed', 'finish_replayed');
  }
  if (consumedFinish.outcome === 'expired') {
    logAuthFlow(request, 'warn', 'auth.finish.rejected', {
      reasonKey: 'coreui.errors.auth.finish.invalidOrExpired',
      detailCode: 'finish_expired',
    });
    return authError('coreui.errors.auth.finish.invalidOrExpired', 410, 'finish_expired');
  }
  if (consumedFinish.outcome !== 'ok') {
    logAuthFlow(request, 'warn', 'auth.finish.rejected', {
      reasonKey: 'coreui.errors.auth.finish.invalidOrExpired',
      finishOutcome: consumedFinish.outcome,
    });
    return validationError('coreui.errors.auth.finish.invalidOrExpired');
  }
  const transaction = consumedFinish.ticket;

  const session = await loadSessionState(env, transaction.sessionId);
  if (!session || session.revoked || session.userId !== transaction.userId) {
    logAuthFlow(request, 'warn', 'auth.finish.rejected', {
      provider: transaction.provider,
      reasonKey: 'coreui.errors.auth.finish.invalidOrExpired',
      detailCode: 'session_missing_or_revoked',
    });
    return authError('coreui.errors.auth.finish.invalidOrExpired', 401, 'session_missing_or_revoked');
  }

  logAuthFlow(request, 'info', 'auth.finish.completed', {
    provider: transaction.provider,
    intent: transaction.intent,
    next: transaction.next,
    userId: transaction.userId,
  });

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

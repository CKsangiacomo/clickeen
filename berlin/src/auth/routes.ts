import { claimAsString } from '../utils/claims';
import { authError, conflictError, internalError, json, redirect, validationError } from '../http';
import { loadPrincipalAccountState } from '../bootstrap/state';
import { capture, exact, type BerlinRoute } from '../http/routing';
import { readJsonBody } from '../http/auth-request';
import {
  normalizeIntent,
  normalizeNextPath,
  normalizeProvider,
  parseAllowedProviders,
  resolveFinishRedirectUrl,
  resolveLoginErrorRedirectUrl,
  resolveRequestedFinishRedirectUrl,
} from './config';
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
} from './tickets';
import { issueSession } from '../session/auth-session';
import { OAUTH_FINISH_TTL_SECONDS, OAUTH_STATE_TTL_SECONDS, type Env, type OAuthFinishTransaction, type OAuthTransaction } from '../types';
import { loadSessionState } from '../session/kv';
import { ensureProductAccountStateForIdentity, type ProviderIdentity } from '../identity/resolve-login-account';
import { buildGoogleAuthorizeUrl, exchangeGoogleCallback } from './providers/google';
import { readSupabaseAdminJson, supabaseAdminFetch, supabaseAdminErrorResponse } from '../supabase-admin';

type AuthLogLevel = 'info' | 'warn' | 'error';
const INVITE_NEXT_PATTERN = /^\/accept-invite\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

type DevAdminUserRow = {
  user_id?: unknown;
  primary_email?: unknown;
};

function safeDetail(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return fallback;
  if (/^[a-z0-9_.:-]{1,96}$/i.test(normalized)) return normalized;
  return fallback;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = claimAsString(value)?.toLowerCase();
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function resolveStage(env: Env): string {
  const stage = claimAsString(env.ENV_STAGE)?.toLowerCase();
  if (stage) return stage;
  const issuer = claimAsString(env.BERLIN_ISSUER)?.toLowerCase() || '';
  if (issuer.includes('localhost')) return 'local';
  if (issuer.includes('berlin-dev')) return 'cloud-dev';
  return 'unknown';
}

function resolveDevAdminCredentials(env: Env): { email: string; password: string; accountId: string } | null {
  const email = normalizeEmail(env.BERLIN_DEV_ADMIN_EMAIL) || normalizeEmail(env.CK_ADMIN_EMAIL);
  const password = claimAsString(env.BERLIN_DEV_ADMIN_PASSWORD) || claimAsString(env.CK_ADMIN_PASSWORD);
  const accountId = claimAsString(env.BERLIN_DEV_ADMIN_ACCOUNT_ID) || 'CLICKEEN';
  if (!email || !password || !accountId) return null;
  return { email, password, accountId };
}

function isDevAdminLoginAllowed(env: Env): boolean {
  const stage = resolveStage(env);
  return stage === 'local' || stage === 'cloud-dev';
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function stringsMatch(left: string, right: string): Promise<boolean> {
  return (await sha256(left)) === (await sha256(right));
}

async function resolveDevAdminUserId(
  env: Env,
  email: string,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const params = new URLSearchParams({
    select: 'user_id,primary_email',
    primary_email: `eq.${email}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/users?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<DevAdminUserRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  if (!Array.isArray(payload)) {
    return { ok: false, response: internalError('coreui.errors.db.readFailed', 'dev_admin_user_payload_invalid') };
  }

  const row = payload[0];
  const userId = claimAsString(row?.user_id);
  const rowEmail = normalizeEmail(row?.primary_email);
  if (!userId || rowEmail !== email) {
    return { ok: false, response: authError('coreui.errors.auth.forbidden', 403, 'dev_admin_user_missing') };
  }
  return { ok: true, userId };
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
): Promise<{ ok: true; session: Awaited<ReturnType<typeof issueSession>>; userId: string; createdAccount: boolean } | { ok: false; response: Response }> {
  try {
    const resolved = await ensureProductAccountStateForIdentity(env, identity, options);
    if (!resolved.ok) {
      return { ok: false, response: resolved.response };
    }

    const session = await issueSession(env, {
      userId: resolved.userId,
      authMode: 'direct_provider',
    });

    return { ok: true, session, userId: resolved.userId, createdAccount: resolved.createdAccount };
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
    return { ok: false, response: authError(failureReasonKey, 500, 'account_resolution_failed') };
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
  finishRedirectRaw: unknown;
  hasIntent: boolean;
  hasNext: boolean;
  hasFinishRedirect: boolean;
}): Promise<
  | {
      ok: true;
      provider: string;
      url: string;
      transaction: OAuthTransaction;
    }
  | { ok: false; response: Response; reason: string }
> {
  const provider = normalizeProvider(args.providerRaw);
  if (!provider) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', { reasonKey: 'coreui.errors.auth.provider.invalid' });
    return { ok: false, response: validationError('coreui.errors.auth.provider.invalid'), reason: 'coreui.errors.auth.provider.invalid' };
  }

  const intent = normalizeIntent(args.intentRaw);
  if (args.hasIntent && !intent) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', {
      provider,
      reasonKey: 'coreui.errors.auth.intent.invalid',
    });
    return { ok: false, response: validationError('coreui.errors.auth.intent.invalid'), reason: 'coreui.errors.auth.intent.invalid' };
  }

  const nextPath = normalizeNextPath(args.nextRaw);
  if (args.hasNext && !nextPath) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', {
      provider,
      reasonKey: 'coreui.errors.auth.next.invalid',
    });
    return { ok: false, response: validationError('coreui.errors.auth.next.invalid'), reason: 'coreui.errors.auth.next.invalid' };
  }

  const finishRedirect = resolveRequestedFinishRedirectUrl(args.env, args.finishRedirectRaw, args.hasFinishRedirect);
  if (!finishRedirect.ok) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', {
      provider,
      reasonKey: 'coreui.errors.auth.next.invalid',
      detailCode: finishRedirect.detail,
    });
    return {
      ok: false,
      response: validationError('coreui.errors.auth.next.invalid', finishRedirect.detail),
      reason: 'coreui.errors.auth.next.invalid',
    };
  }

  const allowed = parseAllowedProviders(args.env);
  if (!allowed.has(provider)) {
    logAuthFlow(args.request, 'warn', 'auth.provider.start.rejected', {
      provider,
      reasonKey: 'coreui.errors.auth.provider.notEnabled',
    });
    return {
      ok: false,
      response: authError('coreui.errors.auth.provider.notEnabled', 422, `provider=${provider}`),
      reason: 'coreui.errors.auth.provider.notEnabled',
    };
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
    ...(finishRedirect.url ? { finishRedirectUrl: finishRedirect.url } : {}),
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
    return {
      ok: false,
      response: authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store'),
      reason: 'berlin.errors.auth.config_missing',
    };
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
      reason: oauth.reason,
    };
  }

  logAuthFlow(args.request, 'info', 'auth.provider.start.ready', {
    provider,
    expiresAt: new Date(transaction.expiresAt * 1000).toISOString(),
  });

  return { ok: true, provider, url: oauth.url, transaction };
}

async function handleProviderLoginRedirectStart(
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
    finishRedirectRaw: url.searchParams.get('finishRedirectUrl'),
    hasIntent: url.searchParams.has('intent'),
    hasNext: url.searchParams.has('next'),
    hasFinishRedirect: url.searchParams.has('finishRedirectUrl'),
  });
  if (!started.ok) {
    const loginRedirectUrl = resolveLoginErrorRedirectUrl(env, started.reason);
    if (loginRedirectUrl) return redirect(loginRedirectUrl);
    return started.response;
  }
  return redirect(started.url);
}

async function handleProviderLoginCallback(
  request: Request,
  env: Env,
  providerFromPath?: string,
): Promise<Response> {
  const url = new URL(request.url);
  const allowed = parseAllowedProviders(env);
  const error = claimAsString(url.searchParams.get('error'));
  const errorDescription = claimAsString(url.searchParams.get('error_description'));
  const stateForError = claimAsString(url.searchParams.get('state'));
  if (error) {
    logAuthFlow(request, 'warn', 'auth.provider.callback.denied', {
      providerError: safeDetail(error, 'provider_denied'),
      stateValid: isValidOauthStateId(stateForError),
    });
    if (isValidOauthStateId(stateForError)) {
      const consumed = await consumeOauthTransaction(env, stateForError);
      if (consumed.outcome === 'corrupt') {
        logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
          reasonKey: 'berlin.errors.auth.ticket_store_corrupt',
          detailCode: 'oauth_state_corrupt',
        });
        return internalError('berlin.errors.auth.ticket_store_corrupt', 'oauth_state_corrupt');
      }
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

  const consumedState = await consumeOauthTransaction(env, stateId);
  if (consumedState.outcome === 'storeUnavailable') {
    logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
      reasonKey: 'berlin.errors.auth.config_missing',
      detailCode: 'missing_oauth_state_store',
    });
    return authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_state_store');
  }
  if (consumedState.outcome === 'corrupt') {
    logAuthFlow(request, 'error', 'auth.provider.callback.failed', {
      reasonKey: 'berlin.errors.auth.ticket_store_corrupt',
      detailCode: 'oauth_state_corrupt',
    });
    return internalError('berlin.errors.auth.ticket_store_corrupt', 'oauth_state_corrupt');
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
      detailCode: 'session_or_account_resolution_failed',
    });
    return issued.response;
  }
  const { session, userId, createdAccount } = issued;
  const nowSec = Math.floor(Date.now() / 1000);

  const intent = transaction.intent || 'signin';
  const nextPath = transaction.invitationId ? '/home' : transaction.next || '/home';
  const finishRedirectUrl = transaction.finishRedirectUrl || resolveFinishRedirectUrl(env);
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
    createdAccount,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
    intent,
    next: nextPath,
    createdAt: nowSec,
    finishExpiresAt: nowSec + OAUTH_FINISH_TTL_SECONDS,
    finishRedirectUrl,
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

async function createFinishTransactionForIssuedSession(args: {
  env: Env;
  provider: string;
  userId: string;
  session: Awaited<ReturnType<typeof issueSession>>;
  next: string;
  intent: 'signin' | 'signup_prague';
  finishRedirectUrl: string;
}): Promise<{ ok: true; finishUrl: string } | { ok: false; response: Response }> {
  if (!args.finishRedirectUrl) {
    return {
      ok: false,
      response: authError('berlin.errors.auth.config_missing', 503, 'missing_finish_redirect_url'),
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const finishId = createFinishId();
  const finishTransaction: OAuthFinishTransaction = {
    v: 1,
    provider: args.provider,
    sessionId: args.session.sid,
    userId: args.userId,
    createdAccount: false,
    accessToken: args.session.accessToken,
    refreshToken: args.session.refreshToken,
    accessTokenMaxAge: args.session.accessTokenMaxAge,
    refreshTokenMaxAge: args.session.refreshTokenMaxAge,
    expiresAt: args.session.expiresAt,
    intent: args.intent,
    next: args.next,
    createdAt: nowSec,
    finishExpiresAt: nowSec + OAUTH_FINISH_TTL_SECONDS,
    finishRedirectUrl: args.finishRedirectUrl,
  };
  const stored = await saveOauthFinishTransaction(args.env, finishId, finishTransaction);
  if (!stored) {
    return {
      ok: false,
      response: authError('berlin.errors.auth.config_missing', 503, 'missing_oauth_finish_store'),
    };
  }

  const destination = new URL(args.finishRedirectUrl);
  destination.searchParams.set('finishId', finishId);
  return { ok: true, finishUrl: destination.toString() };
}

async function handleFinish(request: Request, env: Env): Promise<Response> {
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
  if (consumedFinish.outcome === 'corrupt') {
    logAuthFlow(request, 'error', 'auth.finish.failed', {
      reasonKey: 'berlin.errors.auth.ticket_store_corrupt',
      detailCode: 'oauth_finish_corrupt',
    });
    return internalError('berlin.errors.auth.ticket_store_corrupt', 'oauth_finish_corrupt');
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
    createdAccount: transaction.createdAccount,
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

async function handleDevAdminLogin(request: Request, env: Env): Promise<Response> {
  if (!isDevAdminLoginAllowed(env)) {
    return json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const credentials = resolveDevAdminCredentials(env);
  if (!credentials) {
    return authError('berlin.errors.auth.config_missing', 503, 'dev_admin_credentials_missing');
  }

  const body = await readJsonBody(request);
  const email = normalizeEmail(body?.email);
  const password = claimAsString(body?.password);
  const hasNext = Object.prototype.hasOwnProperty.call(body ?? {}, 'next');
  const hasIntent = Object.prototype.hasOwnProperty.call(body ?? {}, 'intent');
  const next = normalizeNextPath(body?.next);
  const intent = normalizeIntent(body?.intent);
  const hasFinishRedirect = Object.prototype.hasOwnProperty.call(body ?? {}, 'finishRedirectUrl');
  const finishRedirect = resolveRequestedFinishRedirectUrl(env, body?.finishRedirectUrl, hasFinishRedirect);
  if (!finishRedirect.ok) {
    return validationError('coreui.errors.auth.next.invalid', finishRedirect.detail);
  }
  if (hasNext && !next) {
    return validationError('coreui.errors.auth.next.invalid');
  }
  if (hasIntent && !intent) {
    return validationError('coreui.errors.auth.intent.invalid');
  }
  const finishRedirectUrl = finishRedirect.url || resolveFinishRedirectUrl(env);
  if (!finishRedirectUrl) {
    return authError('berlin.errors.auth.config_missing', 503, 'missing_finish_redirect_url');
  }

  if (!email || !password) {
    return validationError('coreui.errors.auth.required', 'dev_admin_credentials_required');
  }

  const [emailMatches, passwordMatches] = await Promise.all([
    stringsMatch(email, credentials.email),
    stringsMatch(password, credentials.password),
  ]);
  if (!emailMatches || !passwordMatches) {
    logAuthFlow(request, 'warn', 'auth.dev_admin.rejected', {
      reasonKey: 'coreui.errors.auth.required',
    });
    return authError('coreui.errors.auth.required', 401, 'dev_admin_credentials_invalid');
  }

  const user = await resolveDevAdminUserId(env, credentials.email);
  if (!user.ok) return user.response;

  const accountState = await loadPrincipalAccountState({
    env,
    userId: user.userId,
    sessionRole: 'authenticated',
  });
  if (!accountState.ok) return accountState.response;
  if (accountState.value.defaultAccount?.accountId !== credentials.accountId) {
    return authError('coreui.errors.auth.forbidden', 403, 'dev_admin_account_mismatch');
  }

  const session = await issueSession(env, {
    userId: user.userId,
    authMode: 'direct_provider',
  });
  const finish = await createFinishTransactionForIssuedSession({
    env,
    provider: 'dev-admin',
    userId: user.userId,
    session,
    next: next || '/home',
    intent: intent || 'signin',
    finishRedirectUrl,
  });
  if (!finish.ok) return finish.response;

  logAuthFlow(request, 'info', 'auth.dev_admin.ready', {
    next: next || '/home',
    userId: user.userId,
  });
  return json({
    ok: true,
    provider: 'dev-admin',
    finishUrl: finish.finishUrl,
  });
}

export const AUTH_ROUTES: BerlinRoute[] = [
  exact('/auth/login/dev-admin', {
    POST: ({ request, env }) => handleDevAdminLogin(request, env),
  }),
  {
    pattern: /^\/auth\/login\/([^/]+)\/start$/,
    methods: {
      GET: ({ request, env, match }) => handleProviderLoginRedirectStart(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/auth\/login\/([^/]+)\/callback$/,
    methods: {
      GET: ({ request, env, match }) => handleProviderLoginCallback(request, env, capture(match, 1)),
    },
  },
  exact('/auth/finish', {
    POST: ({ request, env }) => handleFinish(request, env),
  }),
];

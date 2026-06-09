import { ensureProductAccountStateForIdentity, type ProviderIdentity } from '../identity/resolve-login-account';
import { authError, json, validationError } from '../http';
import { readJsonBody } from '../http/auth-request';
import { exact, type BerlinRoute } from '../http/routing';
import { issueSession } from '../session/auth-session';
import { type Env } from '../types';
import { claimAsString } from '../utils/claims';

const E2E_AUTH_HEADER = 'x-ck-e2e-auth';

function isEnabled(env: Env): boolean {
  return env.E2E_AUTH_ENABLED === 'true' && Boolean(env.E2E_AUTH_SECRET?.trim()) && Boolean(env.E2E_ALLOWED_EMAILS?.trim());
}

function isProductionStage(env: Env): boolean {
  const stage = String(env.ENV_STAGE || '').trim().toLowerCase();
  return stage === 'prod' || stage === 'production';
}

function normalizeEmail(value: unknown): string | null {
  const email = claimAsString(value)?.toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function allowedEmails(env: Env): Set<string> {
  return new Set(
    String(env.E2E_ALLOWED_EMAILS || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function requestSecret(request: Request, body: Record<string, unknown> | null): string | null {
  const headerSecret = request.headers.get(E2E_AUTH_HEADER)?.trim();
  if (headerSecret) return headerSecret;
  return claimAsString(body?.secret);
}

async function handleIssueE2ESession(request: Request, env: Env): Promise<Response> {
  if (!isEnabled(env) || isProductionStage(env)) {
    return json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const body = await readJsonBody(request);
  const secret = requestSecret(request, body);
  if (!secret || secret !== env.E2E_AUTH_SECRET) {
    return authError('coreui.errors.auth.required', 401, 'e2e_secret_invalid');
  }

  const email = normalizeEmail(body?.email);
  if (!email) return validationError('coreui.errors.auth.login_failed', 'e2e_email_invalid');
  if (!allowedEmails(env).has(email)) {
    return authError('coreui.errors.auth.forbidden', 403, 'e2e_email_not_allowed');
  }

  const identity: ProviderIdentity = {
    provider: 'email',
    providerSubject: email,
    email,
    emailVerified: true,
    displayName: 'Playwright E2E',
    givenName: 'Playwright',
    familyName: 'E2E',
    avatarUrl: null,
    primaryLanguage: 'en',
    country: null,
    timezone: null,
  };

  const resolved = await ensureProductAccountStateForIdentity(env, identity);
  if (!resolved.ok) return resolved.response;

  const session = await issueSession(env, {
    userId: resolved.userId,
    authMode: 'direct_provider',
  });

  return json({
    ok: true,
    userId: resolved.userId,
    accountId: resolved.primaryAccountId,
    createdAccount: resolved.createdAccount,
    sessionId: session.sid,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenMaxAge: session.accessTokenMaxAge,
    refreshTokenMaxAge: session.refreshTokenMaxAge,
    expiresAt: session.expiresAt,
  });
}

export const E2E_ROUTES: BerlinRoute[] = [
  exact('/internal/e2e/session', {
    POST: ({ request, env }) => handleIssueE2ESession(request, env),
  }),
];

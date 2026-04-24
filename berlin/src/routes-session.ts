import { asBearerToken, authError, claimAsNumber, claimAsString, json } from './helpers';
import { readJsonBody, resolveRefreshTokenFromRequest } from './auth-request';
import { ensureSupabaseAccessToken, rotateRefreshRti, resolvePrincipalSession } from './auth-session';
import { addUserSessionId, loadSessionState, revokeSessionBySid, revokeSessionsByUserId, saveSessionState } from './session-kv';
import { resolveSigningContext, signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt-crypto';
import { resolveAudience, resolveIssuer } from './auth-config';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS, type AccessClaims, type Env, type RefreshPayloadV2, type SessionState } from './types';

export async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const refreshToken = resolveRefreshTokenFromRequest(request, body);
  if (!refreshToken) return authError('coreui.errors.auth.required', 401);

  const verified = await verifyRefreshToken(refreshToken, env);
  if (!verified.ok) return authError('coreui.errors.auth.required', 401, verified.reason);

  const payload = verified.payload;
  let state = await loadSessionState(env, payload.sid);

  if (!state && payload.v === 1) {
    const nowMs = Date.now();
    state = {
      sid: payload.sid,
      currentRti: payload.rti,
      rtiRotatedAt: nowMs,
      userId: payload.userId,
      ver: payload.ver,
      revoked: false,
      supabaseRefreshToken: payload.supabaseRefreshToken,
      createdAt: nowMs,
      updatedAt: nowMs,
    };
    await saveSessionState(env, state);
    await addUserSessionId(env, state.userId, state.sid);
  }

  if (!state) return authError('coreui.errors.auth.required', 401, 'session_not_found');
  if (state.revoked) return authError('coreui.errors.auth.required', 401, 'session_revoked');

  if (state.userId !== payload.userId) {
    await saveSessionState(env, { ...state, revoked: true });
    return authError('coreui.errors.auth.required', 401, 'refresh_subject_mismatch');
  }

  if (state.ver !== payload.ver) {
    await saveSessionState(env, { ...state, revoked: true });
    return authError('coreui.errors.auth.required', 401, 'refresh_version_mismatch');
  }

  const rotated = await rotateRefreshRti(env, state, {
    sid: payload.sid,
    rti: payload.rti,
    ver: payload.ver,
    userId: payload.userId,
  });
  if (!rotated.ok) return rotated.response;

  const nowSec = Math.floor(Date.now() / 1000);
  const claims: AccessClaims = {
    sub: state.userId,
    sid: state.sid,
    ver: state.ver,
    role: 'authenticated',
    iat: nowSec,
    exp: nowSec + ACCESS_TOKEN_TTL_SECONDS,
    iss: resolveIssuer(env),
    aud: resolveAudience(env),
  };

  const refreshPayload: RefreshPayloadV2 = {
    v: 2,
    sid: state.sid,
    rti: rotated.nextRti,
    ver: state.ver,
    userId: state.userId,
    exp: nowSec + REFRESH_TOKEN_TTL_SECONDS,
  };

  const [accessToken, nextRefreshToken] = await Promise.all([
    signAccessToken(claims, env),
    signRefreshToken(refreshPayload, env),
  ]);

  return json({
    ok: true,
    sessionId: state.sid,
    userId: state.userId,
    accessToken,
    refreshToken: nextRefreshToken,
    accessTokenMaxAge: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenMaxAge: REFRESH_TOKEN_TTL_SECONDS,
    expiresAt: new Date((nowSec + ACCESS_TOKEN_TTL_SECONDS) * 1000).toISOString(),
  });
}

export async function handleSession(request: Request, env: Env): Promise<Response> {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return principal.response;

  const expiresAt = claimAsNumber(principal.claims.exp);
  return json({
    ok: true,
    userId: principal.userId,
    sid: principal.sid,
    expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
  });
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  const all = body?.all === true || claimAsString(body?.scope) === 'user';

  if (all) {
    const principal = await resolvePrincipalSession(request, env);
    if (!principal.ok) return principal.response;
    const revokedCount = await revokeSessionsByUserId(env, principal.userId);
    return json({ ok: true, revokedScope: 'user', revokedCount });
  }

  const refreshToken = resolveRefreshTokenFromRequest(request, body);
  if (!refreshToken) return json({ ok: true });

  const verified = await verifyRefreshToken(refreshToken, env, { allowExpired: true });
  if (!verified.ok) return json({ ok: true });

  await revokeSessionBySid(env, verified.payload.sid);
  return json({ ok: true, revokedScope: 'sid', sid: verified.payload.sid });
}

function isTrustedInternalControlRequest(request: Request, env: Env): boolean {
  const expected =
    typeof env.CK_INTERNAL_SERVICE_JWT === 'string' ? env.CK_INTERNAL_SERVICE_JWT.trim() : '';
  if (!expected) return false;
  const marker = String(request.headers.get('x-ck-internal-service') || '')
    .trim()
    .toLowerCase();
  if (marker !== 'devstudio.local') return false;
  const token = asBearerToken(request.headers.get('authorization'));
  return token === expected;
}

function resolveInternalServiceHeaderToken(request: Request): string | null {
  const raw = claimAsString(request.headers.get('x-ck-internal-token'));
  if (!raw) return null;
  return asBearerToken(raw) || raw;
}

function isTrustedRomaMichaelTokenRequest(request: Request, env: Env): boolean {
  const expected =
    typeof env.CK_INTERNAL_SERVICE_JWT === 'string' ? env.CK_INTERNAL_SERVICE_JWT.trim() : '';
  const marker = String(request.headers.get('x-ck-internal-service') || '')
    .trim()
    .toLowerCase();
  if (marker !== 'roma.edge') return false;

  if (expected) {
    return resolveInternalServiceHeaderToken(request) === expected;
  }

  // Cloud-dev Roma does not currently carry CK_INTERNAL_SERVICE_JWT. Until that env
  // is normalized, only accept the server-to-server shape and reject browser fetches.
  if (request.headers.has('origin')) return false;
  if (request.headers.has('sec-fetch-site')) return false;
  if (request.headers.has('sec-fetch-mode')) return false;
  if (request.headers.has('sec-fetch-dest')) return false;
  return true;
}

function resolveSupabaseServiceRoleKey(env: Env): string | null {
  const key =
    typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' ? env.SUPABASE_SERVICE_ROLE_KEY.trim() : '';
  return key || null;
}

export async function handleInternalRevokeUserSessions(request: Request, env: Env, userId: string): Promise<Response> {
  if (!isTrustedInternalControlRequest(request, env)) {
    return authError('coreui.errors.auth.forbidden', 403, 'internal_control_auth_required');
  }

  const revokedCount = await revokeSessionsByUserId(env, userId);
  return json({
    ok: true,
    userId,
    revokedCount,
  });
}

export async function handleMichaelToken(request: Request, env: Env): Promise<Response> {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return principal.response;

  const hasSupabaseSessionBridge = Boolean(claimAsString(principal.session.supabaseRefreshToken));
  if (hasSupabaseSessionBridge) {
    const ensured = await ensureSupabaseAccessToken(env, principal.session);
    if (!ensured.ok) return ensured.response;

    return json({
      ok: true,
      userId: principal.userId,
      accessToken: ensured.accessToken,
      expiresAt:
        Number.isFinite(ensured.session.supabaseAccessExp) && (ensured.session.supabaseAccessExp as number) > 0
          ? new Date((ensured.session.supabaseAccessExp as number) * 1000).toISOString()
          : null,
      tokenKind: 'supabase_user',
    });
  }

  if (!isTrustedRomaMichaelTokenRequest(request, env)) {
    return authError('coreui.errors.auth.contextUnavailable', 503, 'supabase_session_unavailable');
  }

  const serviceRoleKey = resolveSupabaseServiceRoleKey(env);
  if (!serviceRoleKey) {
    return authError('berlin.errors.auth.config_missing', 503, 'supabase_service_role_missing');
  }

  return json({
    ok: true,
    userId: principal.userId,
    accessToken: serviceRoleKey,
    expiresAt: null,
    tokenKind: 'internal_service_role',
  });
}

export async function handleJwks(env: Env): Promise<Response> {
  const signing = await resolveSigningContext(env);
  const keys = [signing.current.publicJwk];
  if (signing.previous) keys.push(signing.previous.publicJwk);
  return json({ keys });
}

export function handleHealthz(): Response {
  return json({ ok: true, service: 'berlin' });
}

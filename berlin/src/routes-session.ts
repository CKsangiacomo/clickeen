import { authError, claimAsNumber, claimAsString, json } from './helpers';
import { readJsonBody, resolveAccessTokenFromRequest, resolveRefreshTokenFromRequest } from './auth-request';
import { rotateRefreshRti, resolvePrincipalSession } from './auth-session';
import { addUserSessionId, loadSessionState, revokeSessionBySid, revokeSessionsByUserId, saveSessionState } from './session-kv';
import { resolveSigningContext, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt-crypto';
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

export async function handleSession(request: Request, env: Env): Promise<Response> {
  const bearer = resolveAccessTokenFromRequest(request);
  if (!bearer) return authError('coreui.errors.auth.required', 401);

  const verified = await verifyAccessToken(bearer, env);
  if (!verified.ok) return authError('coreui.errors.auth.required', 401, verified.reason);

  return json({
    ok: true,
    valid: true,
    userId: claimAsString(verified.claims.sub),
    sid: claimAsString(verified.claims.sid),
    exp: claimAsNumber(verified.claims.exp),
    iss: claimAsString(verified.claims.iss),
    aud: verified.claims.aud,
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

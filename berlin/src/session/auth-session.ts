import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_RTI_GRACE_MS,
  REFRESH_TOKEN_TTL_SECONDS,
  type AccessClaims,
  type Env,
  type SessionIssueArgs,
  type SessionIssueResult,
  type SessionState,
} from '../types';
import { claimAsString } from '../utils/claims';
import { authError } from '../http';
import { addUserSessionId, loadSessionState, saveSessionState } from './kv';
import { deriveNextRti, signAccessToken, signRefreshToken, verifyAccessToken } from '../crypto/jwt';
import { resolveAccessTokenFromRequest } from '../http/auth-request';
import { resolveAudience, resolveIssuer } from '../auth/config';

export async function issueSession(env: Env, args: SessionIssueArgs): Promise<SessionIssueResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  const sid = args.sid || crypto.randomUUID();
  const existing = args.sid ? await loadSessionState(env, sid) : null;
  const sessionRevision = Number.isFinite(args.sessionRevision) && (args.sessionRevision as number) > 0 ? (args.sessionRevision as number) : existing?.sessionRevision || 1;
  const rti = crypto.randomUUID();

  const claims: AccessClaims = {
    sub: args.userId,
    sid,
    sessionRevision,
    role: 'authenticated',
    iat: nowSec,
    exp: nowSec + ACCESS_TOKEN_TTL_SECONDS,
    iss: resolveIssuer(env),
    aud: resolveAudience(env),
  };

  const refreshPayload = {
    sid,
    rti,
    sessionRevision,
    userId: args.userId,
    exp: nowSec + REFRESH_TOKEN_TTL_SECONDS,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(claims, env),
    signRefreshToken(refreshPayload, env),
  ]);

  const baseState = {
    sid,
    currentRti: rti,
    rtiRotatedAt: nowMs,
    userId: args.userId,
    sessionRevision,
    revoked: false,
    authMode: args.authMode,
    createdAt: existing?.createdAt || nowMs,
    updatedAt: nowMs,
  };
  const nextState: SessionState = {
    ...baseState,
    authMode: 'direct_provider',
  };

  await saveSessionState(env, nextState);
  await addUserSessionId(env, args.userId, sid);

  return {
    sid,
    sessionRevision,
    accessToken,
    refreshToken,
    accessTokenMaxAge: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenMaxAge: REFRESH_TOKEN_TTL_SECONDS,
    expiresAt: new Date((nowSec + ACCESS_TOKEN_TTL_SECONDS) * 1000).toISOString(),
  };
}

export async function resolvePrincipalSession(
  request: Request,
  env: Env,
): Promise<
  | { ok: true; userId: string; sid: string; session: SessionState; claims: AccessClaims }
  | { ok: false; response: Response }
> {
  const token = resolveAccessTokenFromRequest(request);
  if (!token) return { ok: false, response: authError('coreui.errors.auth.required', 401) };

  const verified = await verifyAccessToken(token, env);
  if (!verified.ok) return { ok: false, response: authError('coreui.errors.auth.required', 401, verified.reason) };

  const userId = claimAsString(verified.claims.sub);
  const sid = claimAsString(verified.claims.sid);
  if (!userId || !sid) return { ok: false, response: authError('coreui.errors.auth.required', 401, 'missing_subject') };

  const session = await loadSessionState(env, sid);
  if (!session || session.revoked) return { ok: false, response: authError('coreui.errors.auth.required', 401, 'session_revoked') };
  if (session.userId !== userId) return { ok: false, response: authError('coreui.errors.auth.required', 401, 'session_subject_mismatch') };

  return { ok: true, userId, sid, session, claims: verified.claims };
}

export async function rotateRefreshRti(
  env: Env,
  state: SessionState,
  payload: { sid: string; rti: string; sessionRevision: number; userId: string },
): Promise<
  | { ok: true; nextRti: string; shouldPersist: boolean }
  | { ok: false; response: Response }
> {
  const nowMs = Date.now();
  let nextRti = '';
  let shouldPersist = false;

  if (state.currentRti === payload.rti) {
    shouldPersist = true;
    nextRti = await deriveNextRti(env, { sid: state.sid, sessionRevision: state.sessionRevision, rti: payload.rti });
  } else {
    const rotatedAt = Number.isFinite(state.rtiRotatedAt) ? state.rtiRotatedAt : state.updatedAt;
    const withinGrace = nowMs >= rotatedAt && nowMs - rotatedAt < REFRESH_RTI_GRACE_MS;
    if (withinGrace) {
      const expectedCurrent = await deriveNextRti(env, { sid: state.sid, sessionRevision: state.sessionRevision, rti: payload.rti });
      if (expectedCurrent === state.currentRti) {
        nextRti = state.currentRti;
      }
    }
    if (!nextRti) {
      await saveSessionState(env, { ...state, revoked: true });
      return { ok: false, response: authError('coreui.errors.auth.required', 401, 'refresh_reuse_detected') };
    }
  }

  if (shouldPersist) {
    await saveSessionState(env, { ...state, currentRti: nextRti, rtiRotatedAt: nowMs });
  }

  return { ok: true, nextRti, shouldPersist };
}

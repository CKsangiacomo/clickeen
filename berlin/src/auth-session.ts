import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_RTI_GRACE_MS,
  REFRESH_TOKEN_TTL_SECONDS,
  type AccessClaims,
  type Env,
  type SessionIssueArgs,
  type SessionIssueResult,
  type SessionState,
  type SupabaseIdentity,
  type SupabaseTokenResponse,
} from './types';
import {
  authError,
  claimAsNumber,
  claimAsString,
  decodeJsonBase64Url,
} from './helpers';
import { addUserSessionId, loadSessionState, saveSessionState } from './session-kv';
import { deriveNextRti, signAccessToken, signRefreshToken, verifyAccessToken } from './jwt-crypto';
import { requestSupabaseRefreshGrant } from './supabase-client';
import { resolveAccessTokenFromRequest } from './auth-request';
import { resolveAudience, resolveIssuer } from './auth-config';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  return decodeJsonBase64Url<Record<string, unknown>>(parts[1] || '');
}

export function resolveUserIdFromSupabaseResponse(payload: SupabaseTokenResponse): string | null {
  const fromUser = claimAsString(payload.user?.id);
  if (fromUser) return fromUser;
  const accessToken = claimAsString(payload.access_token);
  if (!accessToken) return null;
  const decoded = decodeJwtPayload(accessToken);
  if (!decoded) return null;
  return claimAsString(decoded.sub);
}

export function resolveSupabaseAccessExp(nowSec: number, payload: SupabaseTokenResponse): number | null {
  const expiresIn = claimAsNumber(payload.expires_in);
  if (!expiresIn || expiresIn <= 0) return null;
  return nowSec + expiresIn;
}

export async function issueSession(env: Env, args: SessionIssueArgs): Promise<SessionIssueResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  const sid = args.sid || crypto.randomUUID();
  const existing = args.sid ? await loadSessionState(env, sid) : null;
  const ver = Number.isFinite(args.ver) && (args.ver as number) > 0 ? (args.ver as number) : existing?.ver || 1;
  const rti = crypto.randomUUID();

  const claims: AccessClaims = {
    sub: args.userId,
    sid,
    ver,
    role: 'authenticated',
    iat: nowSec,
    exp: nowSec + ACCESS_TOKEN_TTL_SECONDS,
    iss: resolveIssuer(env),
    aud: resolveAudience(env),
  };

  const refreshPayload = {
    v: 2 as const,
    sid,
    rti,
    ver,
    userId: args.userId,
    exp: nowSec + REFRESH_TOKEN_TTL_SECONDS,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(claims, env),
    signRefreshToken(refreshPayload, env),
  ]);

  const nextState: SessionState = {
    sid,
    currentRti: rti,
    rtiRotatedAt: nowMs,
    userId: args.userId,
    ver,
    revoked: false,
    supabaseRefreshToken: args.supabaseRefreshToken,
    supabaseAccessToken: claimAsString(args.supabaseAccessToken) || undefined,
    supabaseAccessExp: args.supabaseAccessExp && args.supabaseAccessExp > nowSec ? args.supabaseAccessExp : undefined,
    createdAt: existing?.createdAt || nowMs,
    updatedAt: nowMs,
  };

  await saveSessionState(env, nextState);
  await addUserSessionId(env, args.userId, sid);

  return {
    sid,
    ver,
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
  | { ok: true; userId: string; sid: string; session: SessionState }
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

  return { ok: true, userId, sid, session };
}

export async function ensureSupabaseAccessToken(
  env: Env,
  session: SessionState,
): Promise<
  | { ok: true; session: SessionState; accessToken: string }
  | { ok: false; response: Response }
> {
  const nowSec = Math.floor(Date.now() / 1000);
  const currentAccess = claimAsString(session.supabaseAccessToken);
  const currentExp = claimAsNumber(session.supabaseAccessExp);

  if (currentAccess && currentExp && currentExp > nowSec + 60) {
    return { ok: true, session, accessToken: currentAccess };
  }

  const grant = await requestSupabaseRefreshGrant(env, session.supabaseRefreshToken);
  if (!grant.ok) {
    await saveSessionState(env, { ...session, revoked: true });
    return { ok: false, response: authError('coreui.errors.auth.required', grant.status, grant.reason) };
  }

  const refreshedUserId = resolveUserIdFromSupabaseResponse(grant.payload);
  const refreshedAccess = claimAsString(grant.payload.access_token);
  const refreshedRefresh = claimAsString(grant.payload.refresh_token);
  if (!refreshedUserId || !refreshedAccess || !refreshedRefresh || refreshedUserId !== session.userId) {
    await saveSessionState(env, { ...session, revoked: true });
    return { ok: false, response: authError('coreui.errors.auth.required', 401, 'refresh_subject_mismatch') };
  }

  const refreshedExp = resolveSupabaseAccessExp(nowSec, grant.payload);
  const nextSession: SessionState = {
    ...session,
    supabaseRefreshToken: refreshedRefresh,
    supabaseAccessToken: refreshedAccess,
    supabaseAccessExp: refreshedExp || undefined,
    updatedAt: Date.now(),
  };
  await saveSessionState(env, nextSession);

  return { ok: true, session: nextSession, accessToken: refreshedAccess };
}

export function toIdentityRecord(identity: SupabaseIdentity): { identityId: string; provider: string; providerSubject: string | null } | null {
  const identityId = claimAsString(identity.identity_id) || claimAsString(identity.id);
  const provider = typeof identity.provider === 'string' ? identity.provider.trim().toLowerCase() : null;
  const providerSubject = claimAsString(identity.identity_data?.sub);
  if (!identityId || !provider) return null;
  return {
    identityId,
    provider,
    providerSubject,
  };
}

export async function rotateRefreshRti(
  env: Env,
  state: SessionState,
  payload: { sid: string; rti: string; ver: number; userId: string },
): Promise<
  | { ok: true; nextRti: string; shouldPersist: boolean }
  | { ok: false; response: Response }
> {
  const nowMs = Date.now();
  let nextRti = '';
  let shouldPersist = false;

  if (state.currentRti === payload.rti) {
    shouldPersist = true;
    nextRti = await deriveNextRti(env, { sid: state.sid, ver: state.ver, rti: payload.rti });
  } else {
    const rotatedAt = Number.isFinite(state.rtiRotatedAt) ? state.rtiRotatedAt : state.updatedAt;
    const withinGrace = nowMs >= rotatedAt && nowMs - rotatedAt < REFRESH_RTI_GRACE_MS;
    if (withinGrace) {
      const expectedCurrent = await deriveNextRti(env, { sid: state.sid, ver: state.ver, rti: payload.rti });
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

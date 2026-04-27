import {
  REFRESH_TOKEN_TTL_SECONDS,
  SESSION_KV_PREFIX,
  USER_INDEX_KV_PREFIX,
  type Env,
  type SessionState,
} from './types';
import { claimAsNumber, claimAsString } from './helpers';

function sessionKvKey(sid: string): string {
  return `${SESSION_KV_PREFIX}:${sid}`;
}

function userSessionIndexKvKey(userId: string): string {
  return `${USER_INDEX_KV_PREFIX}:${userId}`;
}

function toSessionState(value: unknown): SessionState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sid = claimAsString(record.sid);
  const currentRti = claimAsString(record.currentRti);
  const rtiRotatedAtRaw = claimAsNumber(record.rtiRotatedAt);
  const userId = claimAsString(record.userId);
  const ver = claimAsNumber(record.ver);
  const revoked = Boolean(record.revoked);
  const authMode = claimAsString(record.authMode);
  const createdAt = claimAsNumber(record.createdAt) || Date.now();
  const updatedAt = claimAsNumber(record.updatedAt) || Date.now();
  if (!sid || !currentRti || !userId || !ver) return null;
  if (authMode !== 'direct_provider') return null;
  const rtiRotatedAt = rtiRotatedAtRaw || updatedAt || createdAt;
  return {
    sid,
    currentRti,
    rtiRotatedAt,
    userId,
    ver,
    revoked,
    authMode,
    createdAt,
    updatedAt,
  };
}

export async function loadSessionState(env: Env, sid: string): Promise<SessionState | null> {
  const kv = env.BERLIN_SESSION_KV;
  if (!kv) return null;
  const raw = await kv.get(sessionKvKey(sid), 'json').catch(() => null);
  return toSessionState(raw);
}

export async function saveSessionState(env: Env, state: SessionState): Promise<void> {
  const kv = env.BERLIN_SESSION_KV;
  if (!kv) return;
  await kv.put(sessionKvKey(state.sid), JSON.stringify(state), {
    expirationTtl: REFRESH_TOKEN_TTL_SECONDS + 3600,
  });
}

async function loadUserSessionIds(env: Env, userId: string): Promise<string[]> {
  const kv = env.BERLIN_SESSION_KV;
  if (!kv) return [];
  const raw = await kv.get(userSessionIndexKvKey(userId), 'json').catch(() => null);
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => (typeof entry === 'string' ? entry : '')).filter((entry) => entry.length > 0);
}

async function saveUserSessionIds(env: Env, userId: string, sessionIds: string[]): Promise<void> {
  const kv = env.BERLIN_SESSION_KV;
  if (!kv) return;
  await kv.put(userSessionIndexKvKey(userId), JSON.stringify(sessionIds), {
    expirationTtl: REFRESH_TOKEN_TTL_SECONDS + 3600,
  });
}

export async function addUserSessionId(env: Env, userId: string, sid: string): Promise<void> {
  const current = await loadUserSessionIds(env, userId);
  if (current.includes(sid)) return;
  current.push(sid);
  await saveUserSessionIds(env, userId, current);
}

export async function revokeSessionBySid(env: Env, sid: string): Promise<void> {
  const existing = await loadSessionState(env, sid);
  if (!existing) return;
  if (!existing.revoked) {
    await saveSessionState(env, { ...existing, revoked: true, updatedAt: Date.now() });
  }
}

export async function revokeSessionsByUserId(env: Env, userId: string): Promise<number> {
  const sessionIds = await loadUserSessionIds(env, userId);
  if (!sessionIds.length) return 0;
  await Promise.all(sessionIds.map((sid) => revokeSessionBySid(env, sid)));
  await saveUserSessionIds(env, userId, []);
  return sessionIds.length;
}

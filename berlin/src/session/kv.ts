import {
  REFRESH_TOKEN_TTL_SECONDS,
  SESSION_KV_PREFIX,
  USER_INDEX_KV_PREFIX,
  type Env,
  type SessionState,
} from '../types';

function sessionKvKey(sid: string): string {
  return `${SESSION_KV_PREFIX}:${sid}`;
}

function userSessionIndexKvKey(userId: string): string {
  return `${USER_INDEX_KV_PREFIX}:${userId}`;
}

function requireSessionKv(env: Env): KVNamespace {
  if (!env.BERLIN_SESSION_KV) throw new Error('berlin.session.kv_missing');
  return env.BERLIN_SESSION_KV;
}

function toSessionState(value: unknown, sid: string): SessionState | null {
  if (value == null) return null; if (typeof value !== 'object' || Array.isArray(value)) throw new Error('berlin.session.state_invalid');
  const record = value as Record<string, unknown>;
  if (record.sid !== sid || typeof record.currentRti !== 'string' || !record.currentRti || typeof record.userId !== 'string' || !record.userId || record.authMode !== 'direct_provider' || !Number.isInteger(record.rtiRotatedAt) || !Number.isInteger(record.sessionRevision) || !Number.isInteger(record.createdAt) || !Number.isInteger(record.updatedAt) || typeof record.revoked !== 'boolean') throw new Error('berlin.session.state_invalid');
  return record as SessionState;
}

export async function loadSessionState(env: Env, sid: string): Promise<SessionState | null> {
  const kv = requireSessionKv(env);
  return toSessionState(await kv.get(sessionKvKey(sid), 'json'), sid);
}

export async function saveSessionState(env: Env, state: SessionState): Promise<void> {
  await requireSessionKv(env).put(sessionKvKey(state.sid), JSON.stringify(state), {
    expirationTtl: REFRESH_TOKEN_TTL_SECONDS + 3600,
  });
}

async function loadUserSessionIds(env: Env, userId: string): Promise<string[]> {
  const kv = requireSessionKv(env);
  const raw = await kv.get(userSessionIndexKvKey(userId), 'json');
  if (raw == null) return []; if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== 'string' || !entry)) throw new Error('berlin.session.index_invalid');
  return raw;
}

async function saveUserSessionIds(env: Env, userId: string, sessionIds: string[]): Promise<void> {
  await requireSessionKv(env).put(userSessionIndexKvKey(userId), JSON.stringify(sessionIds), {
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
  if (existing && !existing.revoked) await saveSessionState(env, { ...existing, revoked: true, updatedAt: Date.now() });
}

export async function revokeSessionsByUserId(env: Env, userId: string): Promise<number> {
  const sessionIds = await loadUserSessionIds(env, userId);
  if (!sessionIds.length) return 0;
  await Promise.all((await Promise.all(sessionIds.map(async (sid) => (await loadSessionState(env, sid)) ?? Promise.reject(new Error('berlin.session.state_invalid'))))).map((session) => saveSessionState(env, { ...session, revoked: true, updatedAt: Date.now() })));
  await saveUserSessionIds(env, userId, []);
  return sessionIds.length;
}

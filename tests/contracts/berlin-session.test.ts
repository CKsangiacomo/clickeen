import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { issueSession } from '../../berlin/src/auth-session';
import { loadSessionState } from '../../berlin/src/session-kv';
import { handleLogout, handleRefresh } from '../../berlin/src/routes-session';
import { verifyRefreshToken } from '../../berlin/src/jwt-crypto';

type JsonKvGetType = 'text' | 'json' | 'arrayBuffer' | 'stream';

function jsonRequest(url: string, body: unknown, init: RequestInit = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  });
}

function createKvNamespaceStub(): KVNamespace {
  const store = new Map<string, string>();

  return {
    async get(key: string, type?: JsonKvGetType) {
      const value = store.get(key);
      if (value == null) return null;
      if (type === 'json') return JSON.parse(value);
      if (type === 'arrayBuffer') return new TextEncoder().encode(value).buffer;
      if (type === 'stream') return new Blob([value]).stream();
      return value;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string | string[]) {
      const keys = Array.isArray(key) ? key : [key];
      for (const entry of keys) store.delete(entry);
    },
    async list() {
      return { keys: [], list_complete: true, cursor: '' };
    },
    async getWithMetadata(key: string, type?: JsonKvGetType) {
      const value = await this.get(key, type as any);
      return { value, metadata: null };
    },
  } as unknown as KVNamespace;
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function createBerlinEnv() {
  return {
    BERLIN_REFRESH_SECRET: 'berlin-refresh-contract-secret',
    BERLIN_ACCESS_PRIVATE_KEY_PEM: privateKey,
    BERLIN_ACCESS_PUBLIC_KEY_PEM: publicKey,
    BERLIN_ISSUER: 'berlin.test',
    BERLIN_AUDIENCE: 'clickeen.product',
    BERLIN_SESSION_KV: createKvNamespaceStub(),
  } as any;
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, any>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Berlin session-plane contract', () => {
  it('allows one grace-window refresh retry to converge on the same next RTI', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T18:00:00.000Z'));

    const env = createBerlinEnv();
    const issued = await issueSession(env, {
      userId: '0a5f59f9-27b9-4b31-bd2b-f3795ee9490a',
      supabaseRefreshToken: 'supabase-refresh-token',
    });

    vi.setSystemTime(new Date('2026-03-18T18:00:01.000Z'));
    const firstRefresh = await handleRefresh(
      jsonRequest('https://berlin.test/auth/refresh', { refreshToken: issued.refreshToken }),
      env,
    );
    expect(firstRefresh.status).toBe(200);
    const firstBody = await readJson(firstRefresh);

    vi.setSystemTime(new Date('2026-03-18T18:00:02.000Z'));
    const graceRetry = await handleRefresh(
      jsonRequest('https://berlin.test/auth/refresh', { refreshToken: issued.refreshToken }),
      env,
    );
    expect(graceRetry.status).toBe(200);
    const graceBody = await readJson(graceRetry);

    const firstVerified = await verifyRefreshToken(String(firstBody.refreshToken), env);
    const secondVerified = await verifyRefreshToken(String(graceBody.refreshToken), env);
    expect(firstVerified.ok).toBe(true);
    expect(secondVerified.ok).toBe(true);
    if (!firstVerified.ok || !secondVerified.ok) {
      throw new Error('expected both refresh tokens to verify');
    }

    expect(firstVerified.payload.sid).toBe(issued.sid);
    expect(secondVerified.payload.sid).toBe(issued.sid);
    expect(firstVerified.payload.rti).toBe(secondVerified.payload.rti);

    const state = await loadSessionState(env, issued.sid);
    expect(state?.revoked).toBe(false);
    expect(state?.currentRti).toBe(firstVerified.payload.rti);
  });

  it('revokes the session when an old refresh token is replayed after the grace window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T19:00:00.000Z'));

    const env = createBerlinEnv();
    const issued = await issueSession(env, {
      userId: '11111111-2222-3333-4444-555555555555',
      supabaseRefreshToken: 'supabase-refresh-token',
    });

    vi.setSystemTime(new Date('2026-03-18T19:00:01.000Z'));
    const firstRefresh = await handleRefresh(
      jsonRequest('https://berlin.test/auth/refresh', { refreshToken: issued.refreshToken }),
      env,
    );
    expect(firstRefresh.status).toBe(200);
    const firstBody = await readJson(firstRefresh);

    vi.setSystemTime(new Date('2026-03-18T19:00:32.000Z'));
    const replay = await handleRefresh(
      jsonRequest('https://berlin.test/auth/refresh', { refreshToken: issued.refreshToken }),
      env,
    );
    expect(replay.status).toBe(401);
    const replayBody = await readJson(replay);
    expect(replayBody).toMatchObject({
      error: {
        kind: 'AUTH',
        reasonKey: 'coreui.errors.auth.required',
        detail: 'refresh_reuse_detected',
      },
    });

    const revokedState = await loadSessionState(env, issued.sid);
    expect(revokedState?.revoked).toBe(true);

    const rotatedRefresh = await handleRefresh(
      jsonRequest('https://berlin.test/auth/refresh', {
        refreshToken: String(firstBody.refreshToken),
      }),
      env,
    );
    expect(rotatedRefresh.status).toBe(401);
    const rotatedBody = await readJson(rotatedRefresh);
    expect(rotatedBody).toMatchObject({
      error: {
        kind: 'AUTH',
        detail: 'session_revoked',
      },
    });
  });

  it('logout scope=user revokes every session for the authenticated user', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T20:00:00.000Z'));

    const env = createBerlinEnv();
    const first = await issueSession(env, {
      userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      supabaseRefreshToken: 'supabase-refresh-1',
    });
    const second = await issueSession(env, {
      userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      supabaseRefreshToken: 'supabase-refresh-2',
    });

    const logout = await handleLogout(
      jsonRequest(
        'https://berlin.test/auth/logout',
        { scope: 'user' },
        {
          headers: {
            authorization: `Bearer ${first.accessToken}`,
          },
        },
      ),
      env,
    );
    expect(logout.status).toBe(200);
    const body = await readJson(logout);
    expect(body).toMatchObject({ ok: true, revokedScope: 'user', revokedCount: 2 });

    expect((await loadSessionState(env, first.sid))?.revoked).toBe(true);
    expect((await loadSessionState(env, second.sid))?.revoked).toBe(true);
  });

  it('logout with a refresh token revokes only that session and leaves siblings usable', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T21:00:00.000Z'));

    const env = createBerlinEnv();
    const first = await issueSession(env, {
      userId: '99999999-8888-7777-6666-555555555555',
      supabaseRefreshToken: 'supabase-refresh-1',
    });
    const second = await issueSession(env, {
      userId: '99999999-8888-7777-6666-555555555555',
      supabaseRefreshToken: 'supabase-refresh-2',
    });

    const logout = await handleLogout(
      jsonRequest('https://berlin.test/auth/logout', {
        refreshToken: first.refreshToken,
      }),
      env,
    );
    expect(logout.status).toBe(200);
    const logoutBody = await readJson(logout);
    expect(logoutBody).toMatchObject({
      ok: true,
      revokedScope: 'sid',
      sid: first.sid,
    });

    expect((await loadSessionState(env, first.sid))?.revoked).toBe(true);
    expect((await loadSessionState(env, second.sid))?.revoked).toBe(false);

    const revokedRefresh = await handleRefresh(
      jsonRequest('https://berlin.test/auth/refresh', { refreshToken: first.refreshToken }),
      env,
    );
    expect(revokedRefresh.status).toBe(401);

    vi.setSystemTime(new Date('2026-03-18T21:00:01.000Z'));
    const siblingRefresh = await handleRefresh(
      jsonRequest('https://berlin.test/auth/refresh', { refreshToken: second.refreshToken }),
      env,
    );
    expect(siblingRefresh.status).toBe(200);
  });
});

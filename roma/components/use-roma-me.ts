'use client';

import { useCallback, useEffect, useState } from 'react';
import { setRomaAccountCapsule, setRomaAuthzCapsule } from './paris-http';

export type RomaMeResponse = {
  user: {
    id: string;
    email: string | null;
    role: string | null;
  };
  accounts: Array<{
    accountId: string;
    status: string;
    isPlatform: boolean;
    derivedRole: 'account_owner' | 'account_admin' | 'account_member';
    workspaceRoles: string[];
  }>;
  workspaces: Array<{
    workspaceId: string;
    accountId: string;
    role: string;
    name: string;
    slug: string;
    tier: string;
    websiteUrl?: string | null;
    membershipVersion?: string | null;
  }>;
  defaults: {
    accountId: string | null;
    workspaceId: string | null;
  };
  authz?: {
    workspaceCapsule?: string | null;
    workspaceId?: string | null;
    accountId?: string | null;
    role?: string | null;
    profile?: string | null;
    authzVersion?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    accountCapsule?: string | null;
    accountRole?: string | null;
    accountProfile?: string | null;
    accountAuthzVersion?: string | null;
    accountIssuedAt?: string | null;
    accountExpiresAt?: string | null;
    entitlements?: {
      flags?: Record<string, boolean>;
      caps?: Record<string, number | null>;
      budgets?: Record<string, { max: number | null; used: number }>;
    } | null;
  };
};

export type ResolvedRomaContext = {
  accountId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
};

const ROMA_ACTIVE_WORKSPACE_STORE_KEY = '__CK_ROMA_ACTIVE_WORKSPACE_ID_V1__';
const ROMA_EMPTY_WORKSPACE_CACHE_KEY = '__CK_ROMA_NO_WORKSPACE__';

function normalizeWorkspaceId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function readWorkspaceIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  return normalizeWorkspaceId(url.searchParams.get('workspaceId'));
}

function readStoredWorkspaceIdPreference(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeWorkspaceId(window.localStorage.getItem(ROMA_ACTIVE_WORKSPACE_STORE_KEY));
  } catch {
    return null;
  }
}

function writeStoredWorkspaceIdPreference(workspaceId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (workspaceId) {
      window.localStorage.setItem(ROMA_ACTIVE_WORKSPACE_STORE_KEY, workspaceId);
      return;
    }
    window.localStorage.removeItem(ROMA_ACTIVE_WORKSPACE_STORE_KEY);
  } catch {
    // Ignore local storage failures.
  }
}

function resolveRequestedWorkspaceId(): string | null {
  const fromLocation = readWorkspaceIdFromLocation();
  if (fromLocation) {
    writeStoredWorkspaceIdPreference(fromLocation);
    return fromLocation;
  }
  return readStoredWorkspaceIdPreference();
}

function toWorkspaceCacheKey(workspaceId: string | null): string {
  return workspaceId || ROMA_EMPTY_WORKSPACE_CACHE_KEY;
}

function resolveWorkspaceCapsule(data: RomaMeResponse | null): string | null {
  const candidate = data?.authz?.workspaceCapsule;
  if (typeof candidate !== 'string') return null;
  const normalized = candidate.trim();
  return normalized || null;
}

function resolveAccountCapsule(data: RomaMeResponse | null): string | null {
  const candidate = data?.authz?.accountCapsule;
  if (typeof candidate !== 'string') return null;
  const normalized = candidate.trim();
  return normalized || null;
}

export function resolveDefaultRomaContext(data: RomaMeResponse | null): ResolvedRomaContext {
  if (!data) {
    return {
      accountId: '',
      workspaceId: '',
      workspaceName: '',
      workspaceSlug: '',
    };
  }

  const preferredWorkspaceId = normalizeWorkspaceId(data.defaults.workspaceId);
  const workspace = preferredWorkspaceId
    ? data.workspaces.find((item) => item.workspaceId === preferredWorkspaceId) ?? null
    : null;
  const accountId =
    workspace?.accountId || normalizeWorkspaceId(data.defaults.accountId) || '';

  return {
    accountId,
    workspaceId: workspace?.workspaceId ?? '',
    workspaceName: workspace?.name ?? '',
    workspaceSlug: workspace?.slug ?? '',
  };
}

type UseRomaMeState = {
  loading: boolean;
  data: RomaMeResponse | null;
  error: string | null;
};

const ROMA_ME_SUCCESS_FALLBACK_TTL_MS = 5 * 60_000;
const ROMA_ME_ERROR_TTL_MS = 10_000;
const ROMA_ME_MIN_SUCCESS_TTL_MS = 30_000;
const ROMA_ME_AUTHZ_EXPIRY_SKEW_MS = 30_000;
const ROMA_ME_STORE_KEY = '__CK_ROMA_ME_STORE_V1__';
const ROMA_ME_SESSION_STORE_KEY = '__CK_ROMA_ME_SESSION_STORE_V1__';

type RomaMeCacheEntry = {
  state: UseRomaMeState;
  expiresAt: number;
};

type RomaMeStore = {
  cache: Record<string, RomaMeCacheEntry | undefined>;
  inFlight: Record<string, Promise<UseRomaMeState> | undefined>;
  hydratedFromSession: boolean;
};

type RomaMeSessionCacheEntry = {
  data: RomaMeResponse;
  expiresAt: number;
};

type RomaMeSessionStore = {
  v: 1;
  cache: Record<string, RomaMeSessionCacheEntry | undefined>;
};

function isRomaMeStore(value: unknown): value is RomaMeStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cache = record.cache;
  const inFlight = record.inFlight;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;
  if (!inFlight || typeof inFlight !== 'object' || Array.isArray(inFlight)) return false;
  return true;
}

function isRomaMeSessionStore(value: unknown): value is RomaMeSessionStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.v !== 1) return false;
  if (!record.cache || typeof record.cache !== 'object' || Array.isArray(record.cache)) return false;
  return true;
}

function resolveRomaMeSuccessTtlMs(data: RomaMeResponse | null): number {
  const workspaceExpiresAt = typeof data?.authz?.expiresAt === 'string' ? data.authz.expiresAt.trim() : '';
  const accountExpiresAt = typeof data?.authz?.accountExpiresAt === 'string' ? data.authz.accountExpiresAt.trim() : '';
  const expiryCandidates = [workspaceExpiresAt, accountExpiresAt]
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  if (expiryCandidates.length === 0) return ROMA_ME_SUCCESS_FALLBACK_TTL_MS;
  const expiresAtMs = Math.min(...expiryCandidates);
  const remainingMs = expiresAtMs - Date.now() - ROMA_ME_AUTHZ_EXPIRY_SKEW_MS;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return ROMA_ME_MIN_SUCCESS_TTL_MS;
  return Math.max(ROMA_ME_MIN_SUCCESS_TTL_MS, Math.round(remainingMs));
}

function persistRomaMeSessionStore(store: RomaMeStore): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const cache: Record<string, RomaMeSessionCacheEntry | undefined> = {};
    Object.entries(store.cache).forEach(([key, entry]) => {
      if (!entry) return;
      if (entry.expiresAt <= now) return;
      if (entry.state.error || !entry.state.data) return;
      cache[key] = {
        data: entry.state.data,
        expiresAt: entry.expiresAt,
      };
    });

    if (Object.keys(cache).length === 0) {
      window.sessionStorage.removeItem(ROMA_ME_SESSION_STORE_KEY);
      return;
    }

    const payload: RomaMeSessionStore = {
      v: 1,
      cache,
    };
    window.sessionStorage.setItem(ROMA_ME_SESSION_STORE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore session storage failures.
  }
}

function hydrateRomaMeStoreFromSession(store: RomaMeStore): void {
  if (store.hydratedFromSession) return;
  store.hydratedFromSession = true;
  if (typeof window === 'undefined') return;

  try {
    const raw = window.sessionStorage.getItem(ROMA_ME_SESSION_STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRomaMeSessionStore(parsed)) {
      window.sessionStorage.removeItem(ROMA_ME_SESSION_STORE_KEY);
      return;
    }

    const now = Date.now();
    let hasExpired = false;
    Object.entries(parsed.cache).forEach(([key, entry]) => {
      if (!entry || typeof entry !== 'object') return;
      const expiresAt = Number(entry.expiresAt);
      const data = entry.data;
      if (!Number.isFinite(expiresAt) || expiresAt <= now || !data || typeof data !== 'object' || Array.isArray(data)) {
        hasExpired = true;
        return;
      }
      store.cache[key] = {
        state: {
          loading: false,
          data,
          error: null,
        },
        expiresAt,
      };
    });
    if (hasExpired) {
      persistRomaMeSessionStore(store);
    }
  } catch {
    // Ignore session storage failures.
  }
}

function resolveRomaMeStore(): RomaMeStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[ROMA_ME_STORE_KEY];
  let store: RomaMeStore;
  if (isRomaMeStore(existing)) {
    store = existing as RomaMeStore;
    if (store.hydratedFromSession !== true) {
      store.hydratedFromSession = false;
    }
  } else {
    store = { cache: {}, inFlight: {}, hydratedFromSession: false };
  }
  scope[ROMA_ME_STORE_KEY] = store;
  hydrateRomaMeStoreFromSession(store);
  return store;
}

function readRomaMeCache(workspaceId: string | null): UseRomaMeState | null {
  const store = resolveRomaMeStore();
  const key = toWorkspaceCacheKey(workspaceId);
  const entry = store.cache[key] ?? null;
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    delete store.cache[key];
    persistRomaMeSessionStore(store);
    return null;
  }
  return entry.state;
}

function writeRomaMeCache(workspaceId: string | null, state: UseRomaMeState): UseRomaMeState {
  const store = resolveRomaMeStore();
  const ttl = state.error ? ROMA_ME_ERROR_TTL_MS : resolveRomaMeSuccessTtlMs(state.data);
  const key = toWorkspaceCacheKey(workspaceId);
  store.cache[key] = {
    state,
    expiresAt: Date.now() + ttl,
  };
  persistRomaMeSessionStore(store);
  return state;
}

async function fetchRomaMeState(workspaceId: string | null): Promise<UseRomaMeState> {
  try {
    const search = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    const response = await fetch(`/api/bootstrap${search}`, { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as
      | RomaMeResponse
      | { error?: unknown }
      | null;
    const authErrorReason = (payload as any)?.error?.reasonKey || (payload as any)?.error;
    if (response.ok && authErrorReason) {
      throw new Error(typeof authErrorReason === 'string' ? authErrorReason : 'coreui.errors.auth.required');
    }
    if (!response.ok) {
      const reason = (payload as any)?.error?.reasonKey || (payload as any)?.error || `HTTP_${response.status}`;
      throw new Error(typeof reason === 'string' ? reason : 'coreui.errors.auth.required');
    }

    const activeWorkspaceId = normalizeWorkspaceId((payload as RomaMeResponse)?.defaults?.workspaceId);
    if (activeWorkspaceId) {
      writeStoredWorkspaceIdPreference(activeWorkspaceId);
    }
    setRomaAuthzCapsule(resolveWorkspaceCapsule(payload as RomaMeResponse));
    setRomaAccountCapsule(resolveAccountCapsule(payload as RomaMeResponse));

    return {
      loading: false,
      data: payload as RomaMeResponse,
      error: null,
    };
  } catch (error) {
    setRomaAuthzCapsule(null);
    setRomaAccountCapsule(null);
    const message = error instanceof Error ? error.message : String(error);
    return {
      loading: false,
      data: null,
      error: message,
    };
  }
}

async function loadRomaMeState(force: boolean, workspaceId: string | null): Promise<UseRomaMeState> {
  const store = resolveRomaMeStore();
  const key = toWorkspaceCacheKey(workspaceId);
  if (!force) {
    const cached = readRomaMeCache(workspaceId);
    if (cached) return cached;
  } else {
    delete store.cache[key];
    persistRomaMeSessionStore(store);
  }

  const inFlight = store.inFlight[key];
  if (inFlight) return inFlight;

  store.inFlight[key] = fetchRomaMeState(workspaceId)
    .then((nextState) => writeRomaMeCache(workspaceId, nextState))
    .finally(() => {
      delete resolveRomaMeStore().inFlight[key];
    });
  return store.inFlight[key] as Promise<UseRomaMeState>;
}

export function useRomaMe() {
  const [state, setState] = useState<UseRomaMeState>(() => {
    const requestedWorkspaceId = resolveRequestedWorkspaceId();
    const cached = readRomaMeCache(requestedWorkspaceId);
    return cached ?? { loading: true, data: null, error: null };
  });

  const load = useCallback(async (force: boolean) => {
    const requestedWorkspaceId = resolveRequestedWorkspaceId();
    const cached = !force ? readRomaMeCache(requestedWorkspaceId) : null;
    if (cached) {
      setState(cached);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const nextState = await loadRomaMeState(force, requestedWorkspaceId);
    setState(nextState);
  }, []);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  const setActiveWorkspace = useCallback(
    async (workspaceId: string | null) => {
      writeStoredWorkspaceIdPreference(normalizeWorkspaceId(workspaceId));
      await load(true);
    },
    [load],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    setRomaAuthzCapsule(resolveWorkspaceCapsule(state.data));
    setRomaAccountCapsule(resolveAccountCapsule(state.data));
    if (!state.data) return;
    const activeWorkspaceId = normalizeWorkspaceId(state.data.defaults.workspaceId);
    if (activeWorkspaceId) {
      writeStoredWorkspaceIdPreference(activeWorkspaceId);
    }
  }, [state.data]);

  return {
    loading: state.loading,
    data: state.data,
    error: state.error,
    reload,
    setActiveWorkspace,
  };
}

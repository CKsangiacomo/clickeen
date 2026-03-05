'use client';

import { useCallback, useEffect, useState } from 'react';
import { setRomaAuthzCapsule } from './paris-http';

export type RomaMeResponse = {
  user: {
    id: string;
    email: string | null;
    role: string | null;
  };
  accounts: Array<{
    accountId: string;
    role: string;
    name: string;
    slug: string;
    tier: string;
    websiteUrl: string | null;
    membershipVersion: string | null;
    lifecycleNotice?: {
      tierChangedAt?: string | null;
      tierChangedFrom?: string | null;
      tierChangedTo?: string | null;
      tierDropDismissedAt?: string | null;
      tierDropEmailSentAt?: string | null;
    } | null;
  }>;
  defaults: {
    accountId: string | null;
  };
  authz?: {
    accountCapsule?: string | null;
    accountId?: string | null;
    role?: string | null;
    profile?: string | null;
    authzVersion?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    entitlements?: {
      flags?: Record<string, boolean>;
      caps?: Record<string, number | null>;
      budgets?: Record<string, { max: number | null; used: number }>;
    } | null;
  } | null;
};

export type ResolvedRomaContext = {
  accountId: string;
  accountName: string;
  accountSlug: string;
};

const ROMA_ACTIVE_ACCOUNT_STORE_KEY = '__CK_ROMA_ACTIVE_ACCOUNT_ID_V1__';
const ROMA_EMPTY_ACCOUNT_CACHE_KEY = '__CK_ROMA_NO_ACCOUNT__';

function normalizeAccountId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function readAccountIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  return normalizeAccountId(url.searchParams.get('accountId'));
}

function readStoredAccountIdPreference(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeAccountId(window.localStorage.getItem(ROMA_ACTIVE_ACCOUNT_STORE_KEY));
  } catch {
    return null;
  }
}

function writeStoredAccountIdPreference(accountId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (accountId) {
      window.localStorage.setItem(ROMA_ACTIVE_ACCOUNT_STORE_KEY, accountId);
      return;
    }
    window.localStorage.removeItem(ROMA_ACTIVE_ACCOUNT_STORE_KEY);
  } catch {
    // Ignore local storage failures.
  }
}

function resolveRequestedAccountId(): string | null {
  const fromLocation = readAccountIdFromLocation();
  if (fromLocation) {
    writeStoredAccountIdPreference(fromLocation);
    return fromLocation;
  }
  return readStoredAccountIdPreference();
}

function toAccountCacheKey(accountId: string | null): string {
  return accountId || ROMA_EMPTY_ACCOUNT_CACHE_KEY;
}

function resolveAccountCapsule(data: RomaMeResponse | null): string | null {
  const candidate = data?.authz?.accountCapsule;
  if (typeof candidate !== 'string') return null;
  const normalized = candidate.trim();
  return normalized || null;
}

export function resolveDefaultRomaContext(data: RomaMeResponse | null): ResolvedRomaContext {
  const defaultAccountId = normalizeAccountId(data?.defaults?.accountId);
  const account = defaultAccountId ? data?.accounts?.find((item) => item.accountId === defaultAccountId) ?? null : null;
  return {
    accountId: defaultAccountId || '',
    accountName: account?.name ?? '',
    accountSlug: account?.slug ?? '',
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
const ROMA_ME_STORE_KEY = '__CK_ROMA_ME_STORE_V2__';

type RomaMeCacheEntry = {
  state: UseRomaMeState;
  expiresAt: number;
};

type RomaMeStore = {
  cache: Record<string, RomaMeCacheEntry | undefined>;
  inFlight: Record<string, Promise<UseRomaMeState> | undefined>;
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

function resolveRomaMeSuccessTtlMs(data: RomaMeResponse | null): number {
  const expiresAt = typeof data?.authz?.expiresAt === 'string' ? data.authz.expiresAt.trim() : '';
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return ROMA_ME_SUCCESS_FALLBACK_TTL_MS;
  const remainingMs = expiresAtMs - Date.now() - ROMA_ME_AUTHZ_EXPIRY_SKEW_MS;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return ROMA_ME_MIN_SUCCESS_TTL_MS;
  return Math.max(ROMA_ME_MIN_SUCCESS_TTL_MS, Math.round(remainingMs));
}

function resolveRomaMeStore(): RomaMeStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[ROMA_ME_STORE_KEY];
  if (isRomaMeStore(existing)) return existing;
  const next: RomaMeStore = { cache: {}, inFlight: {} };
  scope[ROMA_ME_STORE_KEY] = next;
  return next;
}

function readRomaMeCache(accountId: string | null): UseRomaMeState | null {
  const store = resolveRomaMeStore();
  const key = toAccountCacheKey(accountId);
  const entry = store.cache[key] ?? null;
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    delete store.cache[key];
    return null;
  }
  return entry.state;
}

function writeRomaMeCache(accountId: string | null, state: UseRomaMeState): UseRomaMeState {
  const store = resolveRomaMeStore();
  const ttl = state.error ? ROMA_ME_ERROR_TTL_MS : resolveRomaMeSuccessTtlMs(state.data);
  const key = toAccountCacheKey(accountId);
  store.cache[key] = {
    state,
    expiresAt: Date.now() + ttl,
  };
  return state;
}

async function fetchRomaMeState(accountId: string | null): Promise<UseRomaMeState> {
  try {
    const search = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
    const response = await fetch(`/api/bootstrap${search}`, { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as RomaMeResponse | { error?: unknown } | null;
    const authErrorReason = (payload as any)?.error?.reasonKey || (payload as any)?.error;
    if (response.ok && authErrorReason) {
      throw new Error(typeof authErrorReason === 'string' ? authErrorReason : 'coreui.errors.auth.required');
    }
    if (!response.ok) {
      const reason = (payload as any)?.error?.reasonKey || (payload as any)?.error || `HTTP_${response.status}`;
      throw new Error(typeof reason === 'string' ? reason : 'coreui.errors.auth.required');
    }

    const resolvedAccountId = normalizeAccountId((payload as RomaMeResponse)?.defaults?.accountId);
    if (resolvedAccountId) {
      writeStoredAccountIdPreference(resolvedAccountId);
    }
    setRomaAuthzCapsule(resolveAccountCapsule(payload as RomaMeResponse));

    return {
      loading: false,
      data: payload as RomaMeResponse,
      error: null,
    };
  } catch (error) {
    setRomaAuthzCapsule(null);
    const message = error instanceof Error ? error.message : String(error);
    return {
      loading: false,
      data: null,
      error: message,
    };
  }
}

async function loadRomaMeState(force: boolean, accountId: string | null): Promise<UseRomaMeState> {
  const store = resolveRomaMeStore();
  const key = toAccountCacheKey(accountId);
  if (!force) {
    const cached = readRomaMeCache(accountId);
    if (cached) return cached;
  } else {
    delete store.cache[key];
  }

  const inFlight = store.inFlight[key];
  if (inFlight) return inFlight;

  store.inFlight[key] = fetchRomaMeState(accountId)
    .then((nextState) => writeRomaMeCache(accountId, nextState))
    .finally(() => {
      delete resolveRomaMeStore().inFlight[key];
    });
  return store.inFlight[key] as Promise<UseRomaMeState>;
}

export function useRomaMe() {
  const [state, setState] = useState<UseRomaMeState>({
    loading: true,
    data: null,
    error: null,
  });

  const load = useCallback(async (force: boolean) => {
    const requestedAccountId = resolveRequestedAccountId();
    const cached = !force ? readRomaMeCache(requestedAccountId) : null;
    if (cached) {
      setState(cached);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const nextState = await loadRomaMeState(force, requestedAccountId);
    setState(nextState);
  }, []);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  const setActiveAccount = useCallback(
    async (accountId: string | null) => {
      writeStoredAccountIdPreference(normalizeAccountId(accountId));
      await load(true);
    },
    [load],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    setRomaAuthzCapsule(resolveAccountCapsule(state.data));
    if (!state.data) return;
    const resolvedAccountId = normalizeAccountId(state.data.defaults.accountId);
    if (resolvedAccountId) {
      writeStoredAccountIdPreference(resolvedAccountId);
    }
  }, [state.data]);

  return {
    loading: state.loading,
    data: state.data,
    error: state.error,
    reload,
    setActiveAccount,
  };
}

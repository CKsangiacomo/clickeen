'use client';

import { useCallback, useEffect, useState } from 'react';
import { assertPolicyEntitlementsSnapshot } from '@clickeen/ck-policy';

export type RomaMeResponse = {
  user: {
    id: string;
    email: string | null;
    role: string | null;
  };
  profile?: {
    userId: string;
    primaryEmail: string;
    emailVerified: boolean;
    givenName: string | null;
    familyName: string | null;
    primaryLanguage: string | null;
    country: string | null;
    timezone: string | null;
    contactMethods?: {
      phone: {
        value: string | null;
        verified: boolean;
        pendingValue: string | null;
        challengeExpiresAt: string | null;
      };
      whatsapp: {
        value: string | null;
        verified: boolean;
        pendingValue: string | null;
        challengeExpiresAt: string | null;
      };
    };
  } | null;
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

export type RomaAuthzPolicy = {
  v: 1;
  profile: 'minibob' | 'free' | 'tier1' | 'tier2' | 'tier3';
  role: 'viewer' | 'editor' | 'admin' | 'owner';
  flags: Record<string, boolean>;
  caps: Record<string, number | null>;
  budgets: Record<string, { max: number | null; used: number }>;
};

function normalizeAccountId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRole(value: unknown): RomaAuthzPolicy['role'] | null {
  switch (value) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return value;
    default:
      return null;
  }
}

function normalizeProfile(value: unknown): RomaAuthzPolicy['profile'] | null {
  switch (value) {
    case 'minibob':
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return value;
    default:
      return null;
  }
}

export function resolveAccountPolicyFromRomaAuthz(data: RomaMeResponse | null, accountId: string): RomaAuthzPolicy | null {
  const normalizedAccountId = normalizeAccountId(accountId);
  const authz = data?.authz;
  if (!normalizedAccountId || !authz) return null;

  const authzAccountId = normalizeAccountId(authz.accountId);
  if (!authzAccountId || authzAccountId !== normalizedAccountId) return null;

  const role = normalizeRole(authz.role);
  const profile = normalizeProfile(authz.profile);
  if (!role || !profile) return null;
  let entitlements;
  try {
    if (!Object.prototype.hasOwnProperty.call(authz, 'entitlements')) return null;
    entitlements = assertPolicyEntitlementsSnapshot(authz.entitlements);
  } catch {
    return null;
  }
  if (!entitlements) return null;

  return {
    v: 1,
    profile,
    role,
    flags: { ...(entitlements.flags ?? {}) },
    caps: { ...(entitlements.caps ?? {}) },
    budgets: Object.fromEntries(
      Object.entries(entitlements.budgets ?? {}).filter((entry): entry is [string, { max: number | null; used: number }] => Boolean(entry[1])),
    ),
  };
}

function assertRomaMeAuthzPayload(data: RomaMeResponse | null): void {
  const authz = data?.authz;
  if (!authz) return;

  const accountId = normalizeAccountId(authz.accountId);
  const role = normalizeRole(authz.role);
  const profile = normalizeProfile(authz.profile);
  const authzVersion = typeof authz.authzVersion === 'string' ? authz.authzVersion.trim() : '';
  const issuedAt = typeof authz.issuedAt === 'string' ? authz.issuedAt.trim() : '';
  const expiresAt = typeof authz.expiresAt === 'string' ? authz.expiresAt.trim() : '';
  const accountCapsule = typeof authz.accountCapsule === 'string' ? authz.accountCapsule.trim() : '';

  if (!accountId || !role || !profile || !authzVersion || !issuedAt || !expiresAt || !accountCapsule) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
  if (!Number.isFinite(Date.parse(issuedAt)) || !Number.isFinite(Date.parse(expiresAt))) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
  if (!Object.prototype.hasOwnProperty.call(authz, 'entitlements')) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
  if (!assertPolicyEntitlementsSnapshot(authz.entitlements)) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
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

function readRomaMeCache(): UseRomaMeState | null {
  const store = resolveRomaMeStore();
  const key = '__default__';
  const entry = store.cache[key] ?? null;
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    delete store.cache[key];
    return null;
  }
  return entry.state;
}

function writeRomaMeCache(state: UseRomaMeState): UseRomaMeState {
  const store = resolveRomaMeStore();
  const ttl = state.error ? ROMA_ME_ERROR_TTL_MS : resolveRomaMeSuccessTtlMs(state.data);
  const key = '__default__';
  store.cache[key] = {
    state,
    expiresAt: Date.now() + ttl,
  };
  return state;
}

async function fetchRomaMeState(): Promise<UseRomaMeState> {
  try {
    const response = await fetch('/api/bootstrap', { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as RomaMeResponse | { error?: unknown } | null;
    const authErrorReason = (payload as any)?.error?.reasonKey || (payload as any)?.error;
    if (response.ok && authErrorReason) {
      throw new Error(typeof authErrorReason === 'string' ? authErrorReason : 'coreui.errors.auth.required');
    }
    if (!response.ok) {
      const reason = (payload as any)?.error?.reasonKey || (payload as any)?.error || `HTTP_${response.status}`;
      throw new Error(typeof reason === 'string' ? reason : 'coreui.errors.auth.required');
    }
    assertRomaMeAuthzPayload(payload as RomaMeResponse | null);

    return {
      loading: false,
      data: payload as RomaMeResponse,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      loading: false,
      data: null,
      error: message,
    };
  }
}

async function loadRomaMeState(force: boolean): Promise<UseRomaMeState> {
  const store = resolveRomaMeStore();
  const key = '__default__';
  if (!force) {
    const cached = readRomaMeCache();
    if (cached) return cached;
  } else {
    delete store.cache[key];
  }

  const inFlight = store.inFlight[key];
  if (inFlight) return inFlight;

  store.inFlight[key] = fetchRomaMeState()
    .then((nextState) => writeRomaMeCache(nextState))
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
    const cached = !force ? readRomaMeCache() : null;
    if (cached) {
      setState(cached);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const nextState = await loadRomaMeState(force);
    setState(nextState);
  }, []);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    loading: state.loading,
    data: state.data,
    error: state.error,
    reload,
  };
}

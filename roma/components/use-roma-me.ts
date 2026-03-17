'use client';

import { useCallback, useEffect, useState } from 'react';
import { assertPolicyEntitlementsSnapshot } from '@clickeen/ck-policy';

export type RomaLifecycleNotice = {
  tierChangedAt?: string | null;
  tierChangedFrom?: string | null;
  tierChangedTo?: string | null;
  tierDropDismissedAt?: string | null;
  tierDropEmailSentAt?: string | null;
} | null;

export type RomaAccountSummary = {
  accountId: string;
  role: string;
  name: string;
  slug: string;
  tier: string;
  websiteUrl: string | null;
  membershipVersion: string | null;
  lifecycleNotice?: RomaLifecycleNotice;
};

export type RomaActiveAccount = RomaAccountSummary & {
  status: string;
  isPlatform: boolean;
  l10nLocales?: unknown;
  l10nPolicy?: unknown;
};

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
  activeAccount?: RomaActiveAccount | null;
  accounts: RomaAccountSummary[];
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
      budgets?: Record<string, { max: number | null; used?: number | null }>;
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

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

function normalizeLifecycleNotice(value: unknown): RomaLifecycleNotice {
  if (value == null) return null;
  if (!isRecord(value)) return null;
  return {
    tierChangedAt: normalizeOptionalString(value.tierChangedAt),
    tierChangedFrom: normalizeOptionalString(value.tierChangedFrom),
    tierChangedTo: normalizeOptionalString(value.tierChangedTo),
    tierDropDismissedAt: normalizeOptionalString(value.tierDropDismissedAt),
    tierDropEmailSentAt: normalizeOptionalString(value.tierDropEmailSentAt),
  };
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
      Object.entries(entitlements.budgets ?? {}).flatMap(([key, entry]) => {
        if (!entry) return [];
        const used = typeof entry.used === 'number' && Number.isFinite(entry.used) ? Math.max(0, Math.trunc(entry.used)) : 0;
        return [[key, { max: entry.max ?? null, used }] as const];
      }),
    ),
  };
}

function assertRomaMeActiveAccountPayload(data: RomaMeResponse | null): void {
  const activeAccount = data?.activeAccount;
  if (!activeAccount || !isRecord(activeAccount)) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }

  const accountId = normalizeAccountId(activeAccount.accountId);
  const role = normalizeRole(activeAccount.role);
  const profile = normalizeProfile(activeAccount.tier);
  const status = normalizeOptionalString(activeAccount.status);
  const name = normalizeOptionalString(activeAccount.name);
  const slug = normalizeOptionalString(activeAccount.slug);
  if (!accountId || !role || !profile || !status || !name || !slug || typeof activeAccount.isPlatform !== 'boolean') {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
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

  assertRomaMeActiveAccountPayload(data);
  const activeAccountId = normalizeAccountId(data?.activeAccount?.accountId);
  if (!activeAccountId || activeAccountId !== accountId) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
}

export function resolveActiveRomaAccount(data: RomaMeResponse | null): RomaActiveAccount | null {
  const activeAccount = data?.activeAccount;
  if (!activeAccount) return null;
  return {
    accountId: normalizeAccountId(activeAccount.accountId) ?? '',
    role: normalizeOptionalString(activeAccount.role) ?? '',
    name: normalizeOptionalString(activeAccount.name) ?? '',
    slug: normalizeOptionalString(activeAccount.slug) ?? '',
    tier: normalizeOptionalString(activeAccount.tier) ?? '',
    websiteUrl: normalizeOptionalString(activeAccount.websiteUrl),
    membershipVersion: normalizeOptionalString(activeAccount.membershipVersion),
    lifecycleNotice: normalizeLifecycleNotice(activeAccount.lifecycleNotice),
    status: normalizeOptionalString(activeAccount.status) ?? '',
    isPlatform: Boolean(activeAccount.isPlatform),
    l10nLocales: activeAccount.l10nLocales,
    l10nPolicy: activeAccount.l10nPolicy,
  };
}

export function resolveActiveRomaContext(data: RomaMeResponse | null): ResolvedRomaContext {
  const activeAccount = resolveActiveRomaAccount(data);
  return {
    accountId: activeAccount?.accountId ?? '',
    accountName: activeAccount?.name ?? '',
    accountSlug: activeAccount?.slug ?? '',
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
const ROMA_ME_PROACTIVE_REFRESH_LEAD_MS = 2 * 60_000;
const ROMA_ME_PROACTIVE_REFRESH_MIN_DELAY_MS = 5_000;
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

function isRomaMeAuthzStillValid(data: RomaMeResponse | null): boolean {
  const expiresAt = typeof data?.authz?.expiresAt === 'string' ? data.authz.expiresAt.trim() : '';
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return false;
  return expiresAtMs > Date.now() + ROMA_ME_AUTHZ_EXPIRY_SKEW_MS;
}

function resolveRomaMeRefreshDelayMs(data: RomaMeResponse | null): number | null {
  const expiresAt = typeof data?.authz?.expiresAt === 'string' ? data.authz.expiresAt.trim() : '';
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return null;
  const refreshAtMs = expiresAtMs - ROMA_ME_PROACTIVE_REFRESH_LEAD_MS;
  return Math.max(ROMA_ME_PROACTIVE_REFRESH_MIN_DELAY_MS, refreshAtMs - Date.now());
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

async function loadRomaMeState(force: boolean, preserveCurrentOnError: boolean): Promise<UseRomaMeState> {
  const store = resolveRomaMeStore();
  const key = '__default__';
  const existingEntry = store.cache[key] ?? null;
  if (!force) {
    const cached = readRomaMeCache();
    if (cached) return cached;
  }

  const inFlight = store.inFlight[key];
  if (inFlight) return inFlight;

  store.inFlight[key] = fetchRomaMeState()
    .then((nextState) => {
      if (
        preserveCurrentOnError &&
        nextState.error &&
        existingEntry &&
        existingEntry.expiresAt > Date.now() &&
        isRomaMeAuthzStillValid(existingEntry.state.data)
      ) {
        return existingEntry.state;
      }
      return writeRomaMeCache(nextState);
    })
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

  const load = useCallback(
    async (args: { force: boolean; silent?: boolean; preserveCurrentOnError?: boolean }) => {
      const { force, silent = false, preserveCurrentOnError = false } = args;
      const cached = !force ? readRomaMeCache() : null;
      if (cached) {
        setState(cached);
        return;
      }

      if (!silent) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      const nextState = await loadRomaMeState(force, preserveCurrentOnError);
      setState(nextState);
    },
    [],
  );

  const reload = useCallback(async () => {
    await load({ force: true });
  }, [load]);

  useEffect(() => {
    void load({ force: false });
  }, [load]);

  useEffect(() => {
    const delayMs = resolveRomaMeRefreshDelayMs(state.data);
    if (!delayMs || state.loading || state.error) return;

    const timeout = window.setTimeout(() => {
      void load({
        force: true,
        silent: true,
        preserveCurrentOnError: true,
      });
    }, delayMs);
    return () => window.clearTimeout(timeout);
  }, [load, state.data, state.error, state.loading]);

  return {
    loading: state.loading,
    data: state.data,
    error: state.error,
    reload,
  };
}

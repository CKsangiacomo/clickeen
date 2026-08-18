'use client';

import { useCallback, useEffect, useState } from 'react';
import { isCompactAccountPublicId, isRecord, type AccountLocalePolicy } from '@clickeen/ck-contracts';
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
  accountPublicId: string;
  role: string;
  tier: string;
  websiteUrl: string | null;
  membershipVersion: string | null;
  lifecycleNotice?: RomaLifecycleNotice;
};

export type RomaActiveAccount = RomaAccountSummary & {
  status: string;
  activeLocales: string[];
  localePolicy: AccountLocalePolicy;
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
    givenName: string | null;
    familyName: string | null;
    primaryLanguage: string | null;
    usePrimaryLanguageForUi: boolean;
    country: string | null;
    timezone: string | null;
  } | null;
  activeAccount?: RomaActiveAccount | null;
  authz?: {
    accountId?: string | null;
    accountPublicId?: string | null;
    role?: string | null;
    profile?: string | null;
    authzVersion?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    entitlements?: {
      flags?: Record<string, boolean>;
      limits?: Record<string, number | null>;
    } | null;
  } | null;
};

export type ResolvedRomaContext = {
  accountId: string | null;
  accountPublicId: string | null;
  accountLabel: string | null;
};

export type RomaAuthzPolicy = {
    profile: 'free' | 'tier1' | 'tier2' | 'tier3' | 'tier4';
  role: 'viewer' | 'editor' | 'admin' | 'owner';
  flags: Record<string, boolean>;
  limits: Record<string, number | null>;
};

function normalizeAccountCoordinate(value: unknown): string | null {
  return isCompactAccountPublicId(value) ? value : null;
}

function normalizeAccountId(value: unknown): string | null {
  return normalizeAccountCoordinate(value);
}

function normalizeAccountPublicId(value: unknown): string | null {
  return normalizeAccountCoordinate(value);
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
    case 'tier4':
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
        profile,
    role,
    flags: { ...(entitlements.flags ?? {}) },
    limits: { ...(entitlements.limits ?? {}) },
  };
}

function assertRomaMeActiveAccountPayload(data: RomaMeResponse | null): void {
  const activeAccount = data?.activeAccount;
  if (!activeAccount || !isRecord(activeAccount)) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }

  const accountId = normalizeAccountId(activeAccount.accountId);
  const accountPublicId = normalizeAccountPublicId(activeAccount.accountPublicId);
  const role = normalizeRole(activeAccount.role);
  const profile = normalizeProfile(activeAccount.tier);
  const status = normalizeOptionalString(activeAccount.status);
  if (!accountId || !accountPublicId || !role || !profile || !status) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
}

function assertRomaMeAuthzPayload(data: RomaMeResponse | null): void {
  const authz = data?.authz;
  if (!authz) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }

  const accountId = normalizeAccountId(authz.accountId);
  const accountPublicId = normalizeAccountPublicId(authz.accountPublicId);
  const role = normalizeRole(authz.role);
  const profile = normalizeProfile(authz.profile);
  const authzVersion = typeof authz.authzVersion === 'string' ? authz.authzVersion.trim() : '';
  const issuedAt = typeof authz.issuedAt === 'string' ? authz.issuedAt.trim() : '';
  const expiresAt = typeof authz.expiresAt === 'string' ? authz.expiresAt.trim() : '';

  if (
    !accountId ||
    !accountPublicId ||
    accountId !== accountPublicId ||
    !role ||
    !profile ||
    !authzVersion ||
    !issuedAt ||
    !expiresAt
  ) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
  const issuedAtMs = Date.parse(issuedAt);
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
  if (
    issuedAtMs > Date.now() + ROMA_ME_AUTHZ_EXPIRY_SKEW_MS ||
    issuedAtMs >= expiresAtMs ||
    expiresAtMs <= Date.now() + ROMA_ME_AUTHZ_EXPIRY_SKEW_MS
  ) {
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
  const activeAccountPublicId = normalizeAccountPublicId(data?.activeAccount?.accountPublicId);
  const activeAccountRole = normalizeRole(data?.activeAccount?.role);
  const activeAccountProfile = normalizeProfile(data?.activeAccount?.tier);
  if (
    !activeAccountId ||
    activeAccountId !== accountId ||
    !activeAccountPublicId ||
    activeAccountPublicId !== accountPublicId ||
    activeAccountRole !== role ||
    activeAccountProfile !== profile
  ) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
}

export function resolveActiveRomaAccount(data: RomaMeResponse | null): RomaActiveAccount | null {
  const activeAccount = data?.activeAccount;
  if (!activeAccount) return null;
  const accountId = normalizeAccountId(activeAccount.accountId);
  const accountPublicId = normalizeAccountPublicId(activeAccount.accountPublicId);
  const role = normalizeOptionalString(activeAccount.role);
  const tier = normalizeOptionalString(activeAccount.tier);
  const status = normalizeOptionalString(activeAccount.status);
  if (!accountId || !accountPublicId || !role || !tier || !status) {
    return null;
  }
  return {
    accountId,
    accountPublicId,
    role,
    tier,
    websiteUrl: normalizeOptionalString(activeAccount.websiteUrl),
    membershipVersion: normalizeOptionalString(activeAccount.membershipVersion),
    lifecycleNotice: normalizeLifecycleNotice(activeAccount.lifecycleNotice),
    status,
    activeLocales: activeAccount.activeLocales as string[],
    localePolicy: activeAccount.localePolicy as AccountLocalePolicy,
  };
}

export function resolveActiveRomaContext(data: RomaMeResponse | null): ResolvedRomaContext {
  const activeAccount = resolveActiveRomaAccount(data);
  return {
    accountId: activeAccount?.accountId ?? null,
    accountPublicId: activeAccount?.accountPublicId ?? null,
    accountLabel: activeAccount?.accountPublicId ?? null,
  };
}

type UseRomaMeState = {
  loading: boolean;
  data: RomaMeResponse | null;
  error: string | null;
  transientError: boolean;
  revision: number;
};

class RomaMeLoadError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
  }
}

const ROMA_ME_ERROR_TTL_MS = 10_000;
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

function resolveRomaMeSafeUntilMs(data: RomaMeResponse | null): number {
  const expiresAt = typeof data?.authz?.expiresAt === 'string' ? data.authz.expiresAt.trim() : '';
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return 0;
  return expiresAtMs - ROMA_ME_AUTHZ_EXPIRY_SKEW_MS;
}

function resolveRomaMeSuccessTtlMs(data: RomaMeResponse | null): number {
  return Math.max(0, resolveRomaMeSafeUntilMs(data) - Date.now());
}

function isRomaMeAuthzStillValid(data: RomaMeResponse | null): boolean {
  return resolveRomaMeSafeUntilMs(data) > Date.now();
}

function resolveRomaMeRefreshDelayMs(data: RomaMeResponse | null): number | null {
  const expiresAt = typeof data?.authz?.expiresAt === 'string' ? data.authz.expiresAt.trim() : '';
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return null;
  const refreshAtMs = expiresAtMs - ROMA_ME_PROACTIVE_REFRESH_LEAD_MS;
  const safeUntilMs = resolveRomaMeSafeUntilMs(data);
  const safeRemainingMs = safeUntilMs - Date.now();
  if (safeRemainingMs <= 0) return null;
  return Math.min(
    Math.max(ROMA_ME_PROACTIVE_REFRESH_MIN_DELAY_MS, refreshAtMs - Date.now()),
    safeRemainingMs,
  );
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
  let cachedState = state;
  const now = Date.now();
  let expiresAt = now + ROMA_ME_ERROR_TTL_MS;
  if (!state.error) {
    const safeUntilMs = resolveRomaMeSafeUntilMs(state.data);
    if (safeUntilMs <= now) {
      cachedState = {
        ...state,
        data: null,
        error: 'coreui.errors.auth.contextUnavailable',
        transientError: false,
      };
    } else {
      expiresAt = safeUntilMs;
    }
  }
  const key = '__default__';
  store.cache[key] = {
    state: cachedState,
    expiresAt,
  };
  return cachedState;
}

async function fetchRomaMeState(): Promise<UseRomaMeState> {
  try {
    const response = await fetch('/api/bootstrap', { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as RomaMeResponse | { error?: unknown } | null;
    const authErrorReason = (payload as any)?.error?.reasonKey || (payload as any)?.error;
    if (response.ok && authErrorReason) {
      throw new RomaMeLoadError(
        typeof authErrorReason === 'string' ? authErrorReason : 'coreui.errors.auth.required',
        false,
      );
    }
    if (!response.ok) {
      const reason = (payload as any)?.error?.reasonKey || (payload as any)?.error || `HTTP_${response.status}`;
      const normalizedReason = typeof reason === 'string' ? reason : 'coreui.errors.auth.required';
      throw new RomaMeLoadError(
        normalizedReason,
        response.status >= 500 &&
          normalizedReason !== 'coreui.errors.auth.required' &&
          normalizedReason !== 'coreui.errors.auth.forbidden',
      );
    }
    assertRomaMeAuthzPayload(payload as RomaMeResponse | null);

    return {
      loading: false,
      data: payload as RomaMeResponse,
      error: null,
      transientError: false,
      revision: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      loading: false,
      data: null,
      error: message,
      transientError: error instanceof RomaMeLoadError ? error.transient : error instanceof TypeError,
      revision: 0,
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

  let request = store.inFlight[key];
  while (request && force && !preserveCurrentOnError) {
    await request;
    request = store.inFlight[key];
  }
  if (!request) {
    request = fetchRomaMeState().finally(() => {
      const currentStore = resolveRomaMeStore();
      if (currentStore.inFlight[key] === request) delete currentStore.inFlight[key];
    });
    store.inFlight[key] = request;
  }

  const nextState = await request;
  if (
    preserveCurrentOnError &&
    nextState.error &&
    nextState.transientError &&
    existingEntry &&
    store.cache[key] === existingEntry &&
    existingEntry.expiresAt - Date.now() > ROMA_ME_PROACTIVE_REFRESH_MIN_DELAY_MS &&
    isRomaMeAuthzStillValid(existingEntry.state.data)
  ) {
    const preservedState = {
      ...existingEntry.state,
      revision: existingEntry.state.revision + 1,
    };
    store.cache[key] = {
      ...existingEntry,
      state: preservedState,
    };
    return preservedState;
  }
  return writeRomaMeCache(nextState);
}

export function useRomaMe() {
  const [state, setState] = useState<UseRomaMeState>({
    loading: true,
    data: null,
    error: null,
    transientError: false,
    revision: 0,
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
  }, [load, state.data, state.error, state.loading, state.revision]);

  useEffect(() => {
    const ttlMs = resolveRomaMeSuccessTtlMs(state.data);
    if (!state.data) return;

    const expire = () => {
      setState((current) =>
        current.data === state.data
          ? {
              ...current,
              loading: true,
              data: null,
              error: null,
              transientError: false,
            }
          : current,
      );
    };
    if (ttlMs <= 0) {
      expire();
      return;
    }

    const timeout = window.setTimeout(expire, ttlMs);
    return () => window.clearTimeout(timeout);
  }, [state.data]);

  const dataStillValid = !state.data || isRomaMeAuthzStillValid(state.data);
  return {
    loading: state.loading || !dataStillValid,
    data: dataStillValid ? state.data : null,
    error: dataStillValid ? state.error : 'coreui.errors.auth.contextUnavailable',
    reload,
  };
}

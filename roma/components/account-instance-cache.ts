'use client';

import { fetchSameOriginJson } from './same-origin-json';

const ACCOUNT_INSTANCE_CACHE_TTL_MS = 2 * 60_000;
const ACCOUNT_INSTANCE_STORE_KEY = '__CK_ROMA_ACCOUNT_INSTANCE_STORE_V1__';

export type AccountInstancePayload = {
  publicId?: string;
  displayName?: string;
  ownerAccountId?: string;
  widgetType?: string;
  config?: unknown;
  enforcement?: unknown;
  status?: unknown;
  meta?: unknown;
};

export type AccountInstanceLocalizationPayload = {
  localization?: unknown;
};

type AccountInstanceCacheEntry = {
  payload: AccountInstancePayload;
  expiresAt: number;
};

type AccountInstanceLocalizationCacheEntry = {
  payload: AccountInstanceLocalizationPayload;
  expiresAt: number;
};

type AccountInstanceStore = {
  cache: Record<string, AccountInstanceCacheEntry | undefined>;
  inFlight: Record<string, Promise<AccountInstancePayload> | undefined>;
  localizationCache: Record<string, AccountInstanceLocalizationCacheEntry | undefined>;
  localizationInFlight: Record<string, Promise<AccountInstanceLocalizationPayload> | undefined>;
};

function normalizeEntityId(value: unknown): string {
  return String(value || '').trim();
}

function toAccountInstanceCacheKey(accountId: string, publicId: string): string {
  return `${accountId}:${publicId}`;
}

function isAccountInstanceStore(value: unknown): value is AccountInstanceStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!record.cache || typeof record.cache !== 'object' || Array.isArray(record.cache)) return false;
  if (!record.inFlight || typeof record.inFlight !== 'object' || Array.isArray(record.inFlight)) return false;
  if (!record.localizationCache || typeof record.localizationCache !== 'object' || Array.isArray(record.localizationCache))
    return false;
  if (
    !record.localizationInFlight ||
    typeof record.localizationInFlight !== 'object' ||
    Array.isArray(record.localizationInFlight)
  )
    return false;
  return true;
}

function resolveAccountInstanceStore(): AccountInstanceStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[ACCOUNT_INSTANCE_STORE_KEY];
  if (isAccountInstanceStore(existing)) return existing;
  const next: AccountInstanceStore = { cache: {}, inFlight: {}, localizationCache: {}, localizationInFlight: {} };
  scope[ACCOUNT_INSTANCE_STORE_KEY] = next;
  return next;
}

export function primeAccountInstanceCache(accountId: string, publicId: string, payload: AccountInstancePayload): void {
  const normalizedAccountId = normalizeEntityId(accountId);
  const normalizedPublicId = normalizeEntityId(publicId);
  if (!normalizedAccountId || !normalizedPublicId) return;
  if (!isAccountInstancePayload(payload)) return;
  const store = resolveAccountInstanceStore();
  const key = toAccountInstanceCacheKey(normalizedAccountId, normalizedPublicId);
  store.cache[key] = {
    payload,
    expiresAt: Date.now() + ACCOUNT_INSTANCE_CACHE_TTL_MS,
  };
}

export function invalidateAccountInstanceCache(accountId: string, publicId: string): void {
  const normalizedAccountId = normalizeEntityId(accountId);
  const normalizedPublicId = normalizeEntityId(publicId);
  if (!normalizedAccountId || !normalizedPublicId) return;
  const store = resolveAccountInstanceStore();
  const key = toAccountInstanceCacheKey(normalizedAccountId, normalizedPublicId);
  delete store.cache[key];
  delete store.inFlight[key];
  delete store.localizationCache[key];
  delete store.localizationInFlight[key];
}

function isAccountInstancePayload(value: unknown): value is AccountInstancePayload {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAccountInstanceLocalizationPayload(value: unknown): value is AccountInstanceLocalizationPayload {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function getAccountInstance(args: {
  accountId: string;
  publicId: string;
  force?: boolean;
  authzCapsule?: string | null;
}): Promise<{ payload: AccountInstancePayload; source: 'cache' | 'network' }> {
  const accountId = normalizeEntityId(args.accountId);
  const publicId = normalizeEntityId(args.publicId);
  if (!accountId) throw new Error('coreui.errors.accountId.invalid');
  if (!publicId) throw new Error('coreui.errors.publicId.invalid');

  const force = args.force === true;
  const key = toAccountInstanceCacheKey(accountId, publicId);
  const store = resolveAccountInstanceStore();

  if (force) {
    delete store.cache[key];
  } else {
    const cached = store.cache[key];
    if (cached && cached.expiresAt > Date.now()) {
      return { payload: cached.payload, source: 'cache' };
    }
    if (cached) {
      delete store.cache[key];
    }
  }

  const inFlight = store.inFlight[key];
  if (inFlight) {
    const payload = await inFlight;
    return { payload, source: 'network' };
  }

  store.inFlight[key] = fetchSameOriginJson<AccountInstancePayload>(
    `/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
    args.authzCapsule
      ? {
          headers: {
            'x-ck-authz-capsule': args.authzCapsule,
          },
        }
      : undefined,
  )
    .then((payload) => {
      if (!isAccountInstancePayload(payload)) {
        throw new Error('coreui.errors.instance.invalidPayload');
      }
      store.cache[key] = {
        payload,
        expiresAt: Date.now() + ACCOUNT_INSTANCE_CACHE_TTL_MS,
      };
      return payload;
    })
    .finally(() => {
      delete resolveAccountInstanceStore().inFlight[key];
    });

  const payload = await store.inFlight[key];
  return { payload, source: 'network' };
}

export async function getAccountInstanceLocalization(args: {
  accountId: string;
  publicId: string;
  force?: boolean;
  authzCapsule?: string | null;
}): Promise<{ payload: AccountInstanceLocalizationPayload; source: 'cache' | 'network' }> {
  const accountId = normalizeEntityId(args.accountId);
  const publicId = normalizeEntityId(args.publicId);
  if (!accountId) throw new Error('coreui.errors.accountId.invalid');
  if (!publicId) throw new Error('coreui.errors.publicId.invalid');

  const force = args.force === true;
  const key = toAccountInstanceCacheKey(accountId, publicId);
  const store = resolveAccountInstanceStore();

  if (force) {
    delete store.localizationCache[key];
  } else {
    const cached = store.localizationCache[key];
    if (cached && cached.expiresAt > Date.now()) {
      return { payload: cached.payload, source: 'cache' };
    }
    if (cached) {
      delete store.localizationCache[key];
    }
  }

  const inFlight = store.localizationInFlight[key];
  if (inFlight) {
    const payload = await inFlight;
    return { payload, source: 'network' };
  }

  store.localizationInFlight[key] = fetchSameOriginJson<AccountInstanceLocalizationPayload>(
    `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/localization?subject=account`,
    args.authzCapsule
      ? {
          headers: {
            'x-ck-authz-capsule': args.authzCapsule,
          },
        }
      : undefined,
  )
    .then((payload) => {
      if (!isAccountInstanceLocalizationPayload(payload)) {
        throw new Error('coreui.errors.instance.localizationMissing');
      }
      store.localizationCache[key] = {
        payload,
        expiresAt: Date.now() + ACCOUNT_INSTANCE_CACHE_TTL_MS,
      };
      return payload;
    })
    .finally(() => {
      delete resolveAccountInstanceStore().localizationInFlight[key];
    });

  const payload = await store.localizationInFlight[key];
  return { payload, source: 'network' };
}

export async function prefetchAccountInstance(
  accountId: string,
  publicId: string,
  authzCapsule?: string | null,
): Promise<void> {
  try {
    await Promise.all([
      getAccountInstance({ accountId, publicId, authzCapsule }),
      getAccountInstanceLocalization({ accountId, publicId, authzCapsule }),
    ]);
  } catch {
    // Prefetch is best-effort. Interactive flows still fetch on demand.
  }
}

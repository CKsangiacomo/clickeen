'use client';

import { fetchParisJson } from './paris-http';

const ACCOUNT_INSTANCE_CACHE_TTL_MS = 2 * 60_000;
const ACCOUNT_INSTANCE_STORE_KEY = '__CK_ROMA_ACCOUNT_INSTANCE_STORE_V1__';

export type AccountInstancePayload = {
  publicId?: string;
  displayName?: string;
  ownerAccountId?: string;
  widgetType?: string;
  config?: unknown;
  policy?: unknown;
  enforcement?: unknown;
  localization?: unknown;
};

type AccountInstanceCacheEntry = {
  payload: AccountInstancePayload;
  expiresAt: number;
};

type AccountInstanceStore = {
  cache: Record<string, AccountInstanceCacheEntry | undefined>;
  inFlight: Record<string, Promise<AccountInstancePayload> | undefined>;
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
  return true;
}

function resolveAccountInstanceStore(): AccountInstanceStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[ACCOUNT_INSTANCE_STORE_KEY];
  if (isAccountInstanceStore(existing)) return existing;
  const next: AccountInstanceStore = { cache: {}, inFlight: {} };
  scope[ACCOUNT_INSTANCE_STORE_KEY] = next;
  return next;
}

function isAccountInstancePayload(value: unknown): value is AccountInstancePayload {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function getAccountInstance(args: {
  accountId: string;
  publicId: string;
  force?: boolean;
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

  store.inFlight[key] = fetchParisJson<AccountInstancePayload>(
    `/api/paris/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
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

export async function prefetchAccountInstance(accountId: string, publicId: string): Promise<void> {
  try {
    await getAccountInstance({ accountId, publicId });
  } catch {
    // Prefetch is best-effort. Interactive flows still fetch on demand.
  }
}


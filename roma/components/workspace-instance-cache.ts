'use client';

import { fetchParisJson } from './paris-http';

const WORKSPACE_INSTANCE_CACHE_TTL_MS = 2 * 60_000;
const WORKSPACE_INSTANCE_STORE_KEY = '__CK_ROMA_WORKSPACE_INSTANCE_STORE_V1__';

export type WorkspaceInstancePayload = {
  publicId?: string;
  displayName?: string;
  ownerAccountId?: string;
  widgetType?: string;
  config?: unknown;
  policy?: unknown;
  enforcement?: unknown;
  localization?: {
    workspaceLocales?: string[];
    invalidWorkspaceLocales?: string | null;
    localeOverlays?: Array<{
      locale?: string;
      source?: string | null;
      baseFingerprint?: string | null;
      baseUpdatedAt?: string | null;
      hasUserOps?: boolean;
      baseOps?: Array<{ op?: string; path?: string; value?: string }>;
      userOps?: Array<{ op?: string; path?: string; value?: string }>;
    }>;
  };
};

type WorkspaceInstanceCacheEntry = {
  payload: WorkspaceInstancePayload;
  expiresAt: number;
};

type WorkspaceInstanceStore = {
  cache: Record<string, WorkspaceInstanceCacheEntry | undefined>;
  inFlight: Record<string, Promise<WorkspaceInstancePayload> | undefined>;
};

function normalizeEntityId(value: unknown): string {
  return String(value || '').trim();
}

function toWorkspaceInstanceCacheKey(workspaceId: string, publicId: string): string {
  return `${workspaceId}:${publicId}`;
}

function isWorkspaceInstanceStore(value: unknown): value is WorkspaceInstanceStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!record.cache || typeof record.cache !== 'object' || Array.isArray(record.cache)) return false;
  if (!record.inFlight || typeof record.inFlight !== 'object' || Array.isArray(record.inFlight)) return false;
  return true;
}

function resolveWorkspaceInstanceStore(): WorkspaceInstanceStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[WORKSPACE_INSTANCE_STORE_KEY];
  if (isWorkspaceInstanceStore(existing)) return existing;
  const next: WorkspaceInstanceStore = { cache: {}, inFlight: {} };
  scope[WORKSPACE_INSTANCE_STORE_KEY] = next;
  return next;
}

function isWorkspaceInstancePayload(value: unknown): value is WorkspaceInstancePayload {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function getWorkspaceInstance(args: {
  workspaceId: string;
  publicId: string;
  force?: boolean;
}): Promise<{ payload: WorkspaceInstancePayload; source: 'cache' | 'network' }> {
  const workspaceId = normalizeEntityId(args.workspaceId);
  const publicId = normalizeEntityId(args.publicId);
  if (!workspaceId) throw new Error('coreui.errors.workspaceId.invalid');
  if (!publicId) throw new Error('coreui.errors.publicId.invalid');

  const force = args.force === true;
  const key = toWorkspaceInstanceCacheKey(workspaceId, publicId);
  const store = resolveWorkspaceInstanceStore();

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

  store.inFlight[key] = fetchParisJson<WorkspaceInstancePayload>(
    `/api/paris/instance/${encodeURIComponent(publicId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
  )
    .then((payload) => {
      if (!isWorkspaceInstancePayload(payload)) {
        throw new Error('coreui.errors.instance.invalidPayload');
      }
      store.cache[key] = {
        payload,
        expiresAt: Date.now() + WORKSPACE_INSTANCE_CACHE_TTL_MS,
      };
      return payload;
    })
    .finally(() => {
      delete resolveWorkspaceInstanceStore().inFlight[key];
    });

  const payload = await store.inFlight[key];
  return { payload, source: 'network' };
}

export async function prefetchWorkspaceInstance(workspaceId: string, publicId: string): Promise<void> {
  try {
    await getWorkspaceInstance({ workspaceId, publicId });
  } catch {
    // Prefetch is best-effort. Interactive flows still fetch on demand.
  }
}

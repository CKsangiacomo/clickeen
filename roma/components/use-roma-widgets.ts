'use client';

export type WidgetInstance = {
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  status: 'published' | 'unpublished';
  publishedAt: string | null;
  updatedAt: string;
};

export type WidgetCatalogOption = {
  widgetType: string;
  displayName: string;
  description: string;
};

export type RomaWidgetsResponse = {
  accountId: string;
  catalog: WidgetCatalogOption[];
  instances: WidgetInstance[];
};

export type RomaWidgetsCacheEntry = {
  data: RomaWidgetsResponse;
  fetchedAt: number;
};

type RomaWidgetsFetchJson = <T = unknown>(url: string, init?: RequestInit & { timeoutMs?: number }) => Promise<T>;

const ROMA_WIDGETS_CACHE_TTL_MS = 5 * 60 * 1000;
const romaWidgetsCache = new Map<string, RomaWidgetsCacheEntry>();
const romaWidgetsInflight = new Map<string, Promise<RomaWidgetsResponse>>();
const romaWidgetsRequestSeq = new Map<string, number>();

export function readRomaWidgetsCache(accountId: string): RomaWidgetsCacheEntry | null {
  return romaWidgetsCache.get(accountId) ?? null;
}

export function isRomaWidgetsCacheFresh(entry: RomaWidgetsCacheEntry | null): boolean {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < ROMA_WIDGETS_CACHE_TTL_MS;
}

export function writeRomaWidgetsCache(data: RomaWidgetsResponse): RomaWidgetsCacheEntry {
  const entry = {
    data,
    fetchedAt: Date.now(),
  };
  romaWidgetsCache.set(data.accountId, entry);
  return entry;
}

export function updateRomaWidgetsCache(
  accountId: string,
  updater: (current: RomaWidgetsResponse) => RomaWidgetsResponse,
): RomaWidgetsCacheEntry | null {
  const current = readRomaWidgetsCache(accountId);
  if (!current) return null;
  return writeRomaWidgetsCache(updater(current.data));
}

export function invalidateRomaWidgetsCache(accountId: string): void {
  romaWidgetsCache.delete(accountId);
}

export function upsertRomaWidgetInstanceCache(
  accountId: string,
  instance: WidgetInstance,
): RomaWidgetsCacheEntry | null {
  return updateRomaWidgetsCache(accountId, (current) => {
    const existingIndex = current.instances.findIndex(
      (entry) => entry.instanceId === instance.instanceId,
    );
    const instances = existingIndex >= 0
      ? current.instances.map((entry) =>
          entry.instanceId === instance.instanceId ? instance : entry)
      : [instance, ...current.instances];
    return { ...current, instances };
  });
}

export async function loadRomaWidgetsForAccount(args: {
  accountId: string;
  fetchJson: RomaWidgetsFetchJson;
  force?: boolean;
}): Promise<RomaWidgetsResponse> {
  const accountId = args.accountId;

  const cached = readRomaWidgetsCache(accountId);
  if (!args.force && cached && isRomaWidgetsCacheFresh(cached)) {
    return cached.data;
  }

  const inFlightKey = accountId;
  const existing = romaWidgetsInflight.get(inFlightKey);
  if (!args.force && existing) return existing;

  const requestSeq = (romaWidgetsRequestSeq.get(inFlightKey) ?? 0) + 1;
  romaWidgetsRequestSeq.set(inFlightKey, requestSeq);
  const request = args.fetchJson<RomaWidgetsResponse>('/api/account/widgets', { method: 'GET' }).then((payload) => {
    if (romaWidgetsRequestSeq.get(inFlightKey) === requestSeq) {
      writeRomaWidgetsCache(payload);
      return payload;
    }
    return readRomaWidgetsCache(accountId)?.data ?? payload;
  });

  romaWidgetsInflight.set(inFlightKey, request);
  try {
    return await request;
  } finally {
    if (romaWidgetsInflight.get(inFlightKey) === request) {
      romaWidgetsInflight.delete(inFlightKey);
    }
  }
}

export function buildBuilderRoute(args: {
  instanceId: string;
}): string {
  return `/builder/${encodeURIComponent(args.instanceId)}`;
}

export function buildNewBuilderRoute(widgetType: string): string {
  return `/builder/new/${encodeURIComponent(widgetType)}`;
}

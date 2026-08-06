'use client';

export type WidgetInstance = {
  instanceId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
  updatedAt: string;
};

export type WidgetCatalogOption = {
  widgetType: string;
  displayName: string;
  description: string;
};

type RawWidgetInstance = {
  instanceId?: string | null;
  widgetType?: string | null;
  displayName?: string | null;
  status?: string | null;
  updatedAt?: string | null;
};

type RawWidgetCatalogOption = {
  widgetType?: string | null;
  displayName?: string | null;
  description?: string | null;
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

export const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';
const ROMA_WIDGETS_CACHE_TTL_MS = 5 * 60 * 1000;
const romaWidgetsCache = new Map<string, RomaWidgetsCacheEntry>();
const romaWidgetsInflight = new Map<string, Promise<RomaWidgetsResponse>>();
const romaWidgetsRequestSeq = new Map<string, number>();
const RETIRED_WIDGETS_PAYLOAD_FIELDS = [
  'systemWidgets',
  'canCreate',
  'disabledReasonKey',
  'account',
] as const;

export function normalizeWidgetType(value: string | null | undefined): string | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized || null;
}

export function normalizeWidgetInstance(raw: RawWidgetInstance): WidgetInstance | null {
  const instanceId = String(raw.instanceId || '').trim();
  if (!instanceId) return null;

  const widgetType = normalizeWidgetType(raw.widgetType);
  if (!widgetType) return null;
  const displayName = typeof raw.displayName === 'string' ? raw.displayName.trim() : '';
  if (raw.status !== 'published' && raw.status !== 'unpublished') return null;
  const status = raw.status;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt.trim() : '';
  if (!updatedAt) return null;

  return {
    instanceId,
    widgetType,
    displayName,
    status,
    updatedAt,
  };
}

export function normalizeWidgetCatalogOption(raw: RawWidgetCatalogOption): WidgetCatalogOption | null {
  const widgetType = normalizeWidgetType(raw.widgetType);
  if (!widgetType) return null;
  const displayName = typeof raw.displayName === 'string' ? raw.displayName.trim() : '';
  if (!displayName) return null;
  const description = String(raw.description || '').trim();
  return {
    widgetType,
    displayName,
    description,
  };
}

export function normalizeRomaWidgetsResponse(raw: unknown): RomaWidgetsResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const accountId = typeof record.accountId === 'string' ? record.accountId.trim() : '';
  if (!accountId) return null;

  if (
    RETIRED_WIDGETS_PAYLOAD_FIELDS.some((field) => field in record) ||
    !Array.isArray(record.instances) ||
    !Array.isArray(record.catalog)
  ) {
    return null;
  }
  const instances = record.instances.map((item) => normalizeWidgetInstance((item || {}) as RawWidgetInstance));
  const catalog = record.catalog.map((item) => normalizeWidgetCatalogOption((item || {}) as RawWidgetCatalogOption));
  if (
    instances.some((item): item is null => item === null) ||
    catalog.some((item): item is null => item === null)
  ) {
    return null;
  }

  return {
    accountId,
    catalog: catalog as WidgetCatalogOption[],
    instances: instances as WidgetInstance[],
  };
}

export function readRomaWidgetsCache(accountId: string): RomaWidgetsCacheEntry | null {
  const normalizedAccountId = String(accountId || '').trim();
  if (!normalizedAccountId) return null;
  return romaWidgetsCache.get(normalizedAccountId) ?? null;
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

export async function loadRomaWidgetsForAccount(args: {
  accountId: string;
  fetchJson: RomaWidgetsFetchJson;
  force?: boolean;
}): Promise<RomaWidgetsResponse> {
  const accountId = String(args.accountId || '').trim();
  if (!accountId) throw new Error('coreui.errors.auth.contextUnavailable');

  const cached = readRomaWidgetsCache(accountId);
  if (!args.force && cached && isRomaWidgetsCacheFresh(cached)) {
    return cached.data;
  }

  const inFlightKey = accountId;
  const existing = romaWidgetsInflight.get(inFlightKey);
  if (!args.force && existing) return existing;

  const requestSeq = (romaWidgetsRequestSeq.get(inFlightKey) ?? 0) + 1;
  romaWidgetsRequestSeq.set(inFlightKey, requestSeq);
  const request = args.fetchJson<unknown>('/api/account/widgets', { method: 'GET' }).then((payload) => {
    const normalized = normalizeRomaWidgetsResponse(payload);
    if (!normalized || normalized.accountId !== accountId) {
      throw new Error('coreui.errors.payload.invalid');
    }
    if (romaWidgetsRequestSeq.get(inFlightKey) === requestSeq) {
      writeRomaWidgetsCache(normalized);
      return normalized;
    }
    return readRomaWidgetsCache(accountId)?.data ?? normalized;
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
  widgetType?: string | null;
}): string {
  return `/builder/${encodeURIComponent(args.instanceId)}`;
}

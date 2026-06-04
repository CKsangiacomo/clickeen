'use client';

export type WidgetInstance = {
  instanceId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
  actions: {
    edit: boolean;
    duplicate: boolean;
    delete: boolean;
    rename: boolean;
    publish: boolean;
    unpublish: boolean;
  };
};

export type WidgetCatalogOption = {
  widgetType: string;
  label: string;
  description: string;
  canCreate: boolean;
  disabledReasonKey: string | null;
};

type RawWidgetInstance = {
  instanceId?: string | null;
  widgetType?: string | null;
  displayName?: string | null;
  status?: string | null;
  actions?: {
    edit?: boolean | null;
    duplicate?: boolean | null;
    delete?: boolean | null;
    rename?: boolean | null;
    publish?: boolean | null;
    unpublish?: boolean | null;
  } | null;
};

type RawWidgetCatalogOption = {
  widgetType?: string | null;
  label?: string | null;
  description?: string | null;
  canCreate?: boolean | null;
  disabledReasonKey?: string | null;
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

export function normalizeWidgetType(value: string | null | undefined): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized || 'unknown';
}

export function normalizeWidgetInstance(raw: RawWidgetInstance): WidgetInstance | null {
  const instanceId = String(raw.instanceId || '').trim();
  if (!instanceId) return null;

  const widgetType = normalizeWidgetType(raw.widgetType);
  const displayName = String(raw.displayName || '').trim() || DEFAULT_INSTANCE_DISPLAY_NAME;
  const status = raw.status === 'published' ? 'published' : 'unpublished';
  const actions = raw.actions && typeof raw.actions === 'object' ? raw.actions : null;

  return {
    instanceId,
    widgetType,
    displayName,
    status,
    actions: {
      edit: actions?.edit !== false,
      duplicate: actions?.duplicate !== false,
      delete: actions?.delete !== false,
      rename: actions?.rename !== false,
      publish: actions?.publish === true,
      unpublish: actions?.unpublish === true,
    },
  };
}

export function normalizeWidgetCatalogOption(raw: RawWidgetCatalogOption): WidgetCatalogOption | null {
  const widgetType = normalizeWidgetType(raw.widgetType);
  if (widgetType === 'unknown') return null;
  const label = String(raw.label || '').trim() || widgetType;
  const description = String(raw.description || '').trim();
  const disabledReasonKey = typeof raw.disabledReasonKey === 'string' && raw.disabledReasonKey.trim()
    ? raw.disabledReasonKey.trim()
    : null;
  return {
    widgetType,
    label,
    description,
    canCreate: raw.canCreate === true,
    disabledReasonKey,
  };
}

export function normalizeRomaWidgetsResponse(raw: unknown): RomaWidgetsResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const account = record.account;
  const accountId =
    account && typeof account === 'object' && !Array.isArray(account) && typeof (account as any).accountId === 'string'
      ? String((account as any).accountId).trim()
      : typeof record.accountId === 'string'
        ? record.accountId.trim()
        : '';
  if (!accountId) return null;

  const instances = Array.isArray(record.instances)
    ? record.instances
        .map((item) => normalizeWidgetInstance((item || {}) as RawWidgetInstance))
        .filter((item): item is WidgetInstance => Boolean(item))
    : [];
  const catalog = Array.isArray(record.catalog)
    ? record.catalog
        .map((item) => normalizeWidgetCatalogOption((item || {}) as RawWidgetCatalogOption))
        .filter((item): item is WidgetCatalogOption => Boolean(item))
    : [];

  return {
    accountId,
    catalog,
    instances,
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

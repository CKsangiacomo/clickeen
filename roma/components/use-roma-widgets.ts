'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchParisJson } from './paris-http';

export type WidgetInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
  workspaceId: string | null;
  source: 'workspace' | 'curated';
  actions: {
    edit: boolean;
    duplicate: boolean;
    delete: boolean;
  };
};

export type RomaWidgetsPayload = {
  account?: {
    accountId?: string | null;
  };
  widgetTypes?: string[];
  instances?: Array<{
    publicId?: string | null;
    widgetType?: string | null;
    displayName?: string | null;
    workspaceId?: string | null;
    source?: string | null;
    actions?: {
      edit?: boolean | null;
      duplicate?: boolean | null;
      delete?: boolean | null;
    } | null;
  }>;
};

export const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';
const ROMA_WIDGETS_CACHE_TTL_MS = 2 * 60_000;
const ROMA_WIDGETS_STORE_KEY = '__CK_ROMA_WIDGETS_STORE_V1__';

type RomaWidgetsCacheEntry = {
  payload: RomaWidgetsPayload;
  expiresAt: number;
};

type RomaWidgetsStore = {
  cache: Record<string, RomaWidgetsCacheEntry | undefined>;
  inFlight: Record<string, Promise<RomaWidgetsPayload> | undefined>;
};

function isRomaWidgetsStore(value: unknown): value is RomaWidgetsStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!record.cache || typeof record.cache !== 'object' || Array.isArray(record.cache)) return false;
  if (!record.inFlight || typeof record.inFlight !== 'object' || Array.isArray(record.inFlight)) return false;
  return true;
}

function resolveRomaWidgetsStore(): RomaWidgetsStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[ROMA_WIDGETS_STORE_KEY];
  if (isRomaWidgetsStore(existing)) return existing;
  const next: RomaWidgetsStore = { cache: {}, inFlight: {} };
  scope[ROMA_WIDGETS_STORE_KEY] = next;
  return next;
}

function readCachedRomaWidgets(workspaceId: string): RomaWidgetsPayload | null {
  const store = resolveRomaWidgetsStore();
  const key = workspaceId;
  const entry = store.cache[key] ?? null;
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    delete store.cache[key];
    return null;
  }
  return entry.payload;
}

function writeCachedRomaWidgets(workspaceId: string, payload: RomaWidgetsPayload): RomaWidgetsPayload {
  const store = resolveRomaWidgetsStore();
  store.cache[workspaceId] = {
    payload,
    expiresAt: Date.now() + ROMA_WIDGETS_CACHE_TTL_MS,
  };
  return payload;
}

async function loadRomaWidgetsPayload(workspaceId: string, force: boolean): Promise<RomaWidgetsPayload> {
  const store = resolveRomaWidgetsStore();
  const key = workspaceId;
  if (!force) {
    const cached = readCachedRomaWidgets(workspaceId);
    if (cached) return cached;
  } else {
    delete store.cache[key];
  }

  const inFlight = store.inFlight[key];
  if (inFlight) return inFlight;

  store.inFlight[key] = fetchParisJson<RomaWidgetsPayload>(
    `/api/paris/roma/widgets?workspaceId=${encodeURIComponent(workspaceId)}`,
  )
    .then((payload) => writeCachedRomaWidgets(workspaceId, payload))
    .finally(() => {
      delete resolveRomaWidgetsStore().inFlight[key];
    });
  return store.inFlight[key] as Promise<RomaWidgetsPayload>;
}

export function createUserInstancePublicId(widgetType: string): string {
  const normalized = widgetType
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const stem = normalized || 'instance';
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `wgt_${stem}_u_${suffix}`;
}

export function buildBuilderRoute(args: {
  publicId: string;
  workspaceId: string;
  accountId: string;
  widgetType?: string | null;
}): string {
  const search = new URLSearchParams({
    workspaceId: args.workspaceId,
    publicId: args.publicId,
    subject: 'workspace',
  });
  if (args.accountId) {
    search.set('accountId', args.accountId);
  }
  const normalizedWidgetType = normalizeWidgetType(args.widgetType);
  if (normalizedWidgetType !== 'unknown') {
    search.set('widgetType', normalizedWidgetType);
  }
  return `/builder/${encodeURIComponent(args.publicId)}?${search.toString()}`;
}

export function normalizeWidgetType(value: string | null | undefined): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized || 'unknown';
}

function normalizeWidgetInstance(raw: {
  publicId?: string | null;
  widgetType?: string | null;
  displayName?: string | null;
  workspaceId?: string | null;
  source?: string | null;
  actions?: {
    edit?: boolean | null;
    duplicate?: boolean | null;
    delete?: boolean | null;
  } | null;
}): WidgetInstance | null {
  const publicId = String(raw.publicId || '').trim();
  if (!publicId) return null;

  const widgetType = normalizeWidgetType(raw.widgetType);
  const displayName = String(raw.displayName || '').trim() || DEFAULT_INSTANCE_DISPLAY_NAME;
  const workspaceId = String(raw.workspaceId || '').trim() || null;
  const source = raw.source === 'curated' ? 'curated' : 'workspace';
  const actions = raw.actions && typeof raw.actions === 'object' ? raw.actions : null;

  return {
    publicId,
    widgetType,
    displayName,
    workspaceId,
    source,
    actions: {
      edit: actions?.edit !== false,
      duplicate: actions?.duplicate !== false,
      delete: actions?.delete !== false,
    },
  };
}

export function useRomaWidgets(workspaceId: string) {
  const [widgetInstances, setWidgetInstances] = useState<WidgetInstance[]>([]);
  const [widgetTypes, setWidgetTypes] = useState<string[]>([]);
  const [accountIdFromApi, setAccountIdFromApi] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const applyPayload = useCallback((payload: RomaWidgetsPayload) => {
    const instances = Array.isArray(payload.instances)
      ? payload.instances
          .map((item) => normalizeWidgetInstance(item))
          .filter((item): item is WidgetInstance => Boolean(item))
      : [];
    setWidgetInstances(instances);

    const types = Array.isArray(payload.widgetTypes)
      ? Array.from(
          new Set(
            payload.widgetTypes
              .map((item) => normalizeWidgetType(item))
              .filter((item) => item !== 'unknown'),
          ),
        )
      : [];
    setWidgetTypes(types);

    const apiAccountId = typeof payload.account?.accountId === 'string' ? payload.account.accountId.trim() : '';
    setAccountIdFromApi(apiAccountId);
  }, []);

  const loadWidgetsData = useCallback(async (force = false) => {
    if (!workspaceId) {
      setWidgetInstances([]);
      setWidgetTypes([]);
      setAccountIdFromApi('');
      setDataError(null);
      return;
    }

    setLoading(true);
    setDataError(null);
    try {
      const payload = await loadRomaWidgetsPayload(workspaceId, force);
      applyPayload(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDataError(message);
      setWidgetInstances([]);
      setWidgetTypes([]);
      setAccountIdFromApi('');
    } finally {
      setLoading(false);
    }
  }, [applyPayload, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    void loadWidgetsData(false);
  }, [loadWidgetsData, workspaceId]);

  return {
    widgetInstances,
    widgetTypes,
    accountIdFromApi,
    loading,
    dataError,
    loadWidgetsData,
  };
}

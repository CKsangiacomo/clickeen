'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { DEFAULT_INSTANCE_DISPLAY_NAME, normalizeWidgetType } from './use-roma-widgets';

export type TemplateInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
};

type RomaTemplatesPayload = {
  account?: {
    accountId?: string | null;
  };
  widgetTypes?: string[];
  instances?: Array<{
    publicId?: string | null;
    widgetType?: string | null;
    displayName?: string | null;
  }>;
};

const ROMA_TEMPLATES_CACHE_TTL_MS = 2 * 60_000;
const ROMA_TEMPLATES_STORE_KEY = '__CK_ROMA_TEMPLATES_STORE_V1__';

type RomaTemplatesCacheEntry = {
  payload: RomaTemplatesPayload;
  expiresAt: number;
};

type RomaTemplatesStore = {
  cache: Record<string, RomaTemplatesCacheEntry | undefined>;
  inFlight: Record<string, Promise<RomaTemplatesPayload> | undefined>;
};

function normalizeTemplateInstance(raw: {
  publicId?: string | null;
  widgetType?: string | null;
  displayName?: string | null;
}): TemplateInstance | null {
  const publicId = String(raw.publicId || '').trim();
  if (!publicId) return null;
  return {
    publicId,
    widgetType: normalizeWidgetType(raw.widgetType),
    displayName: String(raw.displayName || '').trim() || DEFAULT_INSTANCE_DISPLAY_NAME,
  };
}

function isRomaTemplatesStore(value: unknown): value is RomaTemplatesStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!record.cache || typeof record.cache !== 'object' || Array.isArray(record.cache)) return false;
  if (!record.inFlight || typeof record.inFlight !== 'object' || Array.isArray(record.inFlight)) return false;
  return true;
}

function resolveRomaTemplatesStore(): RomaTemplatesStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[ROMA_TEMPLATES_STORE_KEY];
  if (isRomaTemplatesStore(existing)) return existing;
  const next: RomaTemplatesStore = { cache: {}, inFlight: {} };
  scope[ROMA_TEMPLATES_STORE_KEY] = next;
  return next;
}

function readCachedRomaTemplates(workspaceId: string): RomaTemplatesPayload | null {
  const store = resolveRomaTemplatesStore();
  const key = workspaceId;
  const entry = store.cache[key] ?? null;
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    delete store.cache[key];
    return null;
  }
  return entry.payload;
}

function writeCachedRomaTemplates(workspaceId: string, payload: RomaTemplatesPayload): RomaTemplatesPayload {
  const store = resolveRomaTemplatesStore();
  store.cache[workspaceId] = {
    payload,
    expiresAt: Date.now() + ROMA_TEMPLATES_CACHE_TTL_MS,
  };
  return payload;
}

async function loadRomaTemplatesPayload(workspaceId: string, force: boolean): Promise<RomaTemplatesPayload> {
  const store = resolveRomaTemplatesStore();
  const key = workspaceId;
  if (!force) {
    const cached = readCachedRomaTemplates(workspaceId);
    if (cached) return cached;
  } else {
    delete store.cache[key];
  }

  const inFlight = store.inFlight[key];
  if (inFlight) return inFlight;

  store.inFlight[key] = fetchParisJson<RomaTemplatesPayload>(
    `/api/paris/roma/templates?workspaceId=${encodeURIComponent(workspaceId)}`,
  )
    .then((payload) => writeCachedRomaTemplates(workspaceId, payload))
    .finally(() => {
      delete resolveRomaTemplatesStore().inFlight[key];
    });
  return store.inFlight[key] as Promise<RomaTemplatesPayload>;
}

export function useRomaTemplates(workspaceId: string) {
  const [templateInstances, setTemplateInstances] = useState<TemplateInstance[]>([]);
  const [widgetTypes, setWidgetTypes] = useState<string[]>([]);
  const [accountIdFromApi, setAccountIdFromApi] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadTemplatesData = useCallback(async (force = false) => {
    if (!workspaceId) {
      setTemplateInstances([]);
      setWidgetTypes([]);
      setAccountIdFromApi('');
      setDataError(null);
      return;
    }

    setLoading(true);
    setDataError(null);
    try {
      const payload = await loadRomaTemplatesPayload(workspaceId, force);

      const instances = Array.isArray(payload.instances)
        ? payload.instances
            .map((item) => normalizeTemplateInstance(item))
            .filter((item): item is TemplateInstance => Boolean(item))
        : [];
      setTemplateInstances(instances);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDataError(message);
      setTemplateInstances([]);
      setWidgetTypes([]);
      setAccountIdFromApi('');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    void loadTemplatesData();
  }, [loadTemplatesData, workspaceId]);

  return {
    templateInstances,
    widgetTypes,
    accountIdFromApi,
    loading,
    dataError,
    loadTemplatesData,
  };
}

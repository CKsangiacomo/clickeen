'use client';

import { fetchParisJson } from './paris-http';

const COMPILED_WIDGET_CACHE_TTL_MS = 5 * 60_000;
const COMPILED_WIDGET_STORE_KEY = '__CK_ROMA_COMPILED_WIDGET_STORE_V1__';

type CompiledWidgetCacheEntry = {
  payload: unknown;
  expiresAt: number;
};

type CompiledWidgetStore = {
  cache: Record<string, CompiledWidgetCacheEntry | undefined>;
  inFlight: Record<string, Promise<unknown> | undefined>;
};

function isCompiledWidgetStore(value: unknown): value is CompiledWidgetStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cache = record.cache;
  const inFlight = record.inFlight;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;
  if (!inFlight || typeof inFlight !== 'object' || Array.isArray(inFlight)) return false;
  return true;
}

function resolveCompiledWidgetStore(): CompiledWidgetStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[COMPILED_WIDGET_STORE_KEY];
  if (isCompiledWidgetStore(existing)) return existing;
  const next: CompiledWidgetStore = { cache: {}, inFlight: {} };
  scope[COMPILED_WIDGET_STORE_KEY] = next;
  return next;
}

function isCompiledPayload(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeCompiledWidgetType(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export async function getCompiledWidget(widgetType: string): Promise<{ payload: unknown; source: 'cache' | 'network' }> {
  const normalizedWidgetType = normalizeCompiledWidgetType(widgetType);
  if (!normalizedWidgetType) {
    throw new Error('coreui.errors.widgetType.invalid');
  }

  const store = resolveCompiledWidgetStore();
  const now = Date.now();
  const cached = store.cache[normalizedWidgetType];
  if (cached && cached.expiresAt > now) {
    return { payload: cached.payload, source: 'cache' };
  }
  if (cached) {
    delete store.cache[normalizedWidgetType];
  }

  const inFlight = store.inFlight[normalizedWidgetType];
  if (inFlight) {
    const payload = await inFlight;
    return { payload, source: 'network' };
  }

  store.inFlight[normalizedWidgetType] = fetchParisJson<unknown>(
    `/api/widgets/${encodeURIComponent(normalizedWidgetType)}/compiled`,
  )
    .then((payload) => {
      if (!isCompiledPayload(payload)) {
        throw new Error('coreui.errors.widget.compiled.invalid');
      }
      store.cache[normalizedWidgetType] = {
        payload,
        expiresAt: Date.now() + COMPILED_WIDGET_CACHE_TTL_MS,
      };
      return payload;
    })
    .finally(() => {
      delete resolveCompiledWidgetStore().inFlight[normalizedWidgetType];
    });

  const payload = await store.inFlight[normalizedWidgetType];
  return { payload, source: 'network' };
}

export async function prefetchCompiledWidget(widgetType: string): Promise<void> {
  try {
    await getCompiledWidget(widgetType);
  } catch {
    // Prefetch is best-effort; open flows will still fetch on demand.
  }
}

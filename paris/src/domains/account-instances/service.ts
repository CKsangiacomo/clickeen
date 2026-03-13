import type { Env, L10nGenerateStateRow, TokyoMirrorQueueJob } from '../../shared/types';
import type { Policy } from '@clickeen/ck-policy';
import { errorDetail } from '../../shared/errors';
import { asTrimmedString } from '../../shared/validation';
import { requireTokyoBase } from '../../shared/tokyo';
import { normalizeLocaleList } from '../../shared/l10n';
import { loadInstanceOverlays, loadL10nGenerateStates } from '../l10n/service';

type TokyoMirrorEnqueueResult = { ok: true } | { ok: false; error: string };

type TokyoSavedConfigResult =
  | {
      ok: true;
      config: Record<string, unknown>;
      widgetType: string;
      configFp: string;
      updatedAt: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type TokyoSavedConfigState = {
  config: Record<string, unknown>;
  widgetType: string;
  configFp: string;
  updatedAt: string;
};

type RenderIndexEntry = { e: string; r: string; meta: string };
type RenderPublishedPointer = { revision: string; updatedAt: string | null };
type RenderSnapshotState = {
  revision: string | null;
  pointerUpdatedAt: string | null;
  current: Record<string, RenderIndexEntry> | null;
};
type WaitForEnSnapshotReadyResult =
  | { ok: true; state: RenderSnapshotState; waitedMs: number }
  | { ok: false; error: string; state: RenderSnapshotState | null; waitedMs: number };

function normalizeOptionalBaseUrl(value: string | null | undefined): string | null {
  const trimmed = asTrimmedString(value);
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

function resolveRenderIndexBases(env: Env): string[] {
  const bases: string[] = [];
  const append = (value: string | null | undefined) => {
    const normalized = normalizeOptionalBaseUrl(value);
    if (!normalized || bases.includes(normalized)) return;
    bases.push(normalized);
    try {
      const origin = new URL(normalized).origin;
      if (origin && !bases.includes(origin)) bases.push(origin);
    } catch {
      // Ignore malformed URL and keep the normalized candidate.
    }
  };

  append(env.TOKYO_WORKER_BASE_URL);
  append(requireTokyoBase(env));
  return bases;
}

function resolveTokyoSavedConfigBases(env: Env): string[] {
  const bases: string[] = [];
  const append = (value: string | null | undefined) => {
    const normalized = normalizeOptionalBaseUrl(value);
    if (!normalized || bases.includes(normalized)) return;
    bases.push(normalized);
  };

  append(env.TOKYO_WORKER_BASE_URL);
  append(requireTokyoBase(env));
  return bases;
}

function resolveTokyoInternalHeaders(env: Env): Headers {
  const headers = new Headers({ accept: 'application/json' });
  const token = asTrimmedString(env.TOKYO_DEV_JWT);
  if (!token) {
    throw new Error('TOKYO_DEV_JWT missing');
  }
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-ck-internal-service', 'paris.local');
  return headers;
}

function resolveActivePublishLocales(
  args: { accountLocales: unknown; policy: Policy; baseLocale: string },
): { locales: string[]; invalidAccountLocales: string | null } {
  const normalized = normalizeLocaleList(args.accountLocales, 'l10n_locales');
  const additionalLocales = normalized.ok ? normalized.locales : [];
  const maxLocalesTotal = resolveLocaleEntitlementMax(args.policy);
  const baseLocale = typeof args.baseLocale === 'string' && args.baseLocale.trim() ? args.baseLocale.trim() : 'en';
  const deduped = Array.from(new Set([baseLocale, ...additionalLocales]));
  const locales = maxLocalesTotal == null ? deduped : deduped.slice(0, maxLocalesTotal);
  const invalidAccountLocales = normalized.ok ? null : JSON.stringify(normalized.issues);
  return { locales, invalidAccountLocales };
}

function resolveLocaleEntitlementMax(policy: Policy): number | null {
  const maxLocalesTotalRaw = policy.caps['l10n.locales.max'];
  return maxLocalesTotalRaw == null ? null : Math.max(1, Math.floor(maxLocalesTotalRaw));
}

async function loadPersistedLocaleOverlayKeys(
  env: Env,
  publicId: string,
): Promise<string[]> {
  const rows = await loadInstanceOverlays(env, publicId);
  const layerKeys = rows
    .filter((row) => row.layer === 'locale')
    .map((row) => asTrimmedString(row.layer_key))
    .filter((value): value is string => Boolean(value));
  const normalized = normalizeLocaleList(layerKeys, 'overlay.layer_key');
  if (!normalized.ok) return [];
  return normalized.locales;
}

async function resolveRenderSnapshotLocales(args: {
  env: Env;
  publicId: string;
  accountLocales: unknown;
  policy: Policy;
  baseLocale: string;
}): Promise<{
  locales: string[];
  invalidAccountLocales: string | null;
  hasOverlayLocaleFallback: boolean;
}> {
  const active = resolveActivePublishLocales({
    accountLocales: args.accountLocales,
    policy: args.policy,
    baseLocale: args.baseLocale,
  });
  const maxLocalesTotal = resolveLocaleEntitlementMax(args.policy);
  try {
    const persistedLocaleKeys = await loadPersistedLocaleOverlayKeys(args.env, args.publicId);
    if (persistedLocaleKeys.length === 0) {
      return {
        locales: active.locales,
        invalidAccountLocales: active.invalidAccountLocales,
        hasOverlayLocaleFallback: false,
      };
    }
    const merged = Array.from(new Set([...active.locales, ...persistedLocaleKeys]));
    const capped = maxLocalesTotal == null ? merged : merged.slice(0, maxLocalesTotal);
    return {
      locales: capped,
      invalidAccountLocales: active.invalidAccountLocales,
      hasOverlayLocaleFallback: capped.some((locale) => !active.locales.includes(locale)),
    };
  } catch (error) {
    const detail = errorDetail(error);
    console.warn('[ParisWorker] Failed to resolve persisted locale overlay keys for snapshot locales', detail);
    return {
      locales: active.locales,
      invalidAccountLocales: active.invalidAccountLocales,
      hasOverlayLocaleFallback: false,
    };
  }
}

async function enqueueTokyoMirrorJob(env: Env, job: TokyoMirrorQueueJob): Promise<TokyoMirrorEnqueueResult> {
  if (!env.RENDER_SNAPSHOT_QUEUE) {
    return { ok: false, error: 'RENDER_SNAPSHOT_QUEUE missing' };
  }
  try {
    await env.RENDER_SNAPSHOT_QUEUE.send(job);
    return { ok: true };
  } catch (error) {
    const detail = errorDetail(error);
    return { ok: false, error: detail };
  }
}

async function requestTokyoSavedConfig(args: {
  env: Env;
  accountId: string;
  publicId: string;
  method: 'GET' | 'PUT';
  body?: Record<string, unknown>;
}): Promise<TokyoSavedConfigResult> {
  const bases = resolveTokyoSavedConfigBases(args.env);
  if (!bases.length) {
    return { ok: false, status: 503, error: 'Tokyo base unavailable' };
  }

  const headers = resolveTokyoInternalHeaders(args.env);
  headers.set('x-account-id', args.accountId);
  if (args.body) {
    headers.set('content-type', 'application/json');
  }

  let lastFailure: TokyoSavedConfigResult | null = null;
  for (const base of bases) {
    const url = `${base}/renders/instances/${encodeURIComponent(args.publicId)}/saved.json?accountId=${encodeURIComponent(args.accountId)}`;
    try {
      const response = await fetch(url, {
        method: args.method,
        headers,
        cache: 'no-store',
        ...(args.body ? { body: JSON.stringify(args.body) } : {}),
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (response.status === 404) {
        return { ok: false, status: 404, error: 'not_found' };
      }
      if (!response.ok) {
        lastFailure = {
          ok: false,
          status: response.status,
          error:
            typeof payload?.error === 'object' && payload.error && typeof (payload.error as { reasonKey?: unknown }).reasonKey === 'string'
              ? String((payload.error as { reasonKey?: unknown }).reasonKey)
              : `tokyo_saved_config_http_${response.status}`,
        };
        continue;
      }

      const config =
        payload?.config && typeof payload.config === 'object' && !Array.isArray(payload.config)
          ? (payload.config as Record<string, unknown>)
          : null;
      const widgetType = typeof payload?.widgetType === 'string' ? payload.widgetType.trim() : '';
      const configFp = typeof payload?.configFp === 'string' ? payload.configFp.trim() : '';
      const updatedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt.trim() : '';
      if (!config || !widgetType || !configFp || !updatedAt) {
        return { ok: false, status: 502, error: 'tokyo_saved_config_invalid_payload' };
      }
      return { ok: true, config, widgetType, configFp, updatedAt };
    } catch (error) {
      lastFailure = {
        ok: false,
        status: 502,
        error: errorDetail(error),
      };
    }
  }

  return lastFailure ?? { ok: false, status: 502, error: 'tokyo_saved_config_unavailable' };
}

export async function loadSavedConfigFromTokyo(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<Record<string, unknown> | null> {
  const result = await loadSavedConfigStateFromTokyo(args);
  return result?.config ?? null;
}

export async function loadSavedConfigStateFromTokyo(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<TokyoSavedConfigState | null> {
  const result = await requestTokyoSavedConfig({
    env: args.env,
    accountId: args.accountId,
    publicId: args.publicId,
    method: 'GET',
  });
  if (result.ok) {
    return {
      config: result.config,
      widgetType: result.widgetType,
      configFp: result.configFp,
      updatedAt: result.updatedAt,
    };
  }
  if (result.ok === false && result.status === 404) return null;
  if (result.ok === false) {
    throw new Error(result.error);
  }
  throw new Error('tokyo_saved_config_unavailable');
}

async function writeSavedConfigToTokyo(args: {
  env: Env;
  accountId: string;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
}): Promise<void> {
  const result = await requestTokyoSavedConfig({
    env: args.env,
    accountId: args.accountId,
    publicId: args.publicId,
    method: 'PUT',
    body: {
      widgetType: args.widgetType,
      config: args.config,
    },
  });
  if (result.ok === false) {
    throw new Error(result.error);
  }
}

async function loadL10nGenerateStatesForFingerprint(args: {
  env: Env;
  publicId: string;
  baseFingerprint: string;
}): Promise<Map<string, L10nGenerateStateRow>> {
  return loadL10nGenerateStates(args.env, args.publicId, 'locale', args.baseFingerprint);
}

async function loadLocaleOverlayMatchesForFingerprint(args: {
  env: Env;
  publicId: string;
  baseFingerprint: string;
}): Promise<Set<string>> {
  const rows = await loadInstanceOverlays(args.env, args.publicId);
  const out = new Set<string>();
  rows?.forEach((row) => {
    if (row?.layer !== 'locale') return;
    if (!row?.layer_key) return;
    if (row?.base_fingerprint !== args.baseFingerprint) return;
    out.add(row.layer_key);
  });
  return out;
}

function normalizeRenderIndexEntry(raw: unknown): RenderIndexEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;
  const e = typeof entry.e === 'string' && entry.e.trim() ? entry.e.trim() : '';
  const r = typeof entry.r === 'string' && entry.r.trim() ? entry.r.trim() : '';
  const meta = typeof entry.meta === 'string' && entry.meta.trim() ? entry.meta.trim() : '';
  if (!e || !r || !meta) return null;
  return { e, r, meta };
}

function normalizeRenderRevision(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value) return null;
  if (!/^[a-z0-9][a-z0-9_-]{7,63}$/i.test(value)) return null;
  return value;
}

function normalizeRenderPublishedPointer(raw: unknown): RenderPublishedPointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  const revision = normalizeRenderRevision(payload.revision);
  if (!revision) return null;
  const updatedAt =
    typeof payload.updatedAt === 'string' && payload.updatedAt.trim()
      ? payload.updatedAt.trim()
      : null;
  return { revision, updatedAt };
}

function normalizeRenderIndexCurrent(raw: unknown): Record<string, RenderIndexEntry> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  const current = payload.current;
  if (!current || typeof current !== 'object' || Array.isArray(current)) return null;

  const out: Record<string, RenderIndexEntry> = {};
  Object.entries(current).forEach(([locale, entry]) => {
    const normalized = normalizeRenderIndexEntry(entry);
    if (!normalized) return;
    out[locale] = normalized;
  });
  return out;
}

async function loadRenderIndexCurrent(args: {
  env: Env;
  publicId: string;
}): Promise<Record<string, RenderIndexEntry> | null> {
  const state = await loadRenderSnapshotState(args);
  return state.current;
}

async function loadRenderSnapshotState(args: {
  env: Env;
  publicId: string;
}): Promise<RenderSnapshotState> {
  const bases = resolveRenderIndexBases(args.env);
  for (const base of bases) {
    const requestInit: RequestInit = {
      method: 'GET',
      cache: 'no-store',
      headers: { 'X-Request-ID': crypto.randomUUID() },
    };

    const pointerUrl = `${base}/renders/instances/${encodeURIComponent(args.publicId)}/published.json`;
    const pointerRes = await fetch(pointerUrl, requestInit);
    if (pointerRes.ok) {
      const pointerPayload = (await pointerRes.json().catch(() => null)) as unknown;
      const pointer = normalizeRenderPublishedPointer(pointerPayload);
      if (pointer?.revision) {
        const revisionUrl = `${base}/renders/instances/${encodeURIComponent(args.publicId)}/revisions/${encodeURIComponent(pointer.revision)}/index.json`;
        const revisionRes = await fetch(revisionUrl, requestInit);
        if (revisionRes.ok) {
          const revisionPayload = (await revisionRes.json().catch(() => null)) as unknown;
          const revisionCurrent = normalizeRenderIndexCurrent(revisionPayload);
          return {
            revision: pointer.revision,
            pointerUpdatedAt: pointer.updatedAt,
            current: revisionCurrent,
          };
        } else if (revisionRes.status !== 404) {
          const detail = await revisionRes.text().catch(() => '');
          throw new Error(
            `[ParisWorker] Failed to load render revision index from ${base} (${revisionRes.status}): ${detail}`.trim(),
          );
        }
        return {
          revision: pointer.revision,
          pointerUpdatedAt: pointer.updatedAt,
          current: null,
        };
      }
    } else if (pointerRes.status !== 404) {
      const detail = await pointerRes.text().catch(() => '');
      throw new Error(
        `[ParisWorker] Failed to load render pointer from ${base} (${pointerRes.status}): ${detail}`.trim(),
      );
    }
  }
  return {
    revision: null,
    pointerUpdatedAt: null,
    current: null,
  };
}

function hasPointerAdvanced(args: {
  state: RenderSnapshotState;
  baselinePointerUpdatedAt: string | null;
  baselineRevision: string | null;
}): boolean {
  const currentPointerUpdatedAt = asTrimmedString(args.state.pointerUpdatedAt);
  const currentRevision = asTrimmedString(args.state.revision);
  const baselinePointerUpdatedAt = asTrimmedString(args.baselinePointerUpdatedAt);
  const baselineRevision = asTrimmedString(args.baselineRevision);

  const hadBaseline = Boolean(baselinePointerUpdatedAt || baselineRevision);
  if (!hadBaseline) return Boolean(currentPointerUpdatedAt || currentRevision);

  if (baselinePointerUpdatedAt && currentPointerUpdatedAt && currentPointerUpdatedAt !== baselinePointerUpdatedAt) {
    return true;
  }
  if (baselineRevision && currentRevision && currentRevision !== baselineRevision) {
    return true;
  }
  return false;
}

async function waitForEnSnapshotReady(args: {
  env: Env;
  publicId: string;
  baselinePointerUpdatedAt?: string | null;
  baselineRevision?: string | null;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<WaitForEnSnapshotReadyResult> {
  const timeoutMs =
    typeof args.timeoutMs === 'number' && Number.isFinite(args.timeoutMs) && args.timeoutMs > 0
      ? Math.floor(args.timeoutMs)
      : 12_000;
  const intervalMs =
    typeof args.intervalMs === 'number' && Number.isFinite(args.intervalMs) && args.intervalMs > 0
      ? Math.floor(args.intervalMs)
      : 300;
  const startedAt = Date.now();
  const baselinePointerUpdatedAt = asTrimmedString(args.baselinePointerUpdatedAt) ?? null;
  const baselineRevision = asTrimmedString(args.baselineRevision) ?? null;
  let lastState: RenderSnapshotState | null = null;
  let lastError: string | null = null;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const state = await loadRenderSnapshotState({ env: args.env, publicId: args.publicId });
      lastState = state;
      const hasEnSnapshot = Boolean(state.current?.en);
      const pointerAdvanced = hasPointerAdvanced({
        state,
        baselinePointerUpdatedAt,
        baselineRevision,
      });
      if (hasEnSnapshot && pointerAdvanced) {
        return { ok: true, state, waitedMs: Date.now() - startedAt };
      }
    } catch (error) {
      lastError = errorDetail(error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    ok: false,
    error:
      lastError ??
      `Timed out waiting for EN snapshot readiness (publicId=${args.publicId}, timeoutMs=${timeoutMs})`,
    state: lastState,
    waitedMs: Date.now() - startedAt,
  };
}

export type { RenderIndexEntry, TokyoMirrorEnqueueResult };

export {
  enqueueTokyoMirrorJob,
  loadL10nGenerateStatesForFingerprint,
  loadPersistedLocaleOverlayKeys,
  loadLocaleOverlayMatchesForFingerprint,
  loadRenderIndexCurrent,
  loadRenderSnapshotState,
  resolveActivePublishLocales,
  resolveRenderSnapshotLocales,
  waitForEnSnapshotReady,
  writeSavedConfigToTokyo,
};

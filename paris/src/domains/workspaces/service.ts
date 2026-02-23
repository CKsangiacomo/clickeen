import type { Env, InstanceOverlayRow, L10nGenerateStateRow } from '../../shared/types';
import type { Policy } from '@clickeen/ck-policy';
import { readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString } from '../../shared/validation';
import { requireTokyoBase } from '../../shared/tokyo';
import { normalizeLocaleList } from '../../shared/l10n';

type EnforcementRow = {
  public_id: string;
  mode: 'frozen';
  period_key: string;
  frozen_at: string;
  reset_at: string;
};

type RenderSnapshotEnqueueResult = { ok: true } | { ok: false; error: string };
type LocaleOverlayLayerKeyRow = { layer_key?: string | null };

type RenderIndexEntry = { e: string; r: string; meta: string };
type RenderPublishedPointer = { revision: string };

async function loadEnforcement(env: Env, publicId: string): Promise<EnforcementRow | null> {
  const params = new URLSearchParams({
    select: 'public_id,mode,period_key,frozen_at,reset_at',
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/instance_enforcement_state?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => null)) as EnforcementRow[] | null;
  return rows?.[0] ?? null;
}

function normalizeActiveEnforcement(row: EnforcementRow | null): null | {
  mode: 'frozen';
  periodKey: string;
  frozenAt: string;
  resetAt: string;
} {
  if (!row) return null;
  const resetAt = typeof row.reset_at === 'string' ? row.reset_at : '';
  if (!resetAt) return null;
  const resetMs = Date.parse(resetAt);
  if (!Number.isFinite(resetMs)) return null;
  if (resetMs <= Date.now()) return null;
  return {
    mode: 'frozen',
    periodKey: row.period_key,
    frozenAt: row.frozen_at,
    resetAt: row.reset_at,
  };
}

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

function resolveActivePublishLocales(
  workspaceLocales: unknown,
  policy: Policy,
): { locales: string[]; invalidWorkspaceLocales: string | null } {
  const normalized = normalizeLocaleList(workspaceLocales, 'l10n_locales');
  const additionalLocales = normalized.ok ? normalized.locales : [];
  const maxLocalesTotalRaw = policy.caps['l10n.locales.max'];
  const maxLocalesTotal =
    maxLocalesTotalRaw == null ? null : Math.max(1, Math.floor(maxLocalesTotalRaw));
  const deduped = Array.from(new Set(['en', ...additionalLocales]));
  const locales = maxLocalesTotal == null ? deduped : deduped.slice(0, maxLocalesTotal);
  const invalidWorkspaceLocales = normalized.ok ? null : JSON.stringify(normalized.issues);
  return { locales, invalidWorkspaceLocales };
}

async function loadPersistedLocaleOverlayKeys(
  env: Env,
  publicId: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    select: 'layer_key',
    public_id: `eq.${publicId}`,
    layer: 'eq.locale',
    limit: '1000',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load persisted locale overlays (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = ((await res.json().catch(() => null)) as LocaleOverlayLayerKeyRow[] | null) ?? [];
  const layerKeys = rows
    .map((row) => asTrimmedString(row.layer_key))
    .filter((value): value is string => Boolean(value));
  const normalized = normalizeLocaleList(layerKeys, 'overlay.layer_key');
  if (!normalized.ok) return [];
  return normalized.locales;
}

async function resolveRenderSnapshotLocales(args: {
  env: Env;
  publicId: string;
  workspaceLocales: unknown;
  policy: Policy;
}): Promise<{
  locales: string[];
  invalidWorkspaceLocales: string | null;
  hasOverlayLocaleFallback: boolean;
}> {
  const active = resolveActivePublishLocales(args.workspaceLocales, args.policy);
  try {
    const persistedLocaleKeys = await loadPersistedLocaleOverlayKeys(args.env, args.publicId);
    if (persistedLocaleKeys.length === 0) {
      return {
        locales: active.locales,
        invalidWorkspaceLocales: active.invalidWorkspaceLocales,
        hasOverlayLocaleFallback: false,
      };
    }
    const merged = Array.from(new Set([...active.locales, ...persistedLocaleKeys]));
    return {
      locales: merged,
      invalidWorkspaceLocales: active.invalidWorkspaceLocales,
      hasOverlayLocaleFallback: merged.length > active.locales.length,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('[ParisWorker] Failed to resolve persisted locale overlay keys for snapshot locales', detail);
    return {
      locales: active.locales,
      invalidWorkspaceLocales: active.invalidWorkspaceLocales,
      hasOverlayLocaleFallback: false,
    };
  }
}

async function enqueueRenderSnapshot(
  env: Env,
  job: { publicId: string; action: 'upsert' | 'delete'; locales?: string[] },
): Promise<RenderSnapshotEnqueueResult> {
  if (!env.RENDER_SNAPSHOT_QUEUE) {
    return { ok: false, error: 'RENDER_SNAPSHOT_QUEUE missing' };
  }
  try {
    const locales = Array.isArray(job.locales)
      ? Array.from(
          new Set(
            job.locales
              .map((locale) => (typeof locale === 'string' ? locale.trim() : ''))
              .filter(Boolean),
          ),
        )
      : [];
    const jobs =
      job.action === 'delete'
        ? [job]
        : locales.length
          ? locales.map((locale) => ({ ...job, locales: [locale] }))
          : [job];
    for (const next of jobs) {
      await env.RENDER_SNAPSHOT_QUEUE.send({
        v: 1,
        kind: 'render-snapshot',
        publicId: next.publicId,
        action: next.action,
        locales: next.locales,
      });
    }
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: detail };
  }
}

async function loadL10nGenerateStatesForFingerprint(args: {
  env: Env;
  publicId: string;
  baseFingerprint: string;
}): Promise<Map<string, L10nGenerateStateRow>> {
  const params = new URLSearchParams({
    select: [
      'public_id',
      'layer',
      'layer_key',
      'base_fingerprint',
      'base_updated_at',
      'widget_type',
      'workspace_id',
      'status',
      'attempts',
      'next_attempt_at',
      'last_attempt_at',
      'last_error',
      'changed_paths',
      'removed_paths',
    ].join(','),
    public_id: `eq.${args.publicId}`,
    layer: 'eq.locale',
    base_fingerprint: `eq.${args.baseFingerprint}`,
  });
  const res = await supabaseFetch(args.env, `/rest/v1/l10n_generate_state?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load l10n generate state (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as L10nGenerateStateRow[];
  const map = new Map<string, L10nGenerateStateRow>();
  rows?.forEach((row) => {
    if (row?.layer_key) map.set(row.layer_key, row);
  });
  return map;
}

async function loadLocaleOverlayMatchesForFingerprint(args: {
  env: Env;
  publicId: string;
  baseFingerprint: string;
}): Promise<Set<string>> {
  const params = new URLSearchParams({
    select: ['layer', 'layer_key', 'base_fingerprint'].join(','),
    public_id: `eq.${args.publicId}`,
    layer: 'eq.locale',
    base_fingerprint: `eq.${args.baseFingerprint}`,
  });
  const res = await supabaseFetch(
    args.env,
    `/rest/v1/widget_instance_overlays?${params.toString()}`,
    {
      method: 'GET',
    },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load locale overlay matches (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as InstanceOverlayRow[];
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
  return { revision };
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
          if (revisionCurrent) return revisionCurrent;
        } else if (revisionRes.status !== 404) {
          const detail = await revisionRes.text().catch(() => '');
          throw new Error(
            `[ParisWorker] Failed to load render revision index from ${base} (${revisionRes.status}): ${detail}`.trim(),
          );
        }
      }
    } else if (pointerRes.status !== 404) {
      const detail = await pointerRes.text().catch(() => '');
      throw new Error(
        `[ParisWorker] Failed to load render pointer from ${base} (${pointerRes.status}): ${detail}`.trim(),
      );
    }
  }
  return null;
}

export type { RenderIndexEntry, RenderSnapshotEnqueueResult };

export {
  enqueueRenderSnapshot,
  loadEnforcement,
  loadL10nGenerateStatesForFingerprint,
  loadLocaleOverlayMatchesForFingerprint,
  loadRenderIndexCurrent,
  normalizeActiveEnforcement,
  resolveActivePublishLocales,
  resolveRenderSnapshotLocales,
};

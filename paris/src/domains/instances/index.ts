import { computeBaseFingerprint } from '@clickeen/l10n';
import { resolvePolicy } from '@clickeen/ck-policy';
import type { Policy } from '@clickeen/ck-policy';
import type { CuratedInstanceRow, Env, InstanceRow, WidgetRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { assertDevAuth } from '../../shared/auth';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString } from '../../shared/validation';
import { loadWorkspaceById } from '../../shared/workspaces';
import {
  isCuratedInstanceRow,
  isCuratedPublicId,
  resolveInstanceKind,
  resolveInstanceWorkspaceId,
} from '../../shared/instances';

const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';

const USER_INSTANCE_SELECT_WITH_DISPLAY_NAME =
  'public_id,display_name,status,config,created_at,updated_at,widget_id,workspace_id,kind';

const WIDGET_LOOKUP_CACHE_TTL_MS = 5 * 60_000;
const WIDGET_LOOKUP_STORE_KEY = '__CK_PARIS_WIDGET_LOOKUP_STORE_V1__';

type WidgetLookupCacheEntry = {
  widget: WidgetRow | null;
  expiresAt: number;
};

type WidgetLookupStore = {
  cache: Record<string, WidgetLookupCacheEntry | undefined>;
  inFlight: Record<string, Promise<WidgetRow | null> | undefined>;
};

function isWidgetLookupStore(value: unknown): value is WidgetLookupStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cache = record.cache;
  const inFlight = record.inFlight;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;
  if (!inFlight || typeof inFlight !== 'object' || Array.isArray(inFlight)) return false;
  return true;
}

function resolveWidgetLookupStore(): WidgetLookupStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[WIDGET_LOOKUP_STORE_KEY];
  if (isWidgetLookupStore(existing)) return existing;
  const next: WidgetLookupStore = {
    cache: {},
    inFlight: {},
  };
  scope[WIDGET_LOOKUP_STORE_KEY] = next;
  return next;
}

async function fetchUserInstanceRows(
  env: Env,
  params: URLSearchParams,
): Promise<{ ok: true; rows: InstanceRow[] } | { ok: false; status: number; details: unknown }> {
  const primaryParams = new URLSearchParams(params);
  primaryParams.set('select', USER_INSTANCE_SELECT_WITH_DISPLAY_NAME);

  const primaryRes = await supabaseFetch(env, `/rest/v1/widget_instances?${primaryParams.toString()}`, { method: 'GET' });
  if (primaryRes.ok) {
    const rows = ((await primaryRes.json()) as InstanceRow[]).filter(Boolean);
    return { ok: true, rows };
  }

  const primaryDetails = await readJson(primaryRes);
  return { ok: false, status: primaryRes.status, details: primaryDetails };
}

async function loadUserInstanceByPublicId(env: Env, publicId: string): Promise<InstanceRow | null> {
  const params = new URLSearchParams({
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const result = await fetchUserInstanceRows(env, params);
  if (!result.ok) {
    throw new Error(`[ParisWorker] Failed to load user instance (${result.status}): ${JSON.stringify(result.details)}`);
  }
  const rows = result.rows;
  return rows?.[0] ?? null;
}

async function loadCuratedInstanceByPublicId(env: Env, publicId: string): Promise<CuratedInstanceRow | null> {
  const params = new URLSearchParams({
    select: 'public_id,widget_type,status,config,created_at,updated_at,kind,meta',
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load curated instance (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as CuratedInstanceRow[];
  return rows?.[0] ?? null;
}

export async function loadInstanceByPublicId(env: Env, publicId: string): Promise<InstanceRow | CuratedInstanceRow | null> {
  if (isCuratedPublicId(publicId)) {
    return loadCuratedInstanceByPublicId(env, publicId);
  }
  return loadUserInstanceByPublicId(env, publicId);
}

async function loadUserInstanceByWorkspaceAndPublicId(
  env: Env,
  workspaceId: string,
  publicId: string,
): Promise<InstanceRow | null> {
  const params = new URLSearchParams({
    public_id: `eq.${publicId}`,
    workspace_id: `eq.${workspaceId}`,
    limit: '1',
  });
  const result = await fetchUserInstanceRows(env, params);
  if (!result.ok) {
    throw new Error(`[ParisWorker] Failed to load user instance (${result.status}): ${JSON.stringify(result.details)}`);
  }
  const rows = result.rows;
  return rows?.[0] ?? null;
}

export async function loadInstanceByWorkspaceAndPublicId(
  env: Env,
  workspaceId: string,
  publicId: string,
): Promise<InstanceRow | CuratedInstanceRow | null> {
  if (isCuratedPublicId(publicId)) {
    return loadCuratedInstanceByPublicId(env, publicId);
  }
  return loadUserInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
}

async function loadWidget(env: Env, widgetId: string): Promise<WidgetRow | null> {
  const normalizedWidgetId = String(widgetId || '').trim();
  if (!normalizedWidgetId) return null;

  const store = resolveWidgetLookupStore();
  const cached = store.cache[normalizedWidgetId];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.widget;
  }
  if (cached) {
    delete store.cache[normalizedWidgetId];
  }

  const existingRequest = store.inFlight[normalizedWidgetId];
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const params = new URLSearchParams({
      select: 'id,type,name',
      id: `eq.${normalizedWidgetId}`,
      limit: '1',
    });
    const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
    if (!res.ok) {
      const details = await readJson(res);
      throw new Error(`[ParisWorker] Failed to load widget (${res.status}): ${JSON.stringify(details)}`);
    }
    const rows = (await res.json()) as WidgetRow[];
    return rows?.[0] ?? null;
  })();
  store.inFlight[normalizedWidgetId] = request;

  try {
    const widget = await request;
    store.cache[normalizedWidgetId] = {
      widget,
      expiresAt: Date.now() + WIDGET_LOOKUP_CACHE_TTL_MS,
    };
    return widget;
  } finally {
    delete resolveWidgetLookupStore().inFlight[normalizedWidgetId];
  }
}

export async function loadWidgetByType(env: Env, widgetType: string): Promise<WidgetRow | null> {
  const params = new URLSearchParams({
    select: 'id,type,name,catalog',
    type: `eq.${widgetType}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load widget by type (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as WidgetRow[];
  return rows?.[0] ?? null;
}

export async function resolveWidgetTypeForInstance(
  env: Env,
  instance: InstanceRow | CuratedInstanceRow,
  fallback?: string | null,
): Promise<string | null> {
  if (isCuratedInstanceRow(instance)) {
    return instance.widget_type || fallback || null;
  }
  if (instance.widget_id) {
    const widget = await loadWidget(env, instance.widget_id);
    return widget?.type ?? fallback ?? null;
  }
  return fallback ?? null;
}

export async function handleListWidgets(req: Request, env: Env) {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;

  const params = new URLSearchParams({
    select: 'type,name',
    order: 'type.asc',
  });
  const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const rows = (await res.json().catch(() => [])) as Array<{ type?: string | null; name?: string | null }>;
  return json(
    {
      widgets: rows
        .map((row) => ({ type: typeof row.type === 'string' ? row.type : null, name: typeof row.name === 'string' ? row.name : null }))
        .filter((row) => Boolean(row.type)),
    },
    { status: 200 },
  );
}

function readCuratedMeta(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function formatCuratedDisplayName(meta: Record<string, unknown> | null, fallback: string): string {
  if (!meta) return fallback;
  const styleName = asTrimmedString(meta.styleName ?? meta.name ?? meta.title);
  if (!styleName) return fallback;
  return styleName;
}

function resolveInstanceDisplayName(instance: InstanceRow | CuratedInstanceRow): string {
  if (isCuratedInstanceRow(instance)) {
    const meta = readCuratedMeta(instance.meta);
    return formatCuratedDisplayName(meta, instance.public_id);
  }
  return asTrimmedString(instance.display_name) ?? DEFAULT_INSTANCE_DISPLAY_NAME;
}

export async function handleCuratedInstances(req: Request, env: Env) {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;

  const requestUrl = new URL(req.url);
  const includeConfigParam = String(requestUrl.searchParams.get('includeConfig') ?? '1')
    .trim()
    .toLowerCase();
  const includeConfig = !['0', 'false', 'no'].includes(includeConfigParam);

  const selectFields = includeConfig
    ? 'public_id,widget_type,status,config,created_at,updated_at,kind,meta'
    : 'public_id,widget_type,status,created_at,updated_at,kind,meta';

  const params = new URLSearchParams({
    select: selectFields,
    order: 'created_at.desc',
    limit: '100',
  });

  const res = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    return json({ error: 'DB_ERROR', details }, { status: 500 });
  }

  type CuratedListRow = Omit<CuratedInstanceRow, 'config'> & { config?: Record<string, unknown> };
  const rows = ((await res.json()) as CuratedListRow[]).filter(Boolean);
  const instances = rows.map((row) => {
    const meta = readCuratedMeta(row.meta);
    const base = {
      publicId: row.public_id,
      widgetname: row.widget_type || 'unknown',
      displayName: formatCuratedDisplayName(meta, row.public_id),
      meta,
    };
    if (!includeConfig) return base;
    return { ...base, config: row.config ?? null };
  });

  return json({ instances, includeConfig });
}

export async function handleGetInstance(_req: Request, env: Env, publicId: string) {
  // Public runtime instance endpoint.
  // Used by Venice/Prague and must be readable without auth,
  // but it must never leak drafts.

  const instance = await loadInstanceByPublicId(env, publicId);
  if (!instance) return json({ error: 'NOT_FOUND' }, { status: 404 });

  const isCurated = resolveInstanceKind(instance) === 'curated';
  if (!isCurated && instance.status !== 'published') {
    // Treat unpublished as not-found for public user-owned surfaces.
    return json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType) return json({ error: 'WIDGET_NOT_FOUND' }, { status: 500 });

  const baseFingerprint = await computeBaseFingerprint(instance.config);
  let policy: Policy | null = null;
  if (resolveInstanceKind(instance) === 'curated') {
    policy = resolvePolicy({ profile: 'devstudio', role: 'owner' });
  } else {
    const workspaceId = resolveInstanceWorkspaceId(instance);
    if (workspaceId) {
      try {
        const workspace = await loadWorkspaceById(env, workspaceId);
        if (workspace) {
          policy = resolvePolicy({ profile: workspace.tier, role: 'editor' });
        }
      } catch {
        policy = null;
      }
    }
  }

  return json({
    publicId: instance.public_id,
    displayName: resolveInstanceDisplayName(instance),
    status: instance.status,
    widgetType,
    config: instance.config,
    updatedAt: instance.updated_at ?? null,
    baseFingerprint,
    policy,
  });
}

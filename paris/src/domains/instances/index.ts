import { computeBaseFingerprint } from '@clickeen/l10n';
import { resolvePolicy } from '@clickeen/ck-policy';
import type { Policy } from '@clickeen/ck-policy';
import type { CuratedInstanceRow, Env, InstanceRow, WidgetRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, assertConfig } from '../../shared/validation';
import { loadAccountById } from '../../shared/accounts';
import {
  isCuratedInstanceRow,
  isCuratedPublicId,
  resolveInstanceKind,
  resolveInstanceAccountId,
} from '../../shared/instances';
import { loadSavedConfigStateFromTokyo } from '../account-instances/service';

const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';

const USER_INSTANCE_SELECT_WITH_DISPLAY_NAME =
  'public_id,display_name,status,config,created_at,updated_at,widget_id,account_id,kind';

function readCuratedMeta(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function formatCuratedDisplayName(meta: Record<string, unknown> | null, fallback: string): string {
  if (!meta) return fallback;
  const styleName = asTrimmedString(meta.styleName ?? meta.name ?? meta.title);
  return styleName || fallback;
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
    for (const row of rows) {
      const configResult = assertConfig(row.config);
      if (!configResult.ok) {
        throw new Error(
          `[ParisWorker] Invalid persisted instance config (${String(row.public_id || 'unknown')}): ${configResult.issues[0]?.message || 'invalid config'}`,
        );
      }
    }
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
    select: 'public_id,widget_type,status,config,created_at,updated_at,kind,meta,owner_account_id',
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load curated instance (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as CuratedInstanceRow[];
  const row = rows?.[0] ?? null;
  if (!row) return null;
  const configResult = assertConfig(row.config);
  if (!configResult.ok) {
    throw new Error(
      `[ParisWorker] Invalid persisted curated config (${String(row.public_id || 'unknown')}): ${configResult.issues[0]?.message || 'invalid config'}`,
    );
  }
  return row;
}

export async function loadInstanceByPublicId(env: Env, publicId: string): Promise<InstanceRow | CuratedInstanceRow | null> {
  if (isCuratedPublicId(publicId)) {
    return loadCuratedInstanceByPublicId(env, publicId);
  }
  return loadUserInstanceByPublicId(env, publicId);
}

async function loadUserInstanceByAccountAndPublicId(
  env: Env,
  accountId: string,
  publicId: string,
): Promise<InstanceRow | null> {
  const params = new URLSearchParams({
    public_id: `eq.${publicId}`,
    account_id: `eq.${accountId}`,
    limit: '1',
  });
  const result = await fetchUserInstanceRows(env, params);
  if (!result.ok) {
    throw new Error(`[ParisWorker] Failed to load user instance (${result.status}): ${JSON.stringify(result.details)}`);
  }
  const rows = result.rows;
  return rows?.[0] ?? null;
}

export async function loadInstanceByAccountAndPublicId(
  env: Env,
  accountId: string,
  publicId: string,
): Promise<InstanceRow | CuratedInstanceRow | null> {
  if (isCuratedPublicId(publicId)) {
    return loadCuratedInstanceByPublicId(env, publicId);
  }
  return loadUserInstanceByAccountAndPublicId(env, accountId, publicId);
}

async function loadWidget(env: Env, widgetId: string): Promise<WidgetRow | null> {
  const normalizedWidgetId = String(widgetId || '').trim();
  if (!normalizedWidgetId) return null;
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

function resolveInstanceDisplayName(instance: InstanceRow | CuratedInstanceRow): string {
  if (isCuratedInstanceRow(instance)) {
    const meta = readCuratedMeta(instance.meta);
    return formatCuratedDisplayName(meta, instance.public_id);
  }
  return asTrimmedString(instance.display_name) ?? DEFAULT_INSTANCE_DISPLAY_NAME;
}

export async function handleGetInstance(_req: Request, env: Env, publicId: string) {
  // Public runtime instance endpoint.
  // Used by Venice/Prague and must be readable without auth,
  // but it must never leak drafts.

  const instance = await loadInstanceByPublicId(env, publicId);
  if (!instance) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  if (instance.status !== 'published') {
    // Treat unpublished as not-found for public user-owned surfaces.
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  const ownerAccountId = resolveInstanceAccountId(instance);
  if (!ownerAccountId) {
    return ckError(
      { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: 'instance_account_missing' },
      500,
    );
  }

  const savedState = await loadSavedConfigStateFromTokyo({
    env,
    accountId: ownerAccountId,
    publicId,
  });
  if (!savedState) {
    return ckError(
      { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: 'saved_tokyo_revision_missing' },
      500,
    );
  }

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);
  }

  const baseFingerprint = await computeBaseFingerprint(savedState.config);
  let policy: Policy | null = null;
  const accountId = ownerAccountId;
  if (accountId) {
    try {
      const account = await loadAccountById(env, accountId);
      if (account) {
        policy = resolvePolicy({ profile: account.tier, role: 'editor' });
      }
    } catch {
      policy = null;
    }
  }

  return json({
    publicId: instance.public_id,
    displayName: resolveInstanceDisplayName(instance),
    status: instance.status,
    widgetType,
    config: savedState.config,
    updatedAt: savedState.updatedAt,
    baseFingerprint,
    policy,
  });
}

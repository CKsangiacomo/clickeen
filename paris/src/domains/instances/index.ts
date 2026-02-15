import { computeBaseFingerprint } from '@clickeen/l10n';
import { resolvePolicy } from '@clickeen/ck-policy';
import type { Policy } from '@clickeen/ck-policy';
import type {
  CuratedInstanceRow,
  Env,
  InstanceRow,
  RenderSnapshotQueueJob,
  UpdatePayload,
  WidgetRow,
} from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { asBearerToken, assertDevAuth, requireEnv } from '../../shared/auth';
import { normalizeLocaleList } from '../../shared/l10n';
import { supabaseFetch } from '../../shared/supabase';
import {
  AssetUsageValidationError,
  syncAccountAssetUsageForInstance,
} from '../../shared/assetUsage';
import {
  asTrimmedString,
  assertConfig,
  assertMeta,
  assertStatus,
  assertWorkspaceId,
  configNonPersistableUrlIssues,
  isRecord,
  isUuid,
} from '../../shared/validation';
import { isKnownWidgetType } from '../../shared/tokyo';
import { loadWorkspaceById } from '../../shared/workspaces';
import {
  allowCuratedWrites,
  assertPublicId,
  assertWidgetType,
  inferInstanceKindFromPublicId,
  isCuratedInstanceRow,
  isCuratedPublicId,
  resolveCuratedRowKind,
  resolveInstanceKind,
  resolveInstanceWorkspaceId,
} from '../../shared/instances';

async function enqueueRenderSnapshot(env: Env, job: RenderSnapshotQueueJob) {
  if (!env.RENDER_SNAPSHOT_QUEUE) return;
  await env.RENDER_SNAPSHOT_QUEUE.send(job);
}

async function resolveSnapshotLocales(env: Env, args: { workspaceId: string; kind: 'curated' | 'user' }): Promise<string[]> {
  if (args.kind === 'curated') return ['en'];
  const workspace = await loadWorkspaceById(env, args.workspaceId).catch(() => null);
  const normalized = normalizeLocaleList(workspace?.l10n_locales ?? [], 'l10n_locales');
  const locales = normalized.ok ? normalized.locales : [];
  return Array.from(new Set(['en', ...locales]));
}

async function loadUserInstanceByPublicId(env: Env, publicId: string): Promise<InstanceRow | null> {
  const params = new URLSearchParams({
    select: 'public_id,status,config,created_at,updated_at,widget_id,workspace_id,kind',
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load user instance (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as InstanceRow[];
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
    select: 'public_id,status,config,created_at,updated_at,widget_id,workspace_id,kind',
    public_id: `eq.${publicId}`,
    workspace_id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load user instance (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as InstanceRow[];
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
  const params = new URLSearchParams({
    select: 'id,type,name',
    id: `eq.${widgetId}`,
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

export async function handleListWidgets(req: Request, env: Env) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

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

export async function handleInstances(req: Request, env: Env) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(url.searchParams.get('workspaceId'));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const params = new URLSearchParams({
    select: 'public_id,status,config,created_at,updated_at,widget_id,workspace_id,kind',
    order: 'created_at.desc',
    limit: '50',
    workspace_id: `eq.${workspaceId}`,
  });

  const instRes = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!instRes.ok) {
    const details = await readJson(instRes);
    return json({ error: 'DB_ERROR', details }, { status: 500 });
  }

  const rows = ((await instRes.json()) as InstanceRow[]).filter(Boolean);
  const widgetIds = Array.from(
    new Set(rows.map((row) => row.widget_id).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  );

  const widgetLookup = new Map<string, { type: string | null; name: string | null }>();
  if (widgetIds.length > 0) {
    const widgetParams = new URLSearchParams({
      select: 'id,type,name',
      id: `in.(${widgetIds.join(',')})`,
    });
    const widgetRes = await supabaseFetch(env, `/rest/v1/widgets?${widgetParams.toString()}`, { method: 'GET' });
    if (!widgetRes.ok) {
      const details = await readJson(widgetRes);
      return json({ error: 'DB_ERROR', details }, { status: 500 });
    }
    const widgets = ((await widgetRes.json()) as WidgetRow[]).filter(Boolean);
    widgets.forEach((w) => {
      if (!w?.id) return;
      widgetLookup.set(String(w.id), { type: w.type ?? null, name: w.name ?? null });
    });
  }

  const instances = rows.map((row) => {
    const widget = row.widget_id ? widgetLookup.get(row.widget_id) : undefined;
    return {
      publicId: row.public_id,
      widgetname: widget?.type ?? 'unknown',
      displayName: row.public_id,
      config: row.config,
    };
  });

  return json({ instances });
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

export async function handleCuratedInstances(req: Request, env: Env) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

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

export async function handleGetInstance(req: Request, env: Env, publicId: string) {
  // This is the legacy "publicId-only" instance endpoint.
  // It is used by Venice (public embed runtime) and must be readable without dev auth,
  // but it must never leak drafts.
  //
  // If a valid dev bearer token is provided, allow reading draft/unpublished for dev workflows.
  // Otherwise, treat the request as public and only return published instances.
  const expected = requireEnv(env, 'PARIS_DEV_JWT');
  const token = asBearerToken(req.headers.get('Authorization'));
  const isDev = Boolean(token && token === expected);

  const instance = await loadInstanceByPublicId(env, publicId);
  if (!instance) return json({ error: 'NOT_FOUND' }, { status: 404 });

  const isCurated = resolveInstanceKind(instance) === 'curated';
  if (!isDev && !isCurated && instance.status !== 'published') {
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

  if (!isDev) {
    return json({
      publicId: instance.public_id,
      status: instance.status,
      widgetType,
      config: instance.config,
      updatedAt: instance.updated_at ?? null,
      baseFingerprint,
      policy,
    });
  }

  return json({
    publicId: instance.public_id,
    status: instance.status,
    widgetType,
    config: instance.config,
    updatedAt: instance.updated_at ?? null,
    baseFingerprint,
    policy,
    workspaceId: resolveInstanceWorkspaceId(instance),
  });
}

function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function handleCreateInstance(req: Request, env: Env) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  if (!isRecord(payload)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const issues: Array<{ path: string; message: string }> = [];

  const widgetTypeResult = assertWidgetType((payload as any).widgetType);
  if (!widgetTypeResult.ok) issues.push(...widgetTypeResult.issues);

  const publicIdResult = assertPublicId((payload as any).publicId);
  if (!publicIdResult.ok) issues.push(...publicIdResult.issues);

  const workspaceIdRaw = asTrimmedString((payload as any).workspaceId);
  if (!workspaceIdRaw) {
    issues.push({ path: 'workspaceId', message: 'workspaceId is required' });
  } else if (!isUuid(workspaceIdRaw)) {
    issues.push({ path: 'workspaceId', message: 'workspaceId must be a uuid' });
  }

  const configResult = assertConfig((payload as any).config);
  if (!configResult.ok) issues.push(...configResult.issues);
  if (configResult.ok) issues.push(...configNonPersistableUrlIssues(configResult.value));

  const statusResult = assertStatus((payload as any).status);
  if (!statusResult.ok) issues.push(...statusResult.issues);

  const widgetName = asTrimmedString((payload as any).widgetName);
  const metaResult = (payload as any).meta !== undefined ? assertMeta((payload as any).meta) : { ok: true as const, value: undefined };
  if (!metaResult.ok) {
    issues.push({ path: 'meta', message: 'meta must be an object' });
  }

  if (issues.length) return json(issues, { status: 422 });

  const widgetType = widgetTypeResult.value!;
  const publicId = publicIdResult.value!;
  const workspaceId = workspaceIdRaw as string;
  const config = configResult.value!;
  const workspace = await loadWorkspaceById(env, workspaceId).catch(() => null);
  if (!workspace) return json({ error: 'WORKSPACE_NOT_FOUND' }, { status: 404 });
  const requestedStatus = statusResult.value;
  const meta = metaResult.value;
  const kind = inferInstanceKindFromPublicId(publicId);
  const isCurated = kind === 'curated';

  if (isCurated && requestedStatus === 'unpublished') {
    return json([{ path: 'status', message: 'Curated instances are always published' }], { status: 422 });
  }

  const status = isCurated ? 'published' : requestedStatus ?? 'unpublished';

  if (isCurated && !allowCuratedWrites(env)) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.superadmin.localOnly' }, 403);
  }
  if (!isCurated && (payload as any).meta !== undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const existing = await loadInstanceByPublicId(env, publicId);
  if (existing) {
    const existingWorkspaceId = resolveInstanceWorkspaceId(existing);
    if (!isCurated && existingWorkspaceId && existingWorkspaceId !== workspaceId) {
      return json({ error: 'WORKSPACE_MISMATCH' }, { status: 409 });
    }
    return handleGetInstance(req, env, publicId);
  }

  if (isCurated) {
    const isValidType = await isKnownWidgetType(env, widgetType);
    if (!isValidType) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
    }
    const curatedInsert = await supabaseFetch(env, `/rest/v1/curated_widget_instances`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        public_id: publicId,
        widget_type: widgetType,
        kind: resolveCuratedRowKind(publicId),
        owner_account_id: workspace.account_id,
        status,
        config,
        meta,
      }),
    });
    if (!curatedInsert.ok) {
      const details = await readJson(curatedInsert);
      return json({ error: 'DB_ERROR', details }, { status: 500 });
    }
  } else {
    let widget = await loadWidgetByType(env, widgetType);
    if (!widget) {
      const insertRes = await supabaseFetch(env, `/rest/v1/widgets`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          type: widgetType,
          name: widgetName ?? (titleCase(widgetType) || widgetType),
        }),
      });
      if (!insertRes.ok) {
        const details = await readJson(insertRes);
        return json({ error: 'DB_ERROR', details }, { status: 500 });
      }
      const created = (await insertRes.json().catch(() => null)) as WidgetRow[] | null;
      widget = created?.[0] ?? null;
    }

    if (!widget?.id) {
      return json({ error: 'DB_ERROR', message: 'Failed to resolve widget row' }, { status: 500 });
    }

    const instanceInsert = await supabaseFetch(env, `/rest/v1/widget_instances`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        widget_id: widget.id,
        public_id: publicId,
        workspace_id: workspaceId,
        status,
        config,
        kind,
      }),
    });
    if (!instanceInsert.ok) {
      const details = await readJson(instanceInsert);
      return json({ error: 'DB_ERROR', details }, { status: 500 });
    }
  }

  try {
    await syncAccountAssetUsageForInstance({
      env,
      accountId: workspace.account_id,
      publicId,
      config,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (error instanceof AssetUsageValidationError) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail,
        },
        422,
      );
    }
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail,
      },
      500,
    );
  }

  return handleGetInstance(req, env, publicId);
}

export async function handleUpdateInstance(req: Request, env: Env, publicId: string) {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(url.searchParams.get('workspaceId'));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;
  const workspace = await loadWorkspaceById(env, workspaceId).catch(() => null);
  if (!workspace) return json({ error: 'WORKSPACE_NOT_FOUND' }, { status: 404 });

  let payload: UpdatePayload;
  try {
    payload = (await req.json()) as UpdatePayload;
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  const issues: Array<{ path: string; message: string }> = [];

  const configResult =
    payload.config !== undefined ? assertConfig(payload.config) : { ok: true as const, value: undefined };
  if (!configResult.ok) issues.push(...configResult.issues);
  if (configResult.ok && configResult.value !== undefined) {
    issues.push(...configNonPersistableUrlIssues(configResult.value));
  }

  const statusResult = assertStatus(payload.status);
  if (!statusResult.ok) issues.push(...statusResult.issues);

  if (issues.length) return json(issues, { status: 422 });

  const config = configResult.value;
  const status = statusResult.value;

  if (config === undefined && status === undefined) {
    return json([{ path: 'body', message: 'At least one field (config, status) required' }], {
      status: 422,
    });
  }

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance) return json({ error: 'NOT_FOUND' }, { status: 404 });
  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType) return json({ error: 'WIDGET_NOT_FOUND' }, { status: 500 });

  const isCurated = resolveInstanceKind(instance) === 'curated';
  if (isCurated && !allowCuratedWrites(env)) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.superadmin.localOnly' }, 403);
  }

  if (isCurated && status === 'unpublished') {
    return json([{ path: 'status', message: 'Curated instances are always published' }], { status: 422 });
  }

  if (config !== undefined || status !== undefined) {
    const update: Record<string, unknown> = {};
    if (config !== undefined) update.config = config;
    if (isCurated) {
      update.status = 'published';
      update.owner_account_id = workspace.account_id;
    } else if (status !== undefined) {
      update.status = status;
    }

    const patchPath = isCurated
      ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`
      : `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`;
    const patchRes = await supabaseFetch(env, patchPath, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(update),
    });
    if (!patchRes.ok) {
      const details = await readJson(patchRes);
      return json({ error: 'DB_ERROR', details }, { status: 500 });
    }
  }

  if (config !== undefined) {
    try {
      await syncAccountAssetUsageForInstance({
        env,
        accountId: workspace.account_id,
        publicId,
        config,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (error instanceof AssetUsageValidationError) {
        return ckError(
          {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.payload.invalid',
            detail,
          },
          422,
        );
      }
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail,
        },
        500,
      );
    }
  }

  const prevStatus = instance.status;
  const nextStatus = isCurated ? 'published' : (status ?? prevStatus);
  const statusChanged = isCurated ? prevStatus !== 'published' : (status !== undefined && status !== prevStatus);
  const configChanged = config !== undefined;

  if (nextStatus === 'published' && (statusChanged || configChanged)) {
    const kind = isCurated ? 'curated' : 'user';
    const locales = await resolveSnapshotLocales(env, { workspaceId, kind });
    await enqueueRenderSnapshot(env, {
      v: 1,
      kind: 'render-snapshot',
      publicId,
      action: 'upsert',
      locales,
    });
  } else if (!isCurated && prevStatus === 'published' && nextStatus === 'unpublished') {
    await enqueueRenderSnapshot(env, { v: 1, kind: 'render-snapshot', publicId, action: 'delete' });
  }

  return handleGetInstance(req, env, publicId);
}

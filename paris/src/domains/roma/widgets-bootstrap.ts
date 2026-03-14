import { resolvePolicy } from '@clickeen/ck-policy';
import type { Env, InstanceRow, WidgetRow } from '../../shared/types';
import { authorizeAccount } from '../../shared/account-auth';
import { ckError, errorDetail } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { roleRank } from '../../shared/roles';
import { supabaseFetch } from '../../shared/supabase';
import { formatCuratedDisplayName, readCuratedMeta } from '../../shared/curated-meta';
import { asTrimmedString, assertAccountId } from '../../shared/validation';
import { assertPublicId, isCuratedInstanceRow, isCuratedPublicId } from '../../shared/instances';
import { enqueueTokyoMirrorJob } from '../account-instances/service';
import { loadInstanceByAccountAndPublicId } from '../instances';

type RomaWidgetsInstancePayload = {
  publicId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
  source: 'account' | 'curated';
  actions: {
    edit: boolean;
    duplicate: boolean;
    delete: boolean;
    publish: boolean;
    unpublish: boolean;
  };
};

type AccountPublishContainmentRow = {
  account_id?: unknown;
  reason?: unknown;
};

async function resolveWidgetTypesById(env: Env, widgetIds: string[]): Promise<Map<string, string>> {
  if (widgetIds.length === 0) return new Map();
  const unique = Array.from(new Set(widgetIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) return new Map();
  const widgetParams = new URLSearchParams({
    select: 'id,type',
    id: `in.(${unique.join(',')})`,
    limit: String(unique.length),
  });
  const widgetRes = await supabaseFetch(env, `/rest/v1/widgets?${widgetParams.toString()}`, {
    method: 'GET',
  });
  if (!widgetRes.ok) {
    const details = await readJson(widgetRes);
    throw new Error(
      `[ParisWorker] Failed to load widget rows (${widgetRes.status}): ${JSON.stringify(details)}`,
    );
  }
  const widgetRows = ((await widgetRes.json()) as WidgetRow[] | null) ?? [];
  const map = new Map<string, string>();
  widgetRows.forEach((row) => {
    const id = asTrimmedString(row?.id);
    const type = asTrimmedString(row?.type);
    if (id && type) map.set(id, type);
  });
  return map;
}

async function loadAccountWidgetInstances(
  env: Env,
  accountId: string,
): Promise<RomaWidgetsInstancePayload[]> {
  const params = new URLSearchParams({
    select: 'public_id,status,display_name,widget_id,created_at',
    account_id: `eq.${accountId}`,
    order: 'created_at.desc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load account instances (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows =
    ((await res.json()) as Array<
      Pick<InstanceRow, 'public_id' | 'status' | 'display_name' | 'widget_id'>
    > | null) ?? [];

  const widgetIds = Array.from(
    new Set(
      rows.map((row) => asTrimmedString(row.widget_id)).filter((id): id is string => Boolean(id)),
    ),
  );
  const widgetTypeById = await resolveWidgetTypesById(env, widgetIds);

  return rows.map((row) => {
    const widgetId = asTrimmedString(row.widget_id);
    const widgetType = widgetId ? (widgetTypeById.get(widgetId) ?? 'unknown') : 'unknown';
    const status = row.status === 'published' ? 'published' : 'unpublished';
    return {
      publicId: row.public_id,
      widgetType,
      displayName: asTrimmedString(row.display_name) ?? 'Untitled widget',
      status,
      source: 'account',
      actions: {
        edit: true,
        duplicate: true,
        delete: true,
        rename: true,
        publish: true,
        unpublish: true,
      },
    };
  });
}

type CuratedWidgetInstanceListRow = {
  public_id: string;
  widget_type: string | null;
  status?: 'published' | 'unpublished' | null;
  meta: unknown;
  owner_account_id?: string | null;
};

async function loadOwnedCuratedWidgetInstances(
  env: Env,
  ownerAccountId: string,
): Promise<RomaWidgetsInstancePayload[]> {
  const params = new URLSearchParams({
    select: 'public_id,widget_type,status,meta,owner_account_id',
    owner_account_id: `eq.${ownerAccountId}`,
    order: 'created_at.desc',
    limit: '500',
  });
  const curatedRes = await supabaseFetch(
    env,
    `/rest/v1/curated_widget_instances?${params.toString()}`,
    { method: 'GET' },
  );
  if (!curatedRes.ok) {
    const details = await readJson(curatedRes);
    throw new Error(
      `[ParisWorker] Failed to load curated instances (${curatedRes.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = ((await curatedRes.json()) as CuratedWidgetInstanceListRow[] | null) ?? [];
  return rows.map((row) => {
    const publicId = asTrimmedString(row.public_id) ?? 'unknown';
    const meta = readCuratedMeta(row.meta);
    return {
      publicId,
      widgetType: asTrimmedString(row.widget_type) ?? 'unknown',
      displayName: formatCuratedDisplayName(meta, publicId),
      status: row.status === 'unpublished' ? 'unpublished' : 'published',
      source: 'curated',
      actions: {
        edit: true,
        duplicate: true,
        delete: true,
        rename: false,
        publish: false,
        unpublish: false,
      },
    };
  });
}

async function loadAllWidgetTypes(env: Env): Promise<string[]> {
  const params = new URLSearchParams({
    select: 'type',
    order: 'type.asc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load widget types (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = ((await res.json()) as Array<{ type?: string | null }> | null) ?? [];
  return rows
    .map((row) => asTrimmedString(row.type))
    .filter((type): type is string => Boolean(type))
    .map((type) => type.toLowerCase())
    .sort((a, b) => a.localeCompare(b));
}

async function loadAccountPublishContainment(
  env: Env,
  accountId: string,
): Promise<{ active: boolean; reason: string | null }> {
  const params = new URLSearchParams({
    select: 'account_id,reason',
    account_id: `eq.${accountId}`,
    limit: '1',
  });
  const response = await supabaseFetch(env, `/rest/v1/account_publish_containment?${params.toString()}`, {
    method: 'GET',
  });
  if (!response.ok) {
    const details = await readJson(response);
    throw new Error(
      `[ParisWorker] Failed to load account publish containment (${response.status}): ${JSON.stringify(details)}`,
    );
  }

  const rows = ((await response.json()) as AccountPublishContainmentRow[] | null) ?? [];
  const row = rows[0] ?? null;
  return {
    active: Boolean(asTrimmedString(row?.account_id)),
    reason: asTrimmedString(row?.reason),
  };
}

export async function handleRomaWidgets(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const accountIdResult = assertAccountId(url.searchParams.get('accountId'));
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const policy = resolvePolicy({ profile: authorized.account.tier, role: authorized.role });
  const canMutate = policy.role !== 'viewer';

  let instances: RomaWidgetsInstancePayload[] = [];
  let allWidgetTypes: string[] = [];
  let publishContainment: { active: boolean; reason: string | null } = { active: false, reason: null };
  try {
    const [accountRows, ownedCuratedRows, widgetTypes, containment] = await Promise.all([
      loadAccountWidgetInstances(env, accountId),
      loadOwnedCuratedWidgetInstances(env, accountId),
      loadAllWidgetTypes(env),
      loadAccountPublishContainment(env, accountId),
    ]);
    instances = [...accountRows, ...ownedCuratedRows];
    allWidgetTypes = widgetTypes;
    publishContainment = containment;
  } catch (error) {
    const detail = errorDetail(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const canMutateCurated = canMutate && authorized.account.is_platform === true;

  const actionAware = instances.map((instance) => {
    const isCurated = instance.source === 'curated';
    return {
      ...instance,
      actions: {
        edit: true,
        duplicate: canMutate,
        delete: isCurated ? canMutateCurated : canMutate,
        publish: !isCurated && canMutate && !publishContainment.active,
        unpublish: !isCurated && canMutate && instance.status === 'published',
      },
    };
  });

  const widgetTypeSet = new Set<string>(allWidgetTypes.filter((type) => type !== 'unknown'));
  actionAware.forEach((instance) => {
    if (instance.widgetType !== 'unknown') widgetTypeSet.add(instance.widgetType);
  });

  return json({
    account: {
      accountId: authorized.account.id,
      tier: authorized.account.tier,
      name: authorized.account.name,
      slug: authorized.account.slug,
      role: authorized.role,
      publishContainment: publishContainment.active
        ? {
            active: true,
            reason: publishContainment.reason,
          }
        : {
            active: false,
            reason: null,
          },
    },
    widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
    instances: actionAware,
  });
}

export async function handleRomaTemplates(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const accountIdResult = assertAccountId(url.searchParams.get('accountId'));
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const params = new URLSearchParams({
    select: 'public_id,widget_type,status,meta',
    status: 'eq.published',
    order: 'created_at.desc',
    limit: '500',
  });
  const curatedRes = await supabaseFetch(
    env,
    `/rest/v1/curated_widget_instances?${params.toString()}`,
    { method: 'GET' },
  );
  if (!curatedRes.ok) {
    const details = await readJson(curatedRes);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.readFailed',
        detail: JSON.stringify(details),
      },
      500,
    );
  }
  const rows =
    ((await curatedRes.json()) as Array<{
      public_id?: string;
      widget_type?: string | null;
      meta?: unknown;
    }> | null) ?? [];

  const instances = rows
    .map((row) => {
      const publicId = asTrimmedString(row.public_id);
      if (!publicId) return null;
      const meta = readCuratedMeta(row.meta);
      return {
        publicId,
        widgetType: asTrimmedString(row.widget_type) ?? 'unknown',
        displayName: formatCuratedDisplayName(meta, publicId),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const widgetTypes = Array.from(
    new Set(instances.map((instance) => instance.widgetType).filter((t) => t !== 'unknown')),
  ).sort((a, b) => a.localeCompare(b));

  return json({
    account: {
      accountId: authorized.account.id,
    },
    widgetTypes,
    instances,
  });
}

export async function handleRomaWidgetDelete(
  req: Request,
  env: Env,
  publicIdRaw: string,
): Promise<Response> {
  const publicIdResult = assertPublicId(publicIdRaw);
  if (!publicIdResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);
  }
  const publicId = publicIdResult.value;

  const url = new URL(req.url);
  const accountIdResult = assertAccountId(url.searchParams.get('accountId'));
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  const sourceIsCurated = isCuratedPublicId(publicId);
  if (sourceIsCurated && authorized.account.is_platform !== true) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }

  let existing: Awaited<ReturnType<typeof loadInstanceByAccountAndPublicId>> = null;
  try {
    existing = await loadInstanceByAccountAndPublicId(env, accountId, publicId);
  } catch (error) {
    const detail = errorDetail(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!existing) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  if (sourceIsCurated && isCuratedInstanceRow(existing)) {
    const ownerAccountId = asTrimmedString(existing.owner_account_id) || null;
    if (ownerAccountId !== accountId) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
  }

  let tokyoCleanupQueued = false;
  try {
    const enqueue = await enqueueTokyoMirrorJob(env, {
      v: 1,
      kind: 'delete-instance-mirror',
      publicId,
    });
    tokyoCleanupQueued = enqueue.ok;
    if (!enqueue.ok) {
      console.error('[ParisWorker] tokyo delete-instance-mirror enqueue failed', enqueue.error);
    }
  } catch (error) {
    const detail = errorDetail(error);
    console.error('[ParisWorker] tokyo delete-instance-mirror enqueue failed', detail);
  }

  const deletePath = sourceIsCurated
    ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`
    : `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&account_id=eq.${encodeURIComponent(accountId)}`;
  const deleteRes = await supabaseFetch(env, deletePath, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: JSON.stringify(details),
      },
      500,
    );
  }

  return json(
    {
      accountId,
      publicId,
      source: sourceIsCurated ? 'curated' : 'account',
      deleted: true,
      tokyoCleanupQueued,
    },
    { status: 200 },
  );
}

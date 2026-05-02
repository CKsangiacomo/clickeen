import { classifyWidgetPublicId } from '@clickeen/ck-contracts';
import { type BerlinAccountContext } from './account-state.types';
import { internalError, json } from './http';
import { readSupabaseAdminListAll } from './supabase-admin';
import {
  readSupabaseAdminJson,
  supabaseAdminErrorResponse,
  supabaseAdminFetch,
} from './supabase-admin';
import { type Env } from './types';

const REGISTRY_PAGE_SIZE = 200;

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

type WidgetRow = {
  id?: unknown;
  type?: unknown;
};

type WidgetInstanceRow = {
  public_id?: unknown;
  display_name?: unknown;
  status?: unknown;
  updated_at?: unknown;
  widget_id?: unknown;
  account_id?: unknown;
};

type PublishContainmentRow = {
  account_id?: unknown;
  reason?: unknown;
};

export type BerlinRegistryInstanceRow = {
  publicId: string;
  displayName: string | null;
  updatedAt: string | null;
  widgetId: string;
  accountId: string;
  widgetType: string;
  meta: Record<string, unknown> | null;
};

export type BerlinListedRegistryInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
};

export type BerlinAccountWidgetRegistry = {
  accountPublicIds: string[];
  listedInstances: BerlinListedRegistryInstance[];
  widgetTypes: string[];
  containment: {
    active: boolean;
    reason: string | null;
  };
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function dbReadFailure(response: Response, payload: unknown): Response {
  return supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload);
}

function dbWriteFailure(response: Response, payload: unknown): Response {
  const status = response.status === 409 ? 409 : response.status;
  const reasonKey =
    response.status === 409 ? 'coreui.errors.publicId.conflict' : 'coreui.errors.db.writeFailed';
  return supabaseAdminErrorResponse(reasonKey, status, payload);
}

async function resolveWidgetTypeById(
  env: Env,
  widgetId: string,
): Promise<Result<string>> {
  const params = new URLSearchParams({
    select: 'id,type',
    id: `eq.${widgetId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/widgets?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<WidgetRow[] | Record<string, unknown>>(response);
  if (!response.ok) return { ok: false, response: dbReadFailure(response, payload) };

  const rows = Array.isArray(payload) ? payload : [];
  const widgetType = asTrimmedString(rows[0]?.type);
  if (!widgetType) {
    return {
      ok: false,
      response: internalError('coreui.errors.instance.widgetMissing', 'missing widget type'),
    };
  }
  return { ok: true, value: widgetType };
}

async function resolveWidgetIdByType(
  env: Env,
  widgetType: string,
): Promise<Result<string>> {
  const params = new URLSearchParams({
    select: 'id,type',
    type: `eq.${widgetType}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/widgets?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<WidgetRow[] | Record<string, unknown>>(response);
  if (!response.ok) return { ok: false, response: dbReadFailure(response, payload) };

  const rows = Array.isArray(payload) ? payload : [];
  const widgetId = asTrimmedString(rows[0]?.id);
  if (!widgetId) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.widgetType.invalid',
            detail: `unknown widget type: ${widgetType}`,
          },
        },
        { status: 422 },
      ),
    };
  }
  return { ok: true, value: widgetId };
}

async function loadWidgetCatalog(
  env: Env,
): Promise<Result<{ widgetTypes: Set<string>; widgetTypeById: Map<string, string> }>> {
  const rows = await readSupabaseAdminListAll<WidgetRow>({
    env,
    pathname: '/rest/v1/widgets',
    params: new URLSearchParams({
      select: 'id,type',
      order: 'type.asc,id.asc',
    }),
    pageSize: REGISTRY_PAGE_SIZE,
  });
  if (!rows.ok) return rows;

  const widgetTypes = new Set<string>();
  const widgetTypeById = new Map<string, string>();
  for (const row of rows.value) {
    const id = asTrimmedString(row.id);
    const type = asTrimmedString(row.type);
    if (!type || type === 'unknown') continue;
    const normalized = type.toLowerCase();
    widgetTypes.add(normalized);
    if (id) widgetTypeById.set(id, normalized);
  }
  return { ok: true, value: { widgetTypes, widgetTypeById } };
}

async function loadPublishContainment(
  env: Env,
  accountId: string,
): Promise<Result<{ active: boolean; reason: string | null }>> {
  const params = new URLSearchParams({
    select: 'account_id,reason',
    account_id: `eq.${accountId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(
    env,
    `/rest/v1/account_publish_containment?${params.toString()}`,
    { method: 'GET' },
  );
  const payload = await readSupabaseAdminJson<PublishContainmentRow[] | Record<string, unknown>>(response);
  if (!response.ok) return { ok: false, response: dbReadFailure(response, payload) };

  const rows = Array.isArray(payload) ? payload : [];
  const row = rows[0] ?? null;
  return {
    ok: true,
    value: {
      active: Boolean(asTrimmedString(row?.account_id)),
      reason: asTrimmedString(row?.reason),
    },
  };
}

export async function loadAccountWidgetRegistry(args: {
  env: Env;
  account: BerlinAccountContext;
}): Promise<Result<BerlinAccountWidgetRegistry>> {
  const accountId = args.account.accountId;
  const [accountRows, listedRows, widgetCatalog, containment] = await Promise.all([
    readSupabaseAdminListAll<{ public_id?: unknown }>({
      env: args.env,
      pathname: '/rest/v1/widget_instances',
      params: new URLSearchParams({
        select: 'public_id',
        account_id: `eq.${accountId}`,
        order: 'created_at.desc,public_id.desc',
      }),
      pageSize: REGISTRY_PAGE_SIZE,
    }),
    readSupabaseAdminListAll<WidgetInstanceRow>({
      env: args.env,
      pathname: '/rest/v1/widget_instances',
      params: new URLSearchParams({
        select: 'public_id,display_name,status,updated_at,widget_id,account_id',
        or: '(public_id.like.wgt_main_*,public_id.like.wgt_system_*)',
        order: 'created_at.desc,public_id.desc',
      }),
      pageSize: REGISTRY_PAGE_SIZE,
    }),
    loadWidgetCatalog(args.env),
    loadPublishContainment(args.env, accountId),
  ]);
  if (!accountRows.ok) return accountRows;
  if (!listedRows.ok) return listedRows;
  if (!widgetCatalog.ok) return widgetCatalog;
  if (!containment.ok) return containment;

  const typeSet = new Set(widgetCatalog.value.widgetTypes);
  const accountPublicIds = accountRows.value
    .map((row) => asTrimmedString(row.public_id))
    .filter((publicId): publicId is string => Boolean(publicId));
  const accountPublicIdSet = new Set(accountPublicIds);
  const listedInstances: BerlinListedRegistryInstance[] = listedRows.value.flatMap((row) => {
    const publicId = asTrimmedString(row.public_id);
    if (!publicId) return [];
    const ownerAccountId = asTrimmedString(row.account_id);
    if (ownerAccountId === accountId || accountPublicIdSet.has(publicId)) return [];
    const widgetType =
      widgetCatalog.value.widgetTypeById.get(asTrimmedString(row.widget_id) ?? '') ?? 'unknown';
    if (widgetType !== 'unknown') typeSet.add(widgetType.toLowerCase());
    return [
      {
        publicId,
        widgetType,
        displayName: asTrimmedString(row.display_name) ?? publicId,
        status: row.status === 'published' ? 'published' : 'unpublished',
      },
    ];
  });

  return {
    ok: true,
    value: {
      accountPublicIds,
      listedInstances,
      widgetTypes: Array.from(typeSet).sort((a, b) => a.localeCompare(b)),
      containment: containment.value,
    },
  };
}

export async function getAccountInstanceRegistryRow(args: {
  env: Env;
  account: BerlinAccountContext;
  publicId: string;
}): Promise<Result<BerlinRegistryInstanceRow | null>> {
  const publicIdKind = classifyWidgetPublicId(args.publicId);
  if (!publicIdKind) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail: 'invalid publicId' } },
        { status: 422 },
      ),
    };
  }

  const params = new URLSearchParams({
    select: 'public_id,display_name,updated_at,widget_id,account_id',
    public_id: `eq.${args.publicId}`,
    limit: '1',
  });
  if (publicIdKind === 'user') {
    params.set('account_id', `eq.${args.account.accountId}`);
  } else {
    params.set('or', '(public_id.like.wgt_main_*,public_id.like.wgt_system_*)');
  }
  const response = await supabaseAdminFetch(
    args.env,
    `/rest/v1/widget_instances?${params.toString()}`,
    { method: 'GET' },
  );
  const payload = await readSupabaseAdminJson<WidgetInstanceRow[] | Record<string, unknown>>(response);
  if (!response.ok) return { ok: false, response: dbReadFailure(response, payload) };

  const rows = Array.isArray(payload) ? payload : [];
  const row = rows[0] ?? null;
  if (!row) return { ok: true, value: null };

  const widgetId = asTrimmedString(row.widget_id);
  const accountId = asTrimmedString(row.account_id);
  if (!widgetId || !accountId) {
    return {
      ok: false,
      response: internalError('coreui.errors.instance.invalidPayload', 'invalid widget_instances payload'),
    };
  }

  const widgetType = await resolveWidgetTypeById(args.env, widgetId);
  if (!widgetType.ok) return widgetType;

  return {
    ok: true,
    value: {
      publicId: asTrimmedString(row.public_id) ?? args.publicId,
      displayName: asTrimmedString(row.display_name),
      updatedAt: asTrimmedString(row.updated_at),
      widgetId,
      accountId,
      widgetType: widgetType.value,
      meta: null,
    },
  };
}

export async function createAccountInstanceRegistryRow(args: {
  env: Env;
  account: BerlinAccountContext;
  publicId: string;
  widgetType: string;
  displayName?: string | null;
}): Promise<Result<BerlinRegistryInstanceRow | null>> {
  const publicIdKind = classifyWidgetPublicId(args.publicId);
  if (publicIdKind !== 'user') {
    return {
      ok: false,
      response: json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail: 'invalid publicId' } },
        { status: 422 },
      ),
    };
  }

  const widgetType = asTrimmedString(args.widgetType);
  if (!widgetType) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } },
        { status: 422 },
      ),
    };
  }

  const widgetId = await resolveWidgetIdByType(args.env, widgetType);
  if (!widgetId.ok) return widgetId;

  const response = await supabaseAdminFetch(
    args.env,
    '/rest/v1/widget_instances?select=public_id,display_name,status,updated_at,widget_id,account_id',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        account_id: args.account.accountId,
        widget_id: widgetId.value,
        public_id: args.publicId,
        status: 'unpublished',
        display_name: asTrimmedString(args.displayName) ?? 'Untitled widget',
        config: {},
        kind: 'user',
      }),
    },
  );
  const payload = await readSupabaseAdminJson<WidgetInstanceRow[] | Record<string, unknown>>(response);
  if (!response.ok) return { ok: false, response: dbWriteFailure(response, payload) };

  const rows = Array.isArray(payload) ? payload : [];
  const row = rows[0] ?? null;
  if (!row) return { ok: true, value: null };

  const accountId = asTrimmedString(row.account_id);
  if (!accountId) {
    return {
      ok: false,
      response: internalError('coreui.errors.instance.invalidPayload', 'invalid widget_instances payload'),
    };
  }

  return {
    ok: true,
    value: {
      publicId: asTrimmedString(row.public_id) ?? args.publicId,
      displayName: asTrimmedString(row.display_name),
      updatedAt: asTrimmedString(row.updated_at),
      widgetId: widgetId.value,
      accountId,
      widgetType,
      meta: null,
    },
  };
}

export async function deleteAccountInstanceRegistryRow(args: {
  env: Env;
  account: BerlinAccountContext;
  publicId: string;
}): Promise<Result<void>> {
  const params = new URLSearchParams({
    account_id: `eq.${args.account.accountId}`,
    public_id: `eq.${args.publicId}`,
  });
  const response = await supabaseAdminFetch(
    args.env,
    `/rest/v1/widget_instances?${params.toString()}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );
  if (response.ok) return { ok: true, value: undefined };

  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return { ok: false, response: dbWriteFailure(response, payload) };
}

export async function listAccountInstanceRegistryPublicIds(args: {
  env: Env;
  account: BerlinAccountContext;
}): Promise<Result<string[]>> {
  const rows = await readSupabaseAdminListAll<{ public_id?: unknown }>({
    env: args.env,
    pathname: '/rest/v1/widget_instances',
    params: new URLSearchParams({
      select: 'public_id',
      account_id: `eq.${args.account.accountId}`,
      order: 'created_at.desc,public_id.desc',
    }),
    pageSize: REGISTRY_PAGE_SIZE,
  });
  if (!rows.ok) return rows;

  return {
    ok: true,
    value: rows.value
      .map((row) => asTrimmedString(row.public_id))
      .filter((publicId): publicId is string => Boolean(publicId)),
  };
}

export async function loadAccountPublishContainment(args: {
  env: Env;
  account: BerlinAccountContext;
}): Promise<Result<{ active: boolean; reason: string | null }>> {
  return loadPublishContainment(args.env, args.account.accountId);
}

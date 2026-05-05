import { classifyWidgetPublicId } from '@clickeen/ck-contracts';
import { type BerlinAccountContext } from '../bootstrap/types';
import { internalError, json } from '../http';
import {
  readSupabaseAdminJson,
  supabaseAdminErrorResponse,
  supabaseAdminFetch,
} from '../supabase-admin';
import { type Env } from '../types';

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

type WidgetRow = {
  id?: unknown;
  type?: unknown;
};

type WidgetInstanceProjectionRow = {
  public_id?: unknown;
  display_name?: unknown;
  updated_at?: unknown;
  widget_id?: unknown;
  account_id?: unknown;
};

type PublishContainmentRow = {
  account_id?: unknown;
  reason?: unknown;
};

export type BerlinInstanceProjectionRow = {
  publicId: string;
  displayName: string | null;
  updatedAt: string | null;
  widgetId: string;
  accountId: string;
  widgetType: string;
  meta: Record<string, unknown> | null;
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

export async function createAccountInstanceProjectionRow(args: {
  env: Env;
  account: BerlinAccountContext;
  publicId: string;
  widgetType: string;
  displayName?: string | null;
}): Promise<Result<BerlinInstanceProjectionRow | null>> {
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
    '/rest/v1/widget_instances?select=public_id,display_name,updated_at,widget_id,account_id',
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
  const payload = await readSupabaseAdminJson<WidgetInstanceProjectionRow[] | Record<string, unknown>>(response);
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

export async function deleteAccountInstanceProjectionRow(args: {
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

export async function loadAccountPublishContainment(args: {
  env: Env;
  account: BerlinAccountContext;
}): Promise<Result<{ active: boolean; reason: string | null }>> {
  return loadPublishContainment(args.env, args.account.accountId);
}

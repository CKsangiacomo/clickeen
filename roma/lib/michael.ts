import { resolveBerlinBaseUrl } from './env/berlin';

type MichaelWidgetInstanceRow = {
  public_id?: unknown;
  display_name?: unknown;
  status?: unknown;
  updated_at?: unknown;
  widget_id?: unknown;
  account_id?: unknown;
};

type MichaelWidgetRow = {
  id?: unknown;
  type?: unknown;
};

type MichaelAccountInstanceResult =
  | {
      ok: true;
      row: {
        publicId: string;
        displayName: string | null;
        status: 'published' | 'unpublished';
        updatedAt: string | null;
        widgetId: string;
        accountId: string;
        widgetType: string;
      } | null;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

type MichaelRenameInstanceResult =
  | {
      ok: true;
      row: {
        publicId: string;
        displayName: string | null;
        status: 'published' | 'unpublished';
        updatedAt: string | null;
        widgetId: string;
        accountId: string;
        widgetType: string;
      } | null;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

type MichaelStatusInstanceResult = MichaelRenameInstanceResult;

type MichaelAccountPublishContainmentRow = {
  account_id?: unknown;
  reason?: unknown;
};

type MichaelAccountPublishContainmentResult =
  | {
      ok: true;
      containment: {
        active: boolean;
        reason: string | null;
      };
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

type MichaelPublishedInstanceCountResult =
  | {
      ok: true;
      count: number;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

function resolveMichaelBaseUrl(): string {
  const value = (process.env.SUPABASE_URL || '').trim();
  if (!value) {
    throw new Error('roma.errors.config.supabase_url_missing');
  }
  return value.replace(/\/+$/, '');
}

function resolveMichaelAnonKey(): string {
  const value = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!value) {
    throw new Error('roma.errors.config.supabase_anon_key_missing');
  }
  return value;
}

function encodeFilterValue(value: string): string {
  return encodeURIComponent(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

type MichaelAccessResolution =
  | {
      ok: true;
      accessToken: string;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

async function resolveMichaelAccessToken(berlinAccessToken: string): Promise<MichaelAccessResolution> {
  const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  const headers = new Headers();
  headers.set('authorization', `Bearer ${berlinAccessToken}`);
  headers.set('accept', 'application/json');

  try {
    const response = await fetch(`${berlinBase}/auth/michael/token`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const text = await response.text().catch(() => '');
    const payload = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      const reasonKey =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? String(((payload as { error?: { reasonKey?: unknown } }).error?.reasonKey as string) || 'coreui.errors.auth.required')
          : 'coreui.errors.auth.required';
      return {
        ok: false,
        status: response.status,
        reasonKey,
        detail: text || undefined,
      };
    }
    const token =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? String((payload as { accessToken?: unknown }).accessToken || '').trim()
        : '';
    if (!token) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.auth.required',
        detail: 'missing_michael_access_token',
      };
    }
    return { ok: true, accessToken: token };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.auth.berlin_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getAccountInstanceCoreRow(
  accountId: string,
  publicId: string,
  accessToken: string,
): Promise<MichaelAccountInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(accessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');

    const instanceResponse = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widget_instances?select=public_id,display_name,status,updated_at,widget_id,account_id&account_id=eq.${encodeFilterValue(accountId)}&public_id=eq.${encodeFilterValue(publicId)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const instanceText = await instanceResponse.text().catch(() => '');
    const instancePayload = instanceText ? (JSON.parse(instanceText) as unknown) : null;

    if (!instanceResponse.ok) {
      return {
        ok: false,
        status: instanceResponse.status,
        reasonKey: instanceResponse.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: instanceText || undefined,
      };
    }

    const instanceRows = Array.isArray(instancePayload) ? (instancePayload as MichaelWidgetInstanceRow[]) : [];
    const instanceRow = instanceRows[0] ?? null;
    if (!instanceRow) {
      return { ok: true, row: null };
    }

    const widgetId = asTrimmedString(instanceRow.widget_id);
    const resolvedAccountId = asTrimmedString(instanceRow.account_id);
    if (!widgetId || !resolvedAccountId) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid widget_instances payload',
      };
    }

    const widgetResponse = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widgets?select=id,type&id=eq.${encodeFilterValue(widgetId)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const widgetText = await widgetResponse.text().catch(() => '');
    const widgetPayload = widgetText ? (JSON.parse(widgetText) as unknown) : null;

    if (!widgetResponse.ok) {
      return {
        ok: false,
        status: widgetResponse.status,
        reasonKey: widgetResponse.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: widgetText || undefined,
      };
    }

    const widgetRows = Array.isArray(widgetPayload) ? (widgetPayload as MichaelWidgetRow[]) : [];
    const widgetRow = widgetRows[0] ?? null;
    const widgetType = asTrimmedString(widgetRow?.type);
    if (!widgetType) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.widgetMissing',
        detail: 'missing widget type',
      };
    }

    return {
      ok: true,
      row: {
        publicId: asTrimmedString(instanceRow.public_id) ?? publicId,
        displayName: asTrimmedString(instanceRow.display_name),
        status: instanceRow.status === 'published' ? 'published' : 'unpublished',
        updatedAt: asTrimmedString(instanceRow.updated_at),
        widgetId,
        accountId: resolvedAccountId,
        widgetType,
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function loadAccountPublishContainment(
  accountId: string,
  berlinAccessToken: string,
): Promise<MichaelAccountPublishContainmentResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');

    const response = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/account_publish_containment?select=account_id,reason&account_id=eq.${encodeFilterValue(accountId)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const text = await response.text().catch(() => '');
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey:
          response.status === 401
            ? 'coreui.errors.auth.required'
            : response.status === 403
              ? 'coreui.errors.auth.forbidden'
              : 'coreui.errors.db.readFailed',
        detail: text || undefined,
      };
    }

    const rows = Array.isArray(payload) ? (payload as MichaelAccountPublishContainmentRow[]) : [];
    const row = rows[0] ?? null;

    return {
      ok: true,
      containment: {
        active: Boolean(asTrimmedString(row?.account_id)),
        reason: asTrimmedString(row?.reason),
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function countPublishedAccountInstances(
  accountId: string,
  berlinAccessToken: string,
): Promise<MichaelPublishedInstanceCountResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');
    headers.set('prefer', 'count=exact');

    const response = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widget_instances?select=public_id&account_id=eq.${encodeFilterValue(accountId)}&status=eq.published&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey:
          response.status === 401
            ? 'coreui.errors.auth.required'
            : response.status === 403
              ? 'coreui.errors.auth.forbidden'
              : 'coreui.errors.db.readFailed',
        detail: text || undefined,
      };
    }
    const range = response.headers.get('content-range') || '';
    const match = range.match(/\/(\d+)$/);
    if (match) {
      return { ok: true, count: Number.parseInt(match[1] || '0', 10) };
    }
    const payload = text ? (JSON.parse(text) as unknown) : null;
    const rows = Array.isArray(payload) ? payload : [];
    return { ok: true, count: rows.length };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function renameAccountInstanceRow(args: {
  accountId: string;
  publicId: string;
  displayName: string;
  berlinAccessToken: string;
}): Promise<MichaelRenameInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');
    headers.set('content-type', 'application/json');
    headers.set('prefer', 'return=representation');

    const response = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widget_instances?account_id=eq.${encodeFilterValue(args.accountId)}&public_id=eq.${encodeFilterValue(args.publicId)}&select=public_id,display_name,status,updated_at,widget_id,account_id`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          display_name: args.displayName,
        }),
        cache: 'no-store',
      },
    );
    const text = await response.text().catch(() => '');
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey: response.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.writeFailed',
        detail: text || undefined,
      };
    }

    const rows = Array.isArray(payload) ? (payload as MichaelWidgetInstanceRow[]) : [];
    const row = rows[0] ?? null;
    if (!row) {
      return { ok: true, row: null };
    }

    const widgetId = asTrimmedString(row.widget_id);
    const resolvedAccountId = asTrimmedString(row.account_id);
    if (!widgetId || !resolvedAccountId) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid widget_instances payload',
      };
    }

    const widgetResponse = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widgets?select=id,type&id=eq.${encodeFilterValue(widgetId)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const widgetText = await widgetResponse.text().catch(() => '');
    const widgetPayload = widgetText ? (JSON.parse(widgetText) as unknown) : null;

    if (!widgetResponse.ok) {
      return {
        ok: false,
        status: widgetResponse.status,
        reasonKey: widgetResponse.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: widgetText || undefined,
      };
    }

    const widgetRows = Array.isArray(widgetPayload) ? (widgetPayload as MichaelWidgetRow[]) : [];
    const widgetType = asTrimmedString(widgetRows[0]?.type);
    if (!widgetType) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.widgetMissing',
        detail: 'missing widget type',
      };
    }

    return {
      ok: true,
      row: {
        publicId: asTrimmedString(row.public_id) ?? args.publicId,
        displayName: asTrimmedString(row.display_name),
        status: row.status === 'published' ? 'published' : 'unpublished',
        updatedAt: asTrimmedString(row.updated_at),
        widgetId,
        accountId: resolvedAccountId,
        widgetType,
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateAccountInstanceStatusRow(args: {
  accountId: string;
  publicId: string;
  status: 'published' | 'unpublished';
  berlinAccessToken: string;
}): Promise<MichaelStatusInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');
    headers.set('content-type', 'application/json');
    headers.set('prefer', 'return=representation');

    const response = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widget_instances?account_id=eq.${encodeFilterValue(args.accountId)}&public_id=eq.${encodeFilterValue(args.publicId)}&select=public_id,display_name,status,updated_at,widget_id,account_id`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: args.status,
        }),
        cache: 'no-store',
      },
    );
    const text = await response.text().catch(() => '');
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey: response.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.writeFailed',
        detail: text || undefined,
      };
    }

    const rows = Array.isArray(payload) ? (payload as MichaelWidgetInstanceRow[]) : [];
    const row = rows[0] ?? null;
    if (!row) {
      return { ok: true, row: null };
    }

    const widgetId = asTrimmedString(row.widget_id);
    const resolvedAccountId = asTrimmedString(row.account_id);
    if (!widgetId || !resolvedAccountId) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid widget_instances payload',
      };
    }

    const widgetResponse = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widgets?select=id,type&id=eq.${encodeFilterValue(widgetId)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const widgetText = await widgetResponse.text().catch(() => '');
    const widgetPayload = widgetText ? (JSON.parse(widgetText) as unknown) : null;

    if (!widgetResponse.ok) {
      return {
        ok: false,
        status: widgetResponse.status,
        reasonKey: widgetResponse.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: widgetText || undefined,
      };
    }

    const widgetRows = Array.isArray(widgetPayload) ? (widgetPayload as MichaelWidgetRow[]) : [];
    const widgetType = asTrimmedString(widgetRows[0]?.type);
    if (!widgetType) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.widgetMissing',
        detail: 'missing widget type',
      };
    }

    return {
      ok: true,
      row: {
        publicId: asTrimmedString(row.public_id) ?? args.publicId,
        displayName: asTrimmedString(row.display_name),
        status: row.status === 'published' ? 'published' : 'unpublished',
        updatedAt: asTrimmedString(row.updated_at),
        widgetId,
        accountId: resolvedAccountId,
        widgetType,
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

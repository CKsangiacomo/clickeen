import { classifyWidgetPublicId, isCuratedOrMainWidgetPublicId } from '@clickeen/ck-contracts';
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

type MichaelCuratedInstanceRow = {
  public_id?: unknown;
  status?: unknown;
  updated_at?: unknown;
  widget_type?: unknown;
  owner_account_id?: unknown;
  meta?: unknown;
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
        meta?: Record<string, unknown> | null;
        source?: 'account' | 'curated';
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

type MichaelListedWidgetInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
};

type MichaelAccountWidgetCatalogResult =
  | {
      ok: true;
      accountInstances: MichaelListedWidgetInstance[];
      curatedInstances: MichaelListedWidgetInstance[];
      widgetTypes: string[];
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

type MichaelTemplateCatalogResult =
  | {
      ok: true;
      instances: Array<{
        publicId: string;
        widgetType: string;
        displayName: string;
      }>;
      widgetTypes: string[];
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

type MichaelDeleteInstanceResult =
  | {
      ok: true;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatCuratedDisplayName(meta: unknown, fallback: string): string {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return fallback;
  const record = meta as Record<string, unknown>;
  return asTrimmedString(record.styleName ?? record.name ?? record.title) || fallback;
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

export async function loadAccountWidgetCatalog(args: {
  accountId: string;
  berlinAccessToken: string;
}): Promise<MichaelAccountWidgetCatalogResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');

    const [widgetInstancesResponse, curatedInstancesResponse, widgetsResponse, containmentResponse] =
      await Promise.all([
        fetch(
          `${resolveMichaelBaseUrl()}/rest/v1/widget_instances?select=public_id,display_name,status,widget_id&account_id=eq.${encodeFilterValue(args.accountId)}&order=created_at.desc&limit=500`,
          {
            method: 'GET',
            headers,
            cache: 'no-store',
          },
        ),
        fetch(
          `${resolveMichaelBaseUrl()}/rest/v1/curated_widget_instances?select=public_id,widget_type,status,meta&owner_account_id=eq.${encodeFilterValue(args.accountId)}&order=created_at.desc&limit=500`,
          {
            method: 'GET',
            headers,
            cache: 'no-store',
          },
        ),
        fetch(`${resolveMichaelBaseUrl()}/rest/v1/widgets?select=id,type&order=type.asc&limit=500`, {
          method: 'GET',
          headers,
          cache: 'no-store',
        }),
        fetch(
          `${resolveMichaelBaseUrl()}/rest/v1/account_publish_containment?select=account_id,reason&account_id=eq.${encodeFilterValue(args.accountId)}&limit=1`,
          {
            method: 'GET',
            headers,
            cache: 'no-store',
          },
        ),
      ]);

    const widgetInstancesText = await widgetInstancesResponse.text().catch(() => '');
    const widgetInstancesPayload = widgetInstancesText ? (JSON.parse(widgetInstancesText) as unknown) : null;
    if (!widgetInstancesResponse.ok) {
      return {
        ok: false,
        status: widgetInstancesResponse.status,
        reasonKey:
          widgetInstancesResponse.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: widgetInstancesText || undefined,
      };
    }

    const curatedInstancesText = await curatedInstancesResponse.text().catch(() => '');
    const curatedInstancesPayload = curatedInstancesText ? (JSON.parse(curatedInstancesText) as unknown) : null;
    if (!curatedInstancesResponse.ok) {
      return {
        ok: false,
        status: curatedInstancesResponse.status,
        reasonKey:
          curatedInstancesResponse.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: curatedInstancesText || undefined,
      };
    }

    const widgetsText = await widgetsResponse.text().catch(() => '');
    const widgetsPayload = widgetsText ? (JSON.parse(widgetsText) as unknown) : null;
    if (!widgetsResponse.ok) {
      return {
        ok: false,
        status: widgetsResponse.status,
        reasonKey: widgetsResponse.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: widgetsText || undefined,
      };
    }

    const accountRows = Array.isArray(widgetInstancesPayload)
      ? (widgetInstancesPayload as Array<{ public_id?: unknown; display_name?: unknown; status?: unknown; widget_id?: unknown }>)
      : [];
    const curatedRows = Array.isArray(curatedInstancesPayload)
      ? (curatedInstancesPayload as Array<{ public_id?: unknown; widget_type?: unknown; status?: unknown; meta?: unknown }>)
      : [];
    const widgetRows = Array.isArray(widgetsPayload) ? (widgetsPayload as MichaelWidgetRow[]) : [];

    const widgetTypeById = new Map<string, string>();
    const widgetTypeSet = new Set<string>();
    for (const row of widgetRows) {
      const id = asTrimmedString(row.id);
      const type = asTrimmedString(row.type);
      if (!type || type === 'unknown') continue;
      widgetTypeSet.add(type.toLowerCase());
      if (id) widgetTypeById.set(id, type);
    }

    const accountInstances: MichaelListedWidgetInstance[] = accountRows.map((row) => {
      const widgetId = asTrimmedString(row.widget_id);
      const widgetType = widgetId ? (widgetTypeById.get(widgetId) ?? 'unknown') : 'unknown';
      if (widgetType !== 'unknown') widgetTypeSet.add(widgetType);
      return {
        publicId: asTrimmedString(row.public_id) ?? 'unknown',
        widgetType,
        displayName: asTrimmedString(row.display_name) ?? 'Untitled widget',
        status: row.status === 'published' ? 'published' : 'unpublished',
      };
    });

    const curatedInstances: MichaelListedWidgetInstance[] = curatedRows.map((row) => {
      const publicId = asTrimmedString(row.public_id) ?? 'unknown';
      const widgetType = asTrimmedString(row.widget_type) ?? 'unknown';
      if (widgetType !== 'unknown') widgetTypeSet.add(widgetType);
      return {
        publicId,
        widgetType,
        displayName: formatCuratedDisplayName(row.meta, publicId),
        status: row.status === 'unpublished' ? 'unpublished' : 'published',
      };
    });

    const containmentText = await containmentResponse.text().catch(() => '');
    const containmentPayload = containmentText ? (JSON.parse(containmentText) as unknown) : null;
    const containment =
      containmentResponse.ok && Array.isArray(containmentPayload)
        ? {
            active: Boolean(
              asTrimmedString((containmentPayload[0] as { account_id?: unknown } | undefined)?.account_id),
            ),
            reason: asTrimmedString((containmentPayload[0] as { reason?: unknown } | undefined)?.reason),
          }
        : {
            active: true,
            reason: 'account_publish_containment_unavailable',
          };

    return {
      ok: true,
      accountInstances,
      curatedInstances,
      widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
      containment,
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

export async function loadTemplateCatalog(
  berlinAccessToken: string,
): Promise<MichaelTemplateCatalogResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(berlinAccessToken);
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');

    const response = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/curated_widget_instances?select=public_id,widget_type,meta&status=eq.published&order=created_at.desc&limit=500`,
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
        reasonKey: response.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: text || undefined,
      };
    }

    const rows = Array.isArray(payload)
      ? (payload as Array<{ public_id?: unknown; widget_type?: unknown; meta?: unknown }>)
      : [];
    const widgetTypeSet = new Set<string>();
    const instances = rows
      .map((row) => {
        const publicId = asTrimmedString(row.public_id);
        if (!publicId) return null;
        const widgetType = asTrimmedString(row.widget_type) ?? 'unknown';
        if (widgetType !== 'unknown') widgetTypeSet.add(widgetType);
        return {
          publicId,
          widgetType,
          displayName: formatCuratedDisplayName(row.meta, publicId),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return {
      ok: true,
      instances,
      widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
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

export async function getAccountInstanceCoreRow(
  accountId: string,
  publicId: string,
  accessToken: string,
): Promise<MichaelAccountInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(accessToken);
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');

    if (isCuratedOrMainWidgetPublicId(publicId)) {
      const instanceResponse = await fetch(
        `${resolveMichaelBaseUrl()}/rest/v1/curated_widget_instances?select=public_id,status,updated_at,widget_type,owner_account_id,meta&public_id=eq.${encodeFilterValue(publicId)}&limit=1`,
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

      const instanceRows = Array.isArray(instancePayload) ? (instancePayload as MichaelCuratedInstanceRow[]) : [];
      const instanceRow = instanceRows[0] ?? null;
      if (!instanceRow) {
        return { ok: true, row: null };
      }

      const widgetType = asTrimmedString(instanceRow.widget_type);
      if (!widgetType) {
        return {
          ok: false,
          status: 502,
          reasonKey: 'coreui.errors.instance.invalidPayload',
          detail: 'invalid curated_widget_instances payload',
        };
      }

      return {
        ok: true,
        row: {
          publicId: asTrimmedString(instanceRow.public_id) ?? publicId,
          displayName: asTrimmedString(instanceRow.public_id) ?? publicId,
          status: instanceRow.status === 'published' ? 'published' : 'unpublished',
          updatedAt: asTrimmedString(instanceRow.updated_at),
          widgetId: `curated:${widgetType}`,
          accountId: asTrimmedString(instanceRow.owner_account_id) ?? accountId,
          widgetType,
          meta: isRecord(instanceRow.meta) ? (instanceRow.meta as Record<string, unknown>) : null,
          source: 'curated',
        },
      };
    }

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
        meta: null,
        source: 'account',
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

export async function createAccountInstanceRow(args: {
  accountId: string;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  status?: 'published' | 'unpublished';
  meta?: Record<string, unknown> | null;
  berlinAccessToken: string;
}): Promise<MichaelAccountInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');
    headers.set('content-type', 'application/json');
    headers.set('prefer', 'return=representation');

    const publicIdKind = classifyWidgetPublicId(args.publicId);
    if (!publicIdKind) {
      return {
        ok: false,
        status: 422,
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'invalid publicId',
      };
    }

    if (publicIdKind === 'main' || publicIdKind === 'curated') {
      return {
        ok: false,
        status: 403,
        reasonKey: 'coreui.errors.auth.forbidden',
      };
    }

    const widgetLookupResponse = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widgets?select=id,type&type=eq.${encodeFilterValue(args.widgetType)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const widgetLookupText = await widgetLookupResponse.text().catch(() => '');
    const widgetLookupPayload = widgetLookupText
      ? (JSON.parse(widgetLookupText) as unknown)
      : null;

    if (!widgetLookupResponse.ok) {
      return {
        ok: false,
        status: widgetLookupResponse.status,
        reasonKey:
          widgetLookupResponse.status === 401
            ? 'coreui.errors.auth.required'
            : 'coreui.errors.db.readFailed',
        detail: widgetLookupText || undefined,
      };
    }

    const widgetRows = Array.isArray(widgetLookupPayload)
      ? (widgetLookupPayload as MichaelWidgetRow[])
      : [];
    const widgetId = asTrimmedString(widgetRows[0]?.id);
    if (!widgetId) {
      return {
        ok: false,
        status: 422,
        reasonKey: 'coreui.errors.widgetType.invalid',
        detail: `unknown widget type: ${args.widgetType}`,
      };
    }

    const instanceResponse = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/widget_instances?select=public_id,display_name,status,updated_at,widget_id,account_id`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          account_id: args.accountId,
          widget_id: widgetId,
          public_id: args.publicId,
          status: args.status === 'published' ? 'published' : 'unpublished',
          display_name: asTrimmedString(args.displayName) ?? 'Untitled widget',
          config: {},
          kind: 'user',
        }),
        cache: 'no-store',
      },
    );
    const instanceText = await instanceResponse.text().catch(() => '');
    const instancePayload = instanceText ? (JSON.parse(instanceText) as unknown) : null;

    if (!instanceResponse.ok) {
      return {
        ok: false,
        status: instanceResponse.status,
        reasonKey:
          instanceResponse.status === 401
            ? 'coreui.errors.auth.required'
            : instanceResponse.status === 409
              ? 'coreui.errors.publicId.conflict'
              : 'coreui.errors.db.writeFailed',
        detail: instanceText || undefined,
      };
    }

    const instanceRows = Array.isArray(instancePayload)
      ? (instancePayload as MichaelWidgetInstanceRow[])
      : [];
    const instanceRow = instanceRows[0] ?? null;
    if (!instanceRow) {
      return { ok: true, row: null };
    }

    const resolvedAccountId = asTrimmedString(instanceRow.account_id);
    if (!resolvedAccountId) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid widget_instances payload',
      };
    }

    return {
      ok: true,
      row: {
        publicId: asTrimmedString(instanceRow.public_id) ?? args.publicId,
        displayName: asTrimmedString(instanceRow.display_name),
        status: instanceRow.status === 'published' ? 'published' : 'unpublished',
        updatedAt: asTrimmedString(instanceRow.updated_at),
        widgetId,
        accountId: resolvedAccountId,
        widgetType: args.widgetType,
        meta: null,
        source: 'account',
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

export async function deleteAccountInstanceRow(args: {
  accountId: string;
  publicId: string;
  berlinAccessToken: string;
}): Promise<MichaelDeleteInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');
    headers.set('prefer', 'return=minimal');

    const publicIdKind = classifyWidgetPublicId(args.publicId);
    if (!publicIdKind) {
      return {
        ok: false,
        status: 422,
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'invalid publicId',
      };
    }

    const path =
      publicIdKind === 'main' || publicIdKind === 'curated'
        ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeFilterValue(args.publicId)}`
        : `/rest/v1/widget_instances?account_id=eq.${encodeFilterValue(args.accountId)}&public_id=eq.${encodeFilterValue(args.publicId)}`;

    const response = await fetch(`${resolveMichaelBaseUrl()}${path}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey: response.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.writeFailed',
        detail: text || undefined,
      };
    }

    return { ok: true };
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
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
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
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
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
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
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
    if (michaelAccess.ok === false) {
      return {
        ok: false,
        status: michaelAccess.status,
        reasonKey: michaelAccess.reasonKey,
        detail: michaelAccess.detail,
      };
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

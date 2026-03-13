import { resolveBerlinBaseUrl } from './env/berlin';
import { classifyWidgetPublicId, isCuratedOrMainWidgetPublicId } from '@clickeen/ck-contracts';

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
        meta: Record<string, unknown> | null;
        source: 'account' | 'curated';
      } | null;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

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

type MichaelHeadersResolution =
  | {
      ok: true;
      headers: Headers;
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
    throw new Error('bob.errors.config.supabase_url_missing');
  }
  return value.replace(/\/+$/, '');
}

function resolveMichaelAnonKey(): string {
  const value = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!value) {
    throw new Error('bob.errors.config.supabase_anon_key_missing');
  }
  return value;
}

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
      reasonKey: 'bob.errors.auth.berlin_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolveMichaelHeaders(args: {
  berlinAccessToken: string;
}): Promise<MichaelHeadersResolution> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');
    return { ok: true, headers };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'bob.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
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

export async function getAccountInstanceCoreRow(
  accountId: string,
  publicId: string,
  berlinAccessToken: string,
): Promise<MichaelAccountInstanceResult> {
  try {
    const michaelHeaders = await resolveMichaelHeaders({ berlinAccessToken });
    if (!michaelHeaders.ok) {
      return michaelHeaders;
    }
    const headers = michaelHeaders.headers;

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
      reasonKey: 'bob.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

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
    const michaelHeaders = await resolveMichaelHeaders({
      berlinAccessToken: args.berlinAccessToken,
    });
    if (!michaelHeaders.ok) {
      return michaelHeaders;
    }

    const headers = michaelHeaders.headers;
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
    const widgetLookupPayload = widgetLookupText ? (JSON.parse(widgetLookupText) as unknown) : null;

    if (!widgetLookupResponse.ok) {
      return {
        ok: false,
        status: widgetLookupResponse.status,
        reasonKey:
          widgetLookupResponse.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: widgetLookupText || undefined,
      };
    }

    const widgetRows = Array.isArray(widgetLookupPayload) ? (widgetLookupPayload as MichaelWidgetRow[]) : [];
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

    const instanceRows = Array.isArray(instancePayload) ? (instancePayload as MichaelWidgetInstanceRow[]) : [];
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
      reasonKey: 'bob.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deleteAccountInstanceRow(
  accountId: string,
  publicId: string,
  berlinAccessToken: string,
): Promise<MichaelDeleteInstanceResult> {
  try {
    const michaelHeaders = await resolveMichaelHeaders({
      berlinAccessToken,
    });
    if (!michaelHeaders.ok) {
      return michaelHeaders;
    }

    const headers = michaelHeaders.headers;
    headers.set('prefer', 'return=minimal');

    const publicIdKind = classifyWidgetPublicId(publicId);
    if (!publicIdKind) {
      return {
        ok: false,
        status: 422,
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'invalid publicId',
      };
    }

    let path = `/rest/v1/widget_instances?account_id=eq.${encodeFilterValue(accountId)}&public_id=eq.${encodeFilterValue(publicId)}`;
    if (publicIdKind === 'main' || publicIdKind === 'curated') {
      return {
        ok: false,
        status: 403,
        reasonKey: 'coreui.errors.auth.forbidden',
      };
    }

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
        reasonKey:
          response.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.writeFailed',
        detail: text || undefined,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'bob.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

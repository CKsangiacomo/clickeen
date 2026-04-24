import { resolveBerlinBaseUrl } from './env/berlin';
import { resolveInternalServiceJwt } from './env/internal-service';

export type MichaelWidgetInstanceRow = {
  public_id?: unknown;
  display_name?: unknown;
  updated_at?: unknown;
  widget_id?: unknown;
  account_id?: unknown;
};

export type MichaelWidgetRow = {
  id?: unknown;
  type?: unknown;
};

export type MichaelCuratedInstanceRow = {
  public_id?: unknown;
  updated_at?: unknown;
  widget_type?: unknown;
  owner_account_id?: unknown;
  meta?: unknown;
};

export type MichaelAccountInstanceResult =
  | {
      ok: true;
      row: {
        publicId: string;
        displayName: string | null;
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

export type MichaelAccountPublishContainmentRow = {
  account_id?: unknown;
  reason?: unknown;
};

export type MichaelAccountPublishContainmentResult =
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

export type MichaelAccountInstancePublicIdsResult =
  | {
      ok: true;
      publicIds: string[];
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

export type MichaelListedWidgetInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
};

export type MichaelAccountWidgetCatalogResult =
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

export type MichaelTemplateCatalogResult =
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

export type MichaelDeleteInstanceResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

export type MichaelListResult<T> =
  | {
      ok: true;
      rows: T[];
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

const MICHAEL_LIST_PAGE_SIZE = 200;

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

export function createMichaelHeaders(accessToken: string): Headers {
  const headers = new Headers();
  headers.set('apikey', resolveMichaelAnonKey());
  headers.set('authorization', `Bearer ${accessToken}`);
  headers.set('accept', 'application/json');
  return headers;
}

export function encodeFilterValue(value: string): string {
  return encodeURIComponent(value);
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function formatCuratedDisplayName(meta: unknown, fallback: string): string {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return fallback;
  const record = meta as Record<string, unknown>;
  return asTrimmedString(record.styleName ?? record.name ?? record.title) || fallback;
}

export function parseJsonTextOrNull(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function fetchMichaelListRows<T>(args: {
  headers: Headers;
  pathname: string;
  pageSize?: number;
}): Promise<MichaelListResult<T>> {
  const pageSize = Math.max(1, Math.min(args.pageSize ?? MICHAEL_LIST_PAGE_SIZE, 1000));
  const rows: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const separator = args.pathname.includes('?') ? '&' : '?';
    const response = await fetch(
      `${resolveMichaelBaseUrl()}${args.pathname}${separator}limit=${pageSize}&offset=${offset}`,
      {
        method: 'GET',
        headers: args.headers,
        cache: 'no-store',
      },
    );
    const text = await response.text().catch(() => '');
    const payload = parseJsonTextOrNull(text);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey:
          response.status === 401
            ? 'coreui.errors.auth.required'
            : 'coreui.errors.db.readFailed',
        detail: text || undefined,
      };
    }

    const pageRows = Array.isArray(payload) ? (payload as T[]) : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }

  return { ok: true, rows };
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

export async function resolveMichaelAccessToken(
  berlinAccessToken: string,
): Promise<MichaelAccessResolution> {
  let berlinBase = '';
  let internalToken = '';
  try {
    berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    internalToken = resolveInternalServiceJwt('Roma -> Berlin Michael token bridge');
  } catch (error) {
    return {
      ok: false,
      status: 503,
      reasonKey: 'roma.errors.auth.config_missing',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const headers = new Headers();
  headers.set('authorization', `Bearer ${berlinAccessToken}`);
  headers.set('accept', 'application/json');
  headers.set('x-ck-internal-service', 'roma.edge');
  headers.set('x-ck-internal-token', `Bearer ${internalToken}`);

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
          ? String(
              ((payload as { error?: { reasonKey?: unknown } }).error?.reasonKey as string) ||
                'coreui.errors.auth.required',
            )
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

export function michaelUnavailableResult(error: unknown): {
  ok: false;
  status: 502;
  reasonKey: 'roma.errors.proxy.michael_unavailable';
  detail: string;
} {
  return {
    ok: false,
    status: 502,
    reasonKey: 'roma.errors.proxy.michael_unavailable',
    detail: error instanceof Error ? error.message : String(error),
  };
}

export function resolveMichaelBaseUrlForTests(): string {
  return resolveMichaelBaseUrl();
}

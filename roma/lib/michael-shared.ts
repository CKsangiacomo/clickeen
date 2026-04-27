import { resolveBerlinBaseUrl } from './env/berlin';

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

export type BerlinProductJsonResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

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

export async function fetchBerlinProductJson<T>(args: {
  accessToken: string;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<BerlinProductJsonResult<T>> {
  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  } catch (error) {
    return {
      ok: false,
      status: 503,
      reasonKey: 'roma.errors.auth.config_missing',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const path = args.path.startsWith('/') ? args.path : `/${args.path}`;
  const headers = new Headers();
  headers.set('authorization', `Bearer ${args.accessToken}`);
  headers.set('accept', 'application/json');
  if (args.body !== undefined) {
    headers.set('content-type', 'application/json');
  }

  try {
    const response = await fetch(`${berlinBase}${path}`, {
      method: args.method || 'GET',
      headers,
      cache: 'no-store',
      ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
    });
    const text = await response.text().catch(() => '');
    const payload = parseJsonTextOrNull(text);
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
    return { ok: true, value: payload as T };
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

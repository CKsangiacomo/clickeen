import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

// Roma's direct instance path is the server boundary for one boring product flow: open the saved document from Tokyo and save it back.

export type DirectRouteError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  detail?: string;
  paths?: string[];
};

type RouteFailure = {
  ok: false;
  status: number;
  error: DirectRouteError;
};

export type AccountInstanceCoreRow = {
  publicId: string;
  displayName: string | null;
  updatedAt?: string | null;
  widgetId?: string;
  accountId: string;
  widgetType: string;
  meta?: Record<string, unknown> | null;
  source?: 'account' | 'curated';
};

export type AccountInstanceLiveStatus = 'published' | 'unpublished';

type TokyoSavedInstancePayload = {
  publicId?: unknown;
  accountId?: unknown;
  widgetType?: unknown;
  displayName?: unknown;
  source?: unknown;
  meta?: unknown;
  updatedAt?: unknown;
  config?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

class InvalidSavedInstanceError extends Error {
  reasonKey: string;

  constructor(reasonKey: string, detail?: string) {
    super(detail || reasonKey);
    this.name = 'InvalidSavedInstanceError';
    this.reasonKey = reasonKey;
  }
}

function resolveTokyoControlErrorDetail(
  payload: unknown,
  fallback: string,
): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    const reasonKey = asTrimmedString(payload.error.reasonKey);
    if (reasonKey) return reasonKey;
    const detail = asTrimmedString(payload.error.detail);
    if (detail) return detail;
  }
  return fallback;
}

async function loadSavedInstanceFromTokyo(args: {
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<{ row: AccountInstanceCoreRow; config: Record<string, unknown> } | null> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: `/__internal/renders/instances/${encodeURIComponent(args.publicId)}/saved.json`,
    method: 'GET',
    headers,
    baseUrl: args.tokyoControlBaseUrl,
    accessToken: args.tokyoAccessToken,
  });

  if (response.status === 404) return null;
  const payload = (await response.json().catch(() => null)) as TokyoSavedInstancePayload | null;
  if (!response.ok) {
    throw new Error(resolveTokyoControlErrorDetail(payload, `tokyo_saved_config_http_${response.status}`));
  }
  if (!isRecord(payload?.config)) {
    throw new InvalidSavedInstanceError('coreui.errors.instance.config.invalid');
  }

  const publicId = asTrimmedString(payload?.publicId);
  const accountId = asTrimmedString(payload?.accountId);
  const widgetType = asTrimmedString(payload?.widgetType);
  if (!publicId || !accountId) {
    throw new InvalidSavedInstanceError('coreui.errors.instance.config.invalid');
  }
  if (!widgetType) {
    throw new InvalidSavedInstanceError('coreui.errors.instance.widgetMissing');
  }
  const source = payload?.source === 'account' || payload?.source === 'curated' ? payload.source : undefined;

  return {
    row: {
      publicId,
      displayName: asTrimmedString(payload?.displayName),
      updatedAt: asTrimmedString(payload?.updatedAt),
      accountId,
      widgetType,
      meta: isRecord(payload?.meta) ? (payload.meta as Record<string, unknown>) : null,
      source,
    },
    config: payload.config as Record<string, unknown>,
  };
}

export async function writeSavedConfigToTokyo(args: {
  tokyoBaseUrl: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  widgetType?: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  source?: 'account' | 'curated';
  meta?: Record<string, unknown> | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    contentType: 'application/json',
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: `/__internal/renders/instances/${encodeURIComponent(args.publicId)}/saved.json`,
    method: 'PUT',
    headers,
    baseUrl: args.tokyoControlBaseUrl,
    accessToken: args.tokyoAccessToken,
    body: JSON.stringify({
      ...(args.widgetType ? { widgetType: args.widgetType } : {}),
      config: args.config,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.source ? { source: args.source } : {}),
      ...(args.meta !== undefined ? { meta: args.meta } : {}),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(resolveTokyoControlErrorDetail(payload, `tokyo_saved_config_http_${response.status}`));
  }
}

export async function deleteSavedConfigFromTokyo(args: {
  tokyoBaseUrl: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: `/__internal/renders/instances/${encodeURIComponent(args.publicId)}/saved.json`,
    method: 'DELETE',
    headers,
    baseUrl: args.tokyoControlBaseUrl,
    accessToken: args.tokyoAccessToken,
  });

  if (!response.ok && response.status !== 404) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(
      resolveTokyoControlErrorDetail(payload, `tokyo_saved_config_delete_http_${response.status}`),
    );
  }
}

export async function deleteLiveSurfaceFromTokyo(args: {
  tokyoBaseUrl: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: `/__internal/renders/instances/${encodeURIComponent(args.publicId)}/live.json`,
    method: 'DELETE',
    headers,
    baseUrl: args.tokyoControlBaseUrl,
    accessToken: args.tokyoAccessToken,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(
      resolveTokyoControlErrorDetail(payload, `tokyo_live_surface_delete_http_${response.status}`),
    );
  }
}

export async function updateSavedPointerMetadataInTokyo(args: {
  tokyoBaseUrl: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  displayName?: string | null;
  source?: 'account' | 'curated';
  meta?: Record<string, unknown> | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    contentType: 'application/json',
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: `/__internal/renders/instances/${encodeURIComponent(args.publicId)}/saved.json`,
    method: 'PATCH',
    headers,
    baseUrl: args.tokyoControlBaseUrl,
    accessToken: args.tokyoAccessToken,
    body: JSON.stringify({
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.source !== undefined ? { source: args.source } : {}),
      ...(args.meta !== undefined ? { meta: args.meta } : {}),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(
      resolveTokyoControlErrorDetail(payload, `tokyo_saved_pointer_patch_http_${response.status}`),
    );
  }
}

export async function loadTokyoAccountInstanceDocument<TRow extends AccountInstanceCoreRow>(args: {
  accountId: string;
  publicId: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: { row: TRow; config: Record<string, unknown> };
    }
  | RouteFailure
> {
  let saved: { row: AccountInstanceCoreRow; config: Record<string, unknown> } | null = null;
  try {
    saved = await loadSavedInstanceFromTokyo({
      tokyoControlBaseUrl: args.tokyoControlBaseUrl,
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      internalServiceName: args.internalServiceName,
      accountCapsule: args.accountCapsule,
    });
  } catch (error) {
    if (error instanceof InvalidSavedInstanceError) {
      return {
        ok: false,
        status: 422,
        error: {
          kind: 'VALIDATION',
          reasonKey: error.reasonKey,
          detail: error.message,
        },
      };
    }
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.readFailed',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  if (!saved || saved.row.accountId !== args.accountId) {
    return {
      ok: false,
      status: 404,
      error: {
        kind: 'NOT_FOUND',
        reasonKey: 'coreui.errors.instance.notFound',
      },
    };
  }

  return {
    ok: true,
    value: {
      row: saved.row as TRow,
      config: saved.config,
    },
  };
}

export async function loadTokyoAccountInstanceLiveStatus(args: {
  tokyoBaseUrl: string;
  publicId: string;
}): Promise<
  | { ok: true; value: AccountInstanceLiveStatus }
  | RouteFailure
> {
  try {
    const response = await fetch(
      `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(args.publicId)}/live/r.json`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (!response.ok && response.status !== 404) {
      return {
        ok: false,
        status: 502,
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'coreui.errors.db.readFailed',
          detail: `tokyo_live_pointer_http_${response.status}`,
        },
      };
    }

    return {
      ok: true,
      value: response.status === 404 ? 'unpublished' : 'published',
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.readFailed',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function saveAccountInstanceDirect(args: {
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
  tokyoBaseUrl: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true }
  | RouteFailure
> {
  try {
    await writeSavedConfigToTokyo({
      tokyoBaseUrl: args.tokyoBaseUrl,
      tokyoControlBaseUrl: args.tokyoControlBaseUrl,
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      internalServiceName: args.internalServiceName,
      accountCapsule: args.accountCapsule,
      config: args.config,
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  return { ok: true };
}

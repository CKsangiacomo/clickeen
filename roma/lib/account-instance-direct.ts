import {
  classifyWidgetPublicId,
} from '@clickeen/ck-contracts';
import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

// Roma's direct instance path is the server boundary for one boring product flow: open the saved document from Tokyo, validate the persisted-document contract, and save it back.

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
  status: 'published' | 'unpublished';
  updatedAt?: string | null;
  widgetId?: string;
  accountId: string;
  widgetType: string;
  meta?: Record<string, unknown> | null;
  source?: 'account' | 'curated';
};

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

function normalizeAccountInstanceSource(value: unknown, publicId: string): 'account' | 'curated' {
  if (value === 'account' || value === 'curated') return value;
  const kind = classifyWidgetPublicId(publicId);
  return kind === 'user' ? 'account' : 'curated';
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
  tokyoBaseUrl: string;
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
  if (!isRecord(payload?.config)) return null;

  const liveResponse = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(args.publicId)}/live/r.json`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    },
  );
  if (!liveResponse.ok && liveResponse.status !== 404) {
    throw new Error(`tokyo_live_pointer_http_${liveResponse.status}`);
  }

  const publicId = asTrimmedString(payload?.publicId) ?? args.publicId;
  const accountId = asTrimmedString(payload?.accountId) ?? args.accountId;
  const widgetType = asTrimmedString(payload?.widgetType);
  if (!publicId || !accountId || !widgetType) return null;

  return {
    row: {
      publicId,
      displayName: asTrimmedString(payload?.displayName),
      status: liveResponse.status === 404 ? 'unpublished' : 'published',
      updatedAt: asTrimmedString(payload?.updatedAt),
      accountId,
      widgetType,
      meta: isRecord(payload?.meta) ? (payload.meta as Record<string, unknown>) : null,
      source: normalizeAccountInstanceSource(payload?.source, publicId),
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
  widgetType: string;
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
      widgetType: args.widgetType,
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

export async function loadTokyoPreferredAccountInstance<TRow extends AccountInstanceCoreRow>(args: {
  accountId: string;
  publicId: string;
  tokyoBaseUrl: string;
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
      tokyoBaseUrl: args.tokyoBaseUrl,
      tokyoControlBaseUrl: args.tokyoControlBaseUrl,
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      internalServiceName: args.internalServiceName,
      accountCapsule: args.accountCapsule,
    });
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

export async function saveAccountInstanceDirect(args: {
  accountId: string;
  publicId: string;
  config: unknown;
  tokyoBaseUrl: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        config: Record<string, unknown>;
        changed: boolean;
        instance: {
          widgetType: string;
          status: 'published' | 'unpublished';
          source?: 'account' | 'curated';
        };
        published: boolean;
      };
    }
  | RouteFailure
> {
  const current = await loadTokyoPreferredAccountInstance({
    accountId: args.accountId,
    publicId: args.publicId,
    tokyoBaseUrl: args.tokyoBaseUrl,
    tokyoControlBaseUrl: args.tokyoControlBaseUrl,
    tokyoAccessToken: args.tokyoAccessToken,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });
  if (current.ok === false) {
    return {
      ok: false,
      status: current.status,
      error: current.error,
    };
  }

  if (!isRecord(args.config)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.config.invalid',
        paths: ['config'],
      },
    };
  }
  const nextConfig = args.config as Record<string, unknown>;

  try {
    await writeSavedConfigToTokyo({
      tokyoBaseUrl: args.tokyoBaseUrl,
      tokyoControlBaseUrl: args.tokyoControlBaseUrl,
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      internalServiceName: args.internalServiceName,
      accountCapsule: args.accountCapsule,
      widgetType: current.value.row.widgetType,
      config: nextConfig,
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

  return {
    ok: true,
    value: {
      config: nextConfig,
      changed: true,
      instance: {
        widgetType: current.value.row.widgetType,
        status: current.value.row.status,
        source: current.value.row.source,
      },
      published: current.value.row.status === 'published',
    },
  };
}

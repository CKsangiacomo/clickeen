import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';
import { formatCuratedDisplayName } from './michael-shared';

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

type TokyoServeStatesPayload = {
  serveStates?: unknown;
  publishedCount?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
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

function resolveSavedInstanceDisplayName(args: {
  publicId: string;
  source?: 'account' | 'curated';
  displayName: unknown;
  meta: unknown;
}): string | null {
  if (args.source === 'curated') {
    return formatCuratedDisplayName(args.meta, args.publicId);
  }
  return asTrimmedString(args.displayName);
}

async function loadSavedInstanceFromTokyo(args: {
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: { row: AccountInstanceCoreRow; config: Record<string, unknown> } | null;
    }
  | RouteFailure
> {
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

  if (response.status === 404) {
    return { ok: true, value: null };
  }
  const payload = (await response.json()) as TokyoSavedInstancePayload;
  if (!response.ok) {
    const detail = resolveTokyoControlErrorDetail(payload, `tokyo_saved_config_http_${response.status}`);
    if (response.status === 401) {
      return {
        ok: false,
        status: 401,
        error: {
          kind: 'AUTH',
          reasonKey: detail,
          detail,
        },
      };
    }
    if (response.status === 403) {
      return {
        ok: false,
        status: 403,
        error: {
          kind: 'DENY',
          reasonKey: detail,
          detail,
        },
      };
    }
    if (response.status === 422) {
      return {
        ok: false,
        status: 422,
        error: {
          kind: 'VALIDATION',
          reasonKey: detail,
          detail,
        },
      };
    }
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.readFailed',
        detail,
      },
    };
  }
  const saved = payload as {
    publicId: string;
    accountId: string;
    widgetType: string;
    displayName?: unknown;
    source?: unknown;
    meta?: unknown;
    updatedAt?: unknown;
    config: Record<string, unknown>;
  };
  const source =
    saved.source === 'account' || saved.source === 'curated'
      ? saved.source
      : undefined;

  return {
    ok: true,
    value: {
      row: {
        publicId: saved.publicId,
        displayName: resolveSavedInstanceDisplayName({
          publicId: saved.publicId,
          source,
          displayName: saved.displayName,
          meta: saved.meta,
        }),
        updatedAt: asTrimmedString(saved.updatedAt),
        accountId: saved.accountId,
        widgetType: saved.widgetType,
        meta: isRecord(saved.meta) ? (saved.meta as Record<string, unknown>) : null,
        source,
      },
      config: saved.config,
    },
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
  l10n?: {
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    } | null;
  } | null;
  internalServiceName?: string | null;
}): Promise<{ previousBaseFingerprint: string | null; baseFingerprint: string | null }> {
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
      ...(args.l10n !== undefined ? { l10n: args.l10n } : {}),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: unknown;
        previousBaseFingerprint?: unknown;
        l10n?: { baseFingerprint?: unknown } | null;
      }
    | null;

  if (!response.ok) {
    throw new Error(resolveTokyoControlErrorDetail(payload, `tokyo_saved_config_http_${response.status}`));
  }

  return {
    previousBaseFingerprint: asTrimmedString(payload?.previousBaseFingerprint),
    baseFingerprint: asTrimmedString(payload?.l10n?.baseFingerprint),
  };
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
  const saved = await loadSavedInstanceFromTokyo({
    tokyoControlBaseUrl: args.tokyoControlBaseUrl,
    tokyoAccessToken: args.tokyoAccessToken,
    accountId: args.accountId,
    publicId: args.publicId,
    internalServiceName: args.internalServiceName,
    accountCapsule: args.accountCapsule,
  });
  if (!saved.ok) {
    return saved;
  }

  if (!saved.value) {
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
      row: saved.value.row as TRow,
      config: saved.value.config,
    },
  };
}

export async function loadTokyoAccountInstanceLiveStatus(args: {
  accountId: string;
  publicId: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; value: AccountInstanceLiveStatus }
  | RouteFailure
> {
  const states = await loadTokyoAccountInstanceServeStates({
    accountId: args.accountId,
    publicIds: [args.publicId],
    tokyoControlBaseUrl: args.tokyoControlBaseUrl,
    tokyoAccessToken: args.tokyoAccessToken,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });
  if (!states.ok) {
    return states;
  }

  return {
    ok: true,
    value: states.value.serveStates[args.publicId] ?? 'unpublished',
  };
}

export async function loadTokyoAccountInstanceServeStates(args: {
  accountId: string;
  publicIds: string[];
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        serveStates: Record<string, AccountInstanceLiveStatus>;
        publishedCount: number;
      };
    }
  | RouteFailure
> {
  const publicIds = Array.from(
    new Set(
      args.publicIds
        .map((publicId) => String(publicId || '').trim())
        .filter((publicId) => publicId.length > 0),
    ),
  );
  if (!publicIds.length) {
    return {
      ok: true,
      value: {
        serveStates: {},
        publishedCount: 0,
      },
    };
  }

  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    contentType: 'application/json',
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: '/__internal/renders/instances/serve-state.json',
    method: 'POST',
    headers,
    baseUrl: args.tokyoControlBaseUrl,
    accessToken: args.tokyoAccessToken,
    body: JSON.stringify({ publicIds }),
  });

  const payload = (await response.json().catch(() => null)) as TokyoServeStatesPayload | null;
  if (!response.ok) {
    const detail = resolveTokyoControlErrorDetail(payload, `tokyo_live_status_http_${response.status}`);
    if (response.status === 401) {
      return {
        ok: false,
        status: 401,
        error: {
          kind: 'AUTH',
          reasonKey: detail,
          detail,
        },
      };
    }
    if (response.status === 403) {
      return {
        ok: false,
        status: 403,
        error: {
          kind: 'DENY',
          reasonKey: detail,
          detail,
        },
      };
    }
    if (response.status === 422) {
      return {
        ok: false,
        status: 422,
        error: {
          kind: 'VALIDATION',
          reasonKey: detail,
          detail,
        },
      };
    }
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.readFailed',
        detail,
      },
    };
  }

  const serveStatesRecord =
    payload?.serveStates && typeof payload.serveStates === 'object' && !Array.isArray(payload.serveStates)
      ? (payload.serveStates as Record<string, unknown>)
      : {};

  const serveStates = Object.fromEntries(
    publicIds.map((publicId) => [
      publicId,
      serveStatesRecord[publicId] === 'published' ? 'published' : 'unpublished',
    ]),
  ) as Record<string, AccountInstanceLiveStatus>;

  const publishedCountRaw = payload?.publishedCount;
  const publishedCount =
    typeof publishedCountRaw === 'number' && Number.isFinite(publishedCountRaw)
      ? Math.max(0, Math.floor(publishedCountRaw))
      : Object.values(serveStates).filter((state) => state === 'published').length;

  return {
    ok: true,
    value: {
      serveStates,
      publishedCount,
    },
  };
}

export async function saveAccountInstanceDirect(args: {
  accountId: string;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  source?: 'account' | 'curated';
  meta?: Record<string, unknown> | null;
  l10n?: {
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    } | null;
  } | null;
  tokyoBaseUrl: string;
  tokyoControlBaseUrl?: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; previousBaseFingerprint: string | null; baseFingerprint: string | null }
  | RouteFailure
> {
  try {
    const write = await writeSavedConfigToTokyo({
      tokyoBaseUrl: args.tokyoBaseUrl,
      tokyoControlBaseUrl: args.tokyoControlBaseUrl,
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      internalServiceName: args.internalServiceName,
      accountCapsule: args.accountCapsule,
      widgetType: args.widgetType,
      config: args.config,
      displayName: args.displayName,
      source: args.source,
      meta: args.meta,
      l10n: args.l10n,
    });
    return {
      ok: true,
      previousBaseFingerprint: write.previousBaseFingerprint,
      baseFingerprint: write.baseFingerprint,
    };
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
}

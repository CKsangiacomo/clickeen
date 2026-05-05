import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';
import { validateWidgetConfigContract, type WidgetConfigContractResult } from './widget-config-contract';

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
};

export type AccountInstanceLiveStatus = 'published' | 'unpublished';

export type TokyoAccountInstanceIndexEntry = {
  accountId: string;
  publicId: string;
  widgetType: string;
  displayName: string;
  kind: 'user' | 'system';
  listed: boolean;
  duplicable: boolean;
  listedSurfaces: string[];
  publishStatus: AccountInstanceLiveStatus;
  updatedAt: string;
};

export type TokyoAccountInstanceIndex = {
  accountId: string;
  platformAccountId: string;
  accountInstances: TokyoAccountInstanceIndexEntry[];
  listedInstances: TokyoAccountInstanceIndexEntry[];
  widgetTypes: string[];
  publishedCount: number;
};

type TokyoSavedInstancePayload = {
  publicId?: unknown;
  accountId?: unknown;
  widgetType?: unknown;
  displayName?: unknown;
  meta?: unknown;
  updatedAt?: unknown;
  config?: unknown;
};

type TokyoServeStatesPayload = {
  serveStates?: unknown;
  publishedCount?: unknown;
};

type TokyoAccountInstanceIndexPayload = {
  accountId?: unknown;
  platformAccountId?: unknown;
  accountInstances?: unknown;
  listedInstances?: unknown;
  widgetTypes?: unknown;
  publishedCount?: unknown;
};

type TokyoProjectionGapAction = 'create' | 'delete';

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

function buildTokyoRouteFailure(args: {
  response: Response;
  payload: unknown;
  fallbackDetail: string;
  fallbackReasonKey: string;
}): RouteFailure {
  const detail = resolveTokyoControlErrorDetail(args.payload, args.fallbackDetail);
  if (args.response.status === 401) {
    return { ok: false, status: 401, error: { kind: 'AUTH', reasonKey: detail, detail } };
  }
  if (args.response.status === 403) {
    return { ok: false, status: 403, error: { kind: 'DENY', reasonKey: detail, detail } };
  }
  if (args.response.status === 422) {
    return { ok: false, status: 422, error: { kind: 'VALIDATION', reasonKey: detail, detail } };
  }
  return {
    ok: false,
    status: 502,
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: args.fallbackReasonKey,
      detail,
    },
  };
}

function buildWidgetConfigContractFailure(
  contract: Extract<WidgetConfigContractResult, { ok: false }>,
): RouteFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: contract.reasonKey,
      paths: contract.issues.map((issue) => issue.path),
      detail: contract.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    },
  };
}

function resolveSavedInstanceDisplayName(args: {
  publicId: string;
  displayName: unknown;
  meta: unknown;
}): string | null {
  const displayName = asTrimmedString(args.displayName);
  if (displayName) return displayName;
  if (isRecord(args.meta)) {
    return asTrimmedString(args.meta.styleName ?? args.meta.name ?? args.meta.title) ?? null;
  }
  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => asTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function normalizeTokyoIndexEntry(raw: unknown): TokyoAccountInstanceIndexEntry | null {
  if (!isRecord(raw)) return null;
  const accountId = asTrimmedString(raw.accountId);
  const publicId = asTrimmedString(raw.publicId);
  const widgetType = asTrimmedString(raw.widgetType);
  const displayName = asTrimmedString(raw.displayName);
  const updatedAt = asTrimmedString(raw.updatedAt);
  const kind = raw.kind === 'user' ? 'user' : raw.kind === 'system' ? 'system' : null;
  const publishStatus =
    raw.publishStatus === 'published'
      ? 'published'
      : raw.publishStatus === 'unpublished'
        ? 'unpublished'
        : null;
  if (!accountId || !publicId || !widgetType || !displayName || !updatedAt || !kind || !publishStatus) {
    return null;
  }
  return {
    accountId,
    publicId,
    widgetType,
    displayName,
    kind,
    listed: raw.listed === true,
    duplicable: raw.duplicable === true,
    listedSurfaces: normalizeStringList(raw.listedSurfaces),
    publishStatus,
    updatedAt,
  };
}

function normalizeTokyoIndexEntries(raw: unknown): TokyoAccountInstanceIndexEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw.map((entry) => normalizeTokyoIndexEntry(entry));
  if (entries.some((entry) => !entry)) return null;
  return entries as TokyoAccountInstanceIndexEntry[];
}

async function loadSavedInstanceFromTokyo(args: {
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
  });

  if (response.status === 404) {
    return { ok: true, value: null };
  }
  const payload = (await response.json()) as TokyoSavedInstancePayload;
  if (!response.ok) {
    return buildTokyoRouteFailure({
      response,
      payload,
      fallbackDetail: `tokyo_saved_config_http_${response.status}`,
      fallbackReasonKey: 'coreui.errors.db.readFailed',
    });
  }
  const saved = payload as {
    publicId: string;
    accountId: string;
    widgetType: string;
    displayName?: unknown;
    meta?: unknown;
    updatedAt?: unknown;
    config: Record<string, unknown>;
  };

  return {
    ok: true,
    value: {
      row: {
        publicId: saved.publicId,
        displayName: resolveSavedInstanceDisplayName({
          publicId: saved.publicId,
          displayName: saved.displayName,
          meta: saved.meta,
        }),
        updatedAt: asTrimmedString(saved.updatedAt),
        accountId: saved.accountId,
        widgetType: saved.widgetType,
        meta: isRecord(saved.meta) ? (saved.meta as Record<string, unknown>) : null,
      },
      config: saved.config,
    },
  };
}

export async function writeSavedConfigToTokyo(args: {
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
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
    body: JSON.stringify({
      widgetType: args.widgetType,
      config: args.config,
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
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
  });

  if (!response.ok && response.status !== 404) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(
      resolveTokyoControlErrorDetail(payload, `tokyo_saved_config_delete_http_${response.status}`),
    );
  }
}

export async function deleteLiveSurfaceFromTokyo(args: {
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
  const contract = validateWidgetConfigContract({
    widgetType: saved.value.row.widgetType,
    config: saved.value.config,
  });
  if (!contract.ok) {
    return buildWidgetConfigContractFailure(contract);
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
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; value: AccountInstanceLiveStatus }
  | RouteFailure
> {
  const states = await loadTokyoAccountInstanceServeStates({
    accountId: args.accountId,
    publicIds: [args.publicId],
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
    body: JSON.stringify({ publicIds }),
  });

  const payload = (await response.json().catch(() => null)) as TokyoServeStatesPayload | null;
  if (!response.ok) {
    return buildTokyoRouteFailure({
      response,
      payload,
      fallbackDetail: `tokyo_live_status_http_${response.status}`,
      fallbackReasonKey: 'coreui.errors.db.readFailed',
    });
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

export async function loadTokyoAccountInstanceIndex(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; value: TokyoAccountInstanceIndex }
  | RouteFailure
> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: '/__internal/renders/instances/index.json',
    method: 'GET',
    headers,
  });

  const payload = (await response.json().catch(() => null)) as TokyoAccountInstanceIndexPayload | null;
  if (!response.ok) {
    return buildTokyoRouteFailure({
      response,
      payload,
      fallbackDetail: `tokyo_instance_index_http_${response.status}`,
      fallbackReasonKey: 'coreui.errors.db.readFailed',
    });
  }

  const accountId = asTrimmedString(payload?.accountId);
  const platformAccountId = asTrimmedString(payload?.platformAccountId);
  const accountInstances = normalizeTokyoIndexEntries(payload?.accountInstances);
  const listedInstances = normalizeTokyoIndexEntries(payload?.listedInstances);
  const widgetTypes = normalizeStringList(payload?.widgetTypes).sort((left, right) => left.localeCompare(right));
  const publishedCount =
    typeof payload?.publishedCount === 'number' && Number.isFinite(payload.publishedCount)
      ? Math.max(0, Math.floor(payload.publishedCount))
      : accountInstances?.filter((entry) => entry.publishStatus === 'published').length ?? 0;

  if (!accountId || !platformAccountId || !accountInstances || !listedInstances) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid Tokyo instance index payload',
      },
    };
  }

  return {
    ok: true,
    value: {
      accountId,
      platformAccountId,
      accountInstances,
      listedInstances,
      widgetTypes,
      publishedCount,
    },
  };
}

export async function recordTokyoAccountInstanceProjectionGap(args: {
  accountId: string;
  publicId: string;
  action: TokyoProjectionGapAction;
  reasonKey: string;
  detail?: string | null;
  status?: number | null;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<{ ok: true; gapId: string | null } | RouteFailure> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    contentType: 'application/json',
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: '/__internal/renders/instances/projection-gap.json',
    method: 'POST',
    headers,
    body: JSON.stringify({
      publicId: args.publicId,
      action: args.action,
      reasonKey: args.reasonKey,
      detail: args.detail ?? null,
      status: args.status ?? null,
    }),
  });

  const payload = (await response.json().catch(() => null)) as { gapId?: unknown } | null;
  if (!response.ok) {
    return buildTokyoRouteFailure({
      response,
      payload,
      fallbackDetail: `tokyo_projection_gap_http_${response.status}`,
      fallbackReasonKey: 'coreui.errors.db.writeFailed',
    });
  }

  return { ok: true, gapId: asTrimmedString(payload?.gapId) };
}

export async function saveAccountInstanceDirect(args: {
  accountId: string;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  meta?: Record<string, unknown> | null;
  l10n?: {
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    } | null;
  } | null;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; previousBaseFingerprint: string | null; baseFingerprint: string | null }
  | RouteFailure
> {
  const contract = validateWidgetConfigContract({
    widgetType: args.widgetType,
    config: args.config,
  });
  if (!contract.ok) {
    return buildWidgetConfigContractFailure(contract);
  }

  try {
    const write = await writeSavedConfigToTokyo({
      accountId: args.accountId,
      publicId: args.publicId,
      internalServiceName: args.internalServiceName,
      accountCapsule: args.accountCapsule,
      widgetType: args.widgetType,
      config: args.config,
      displayName: args.displayName,
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

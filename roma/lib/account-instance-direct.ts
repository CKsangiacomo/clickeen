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
  instanceId: string;
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
  instanceId: string;
  widgetType: string;
  displayName: string;
  publishStatus: AccountInstanceLiveStatus;
  updatedAt: string;
};

export type TokyoAccountInstanceIndex = {
  accountId: string;
  accountInstances: TokyoAccountInstanceIndexEntry[];
  publishedCount: number;
};

type TokyoSavedInstancePayload = {
  instanceId?: unknown;
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
  accountInstances?: unknown;
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
  instanceId: string;
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

function normalizeTokyoIndexEntry(raw: unknown): TokyoAccountInstanceIndexEntry | null {
  if (!isRecord(raw)) return null;
  const accountId = asTrimmedString(raw.accountId);
  const instanceId = asTrimmedString(raw.instanceId ?? raw.id);
  const widgetType = asTrimmedString(raw.widgetType);
  const displayName = asTrimmedString(raw.displayName);
  const updatedAt = asTrimmedString(raw.updatedAt);
  const publishStatus =
    raw.publishStatus === 'published'
      ? 'published'
      : raw.publishStatus === 'unpublished'
        ? 'unpublished'
        : null;
  if (!accountId || !instanceId || !widgetType || !displayName || !updatedAt || !publishStatus) {
    return null;
  }
  return {
    accountId,
    instanceId,
    widgetType,
    displayName,
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
  instanceId: string;
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
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
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
    instanceId: string;
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
        instanceId: saved.instanceId,
        displayName: resolveSavedInstanceDisplayName({
          instanceId: saved.instanceId,
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
  instanceId: string;
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
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
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

export async function deleteAccountInstanceFromTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/saved.json`,
    method: 'DELETE',
    headers,
  });

  if (!response.ok && response.status !== 404) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(
      resolveTokyoControlErrorDetail(payload, `tokyo_account_instance_delete_http_${response.status}`),
    );
  }
}

export async function deleteLiveSurfaceFromTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = buildTokyoProductControlHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });

  const response = await fetchTokyoProductControl({
    path: `/__internal/renders/widgets/${encodeURIComponent(args.instanceId)}/live.json`,
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
  instanceId: string;
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
    instanceId: args.instanceId,
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
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  | { ok: true; value: AccountInstanceLiveStatus }
  | RouteFailure
> {
  const states = await loadTokyoAccountInstanceServeStates({
    accountId: args.accountId,
    instanceIds: [args.instanceId],
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
  });
  if (!states.ok) {
    return states;
  }

  return {
    ok: true,
    value: states.value.serveStates[args.instanceId] ?? 'unpublished',
  };
}

export async function loadTokyoAccountInstanceServeStates(args: {
  accountId: string;
  instanceIds: string[];
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
  const instanceIds = Array.from(
    new Set(
      args.instanceIds
        .map((instanceId) => String(instanceId || '').trim())
        .filter((instanceId) => instanceId.length > 0),
    ),
  );
  if (!instanceIds.length) {
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
    path: '/__internal/renders/widgets/serve-state.json',
    method: 'POST',
    headers,
    body: JSON.stringify({ instanceIds }),
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
    instanceIds.map((instanceId) => [
      instanceId,
      serveStatesRecord[instanceId] === 'published' ? 'published' : 'unpublished',
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
    path: '/__internal/renders/widgets/index.json',
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
  const accountInstances = normalizeTokyoIndexEntries(payload?.accountInstances);
  const publishedCount =
    typeof payload?.publishedCount === 'number' && Number.isFinite(payload.publishedCount)
      ? Math.max(0, Math.floor(payload.publishedCount))
      : accountInstances?.filter((entry) => entry.publishStatus === 'published').length ?? 0;

  if (!accountId || !accountInstances) {
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
      accountInstances,
      publishedCount,
    },
  };
}


export async function saveAccountInstanceDirect(args: {
  accountId: string;
  instanceId: string;
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
      instanceId: args.instanceId,
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

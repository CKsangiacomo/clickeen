import {
  classifyWidgetPublicId,
  configAssetUrlContractIssues,
  configNonPersistableUrlIssues,
} from '@clickeen/ck-contracts';
import { stableStringify } from '@clickeen/l10n';

export type DirectRouteError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  detail?: string;
  paths?: string[];
};

export type DirectRouteResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
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

type AftermathPayload = {
  error?: {
    kind?: string;
    reasonKey?: string;
    detail?: string;
    paths?: string[];
  };
};

type AftermathInstanceContext = {
  widgetType: string;
  status: 'published' | 'unpublished';
  source?: 'account' | 'curated';
};

type AftermathResult =
  | { ok: true }
  | { ok: false; status: number; payload: AftermathPayload | null };

export type AftermathWarning = {
  status: number;
  error: DirectRouteError;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
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

export function validatePersistableConfig(
  config: unknown,
  expectedAccountId: string,
): DirectRouteResult<{ config: Record<string, unknown> }> {
  if (!isRecord(config)) {
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

  const nonPersistableIssues = configNonPersistableUrlIssues(config);
  if (nonPersistableIssues.length) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.publish.nonPersistableUrl',
        detail: nonPersistableIssues[0]?.message,
        paths: nonPersistableIssues.map((issue) => issue.path),
      },
    };
  }

  const assetIssues = configAssetUrlContractIssues(config, expectedAccountId);
  if (assetIssues.length) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.publish.nonPersistableUrl',
        detail: assetIssues[0]?.message,
        paths: assetIssues.map((issue) => issue.path),
      },
    };
  }

  return { ok: true, value: { config } };
}

async function loadSavedInstanceFromTokyo(args: {
  tokyoBaseUrl: string;
  tokyoAccessToken: string;
  accountId: string;
  publicId: string;
}): Promise<{ row: AccountInstanceCoreRow; config: Record<string, unknown> } | null> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${args.tokyoAccessToken}`);
  headers.set('x-account-id', args.accountId);
  headers.set('accept', 'application/json');

  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(args.publicId)}/saved.json?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'GET',
      headers,
      cache: 'no-store',
    },
  );

  if (response.status === 404) return null;
  const payload = (await response.json().catch(() => null)) as TokyoSavedInstancePayload | null;
  if (!response.ok) {
    throw new Error(`tokyo_saved_config_http_${response.status}`);
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
  tokyoAccessToken: string;
  accountId: string;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: string | null;
  source?: 'account' | 'curated';
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${args.tokyoAccessToken}`);
  headers.set('x-account-id', args.accountId);
  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');

  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(args.publicId)}/saved.json?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'PUT',
      headers,
      cache: 'no-store',
      body: JSON.stringify({
        widgetType: args.widgetType,
        config: args.config,
        ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
        ...(args.source ? { source: args.source } : {}),
        ...(args.meta !== undefined ? { meta: args.meta } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`tokyo_saved_config_http_${response.status}`);
  }
}

export async function deleteSavedConfigFromTokyo(args: {
  tokyoBaseUrl: string;
  tokyoAccessToken: string;
  accountId: string;
  publicId: string;
}): Promise<void> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${args.tokyoAccessToken}`);
  headers.set('x-account-id', args.accountId);
  headers.set('accept', 'application/json');

  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(args.publicId)}/saved.json?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`tokyo_saved_config_delete_http_${response.status}`);
  }
}

export async function deleteLiveSurfaceFromTokyo(args: {
  tokyoBaseUrl: string;
  tokyoAccessToken: string;
  accountId: string;
  publicId: string;
}): Promise<void> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${args.tokyoAccessToken}`);
  headers.set('x-account-id', args.accountId);
  headers.set('accept', 'application/json');

  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(args.publicId)}/live.json?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`tokyo_live_surface_delete_http_${response.status}`);
  }
}

export async function updateSavedPointerMetadataInTokyo(args: {
  tokyoBaseUrl: string;
  tokyoAccessToken: string;
  accountId: string;
  publicId: string;
  displayName?: string | null;
  source?: 'account' | 'curated';
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${args.tokyoAccessToken}`);
  headers.set('x-account-id', args.accountId);
  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');

  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(args.publicId)}/saved.json?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'PATCH',
      headers,
      cache: 'no-store',
      body: JSON.stringify({
        ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
        ...(args.source !== undefined ? { source: args.source } : {}),
        ...(args.meta !== undefined ? { meta: args.meta } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`tokyo_saved_pointer_patch_http_${response.status}`);
  }
}

async function notifyParisAftermath(args: {
  parisBaseUrl: string;
  parisAccessToken: string;
  authzCapsule?: string | null;
  internalServiceName?: string | null;
  accountId: string;
  publicId: string;
  pathSuffix: string;
  previousConfig: Record<string, unknown>;
  instance: AftermathInstanceContext;
  created?: boolean;
}): Promise<AftermathResult> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${args.parisAccessToken}`);
  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');
  if (args.internalServiceName) {
    headers.set('x-ck-internal-service', args.internalServiceName);
  }
  if (args.authzCapsule) {
    headers.set('x-ck-authz-capsule', args.authzCapsule);
  }

  const response = await fetch(
    `${args.parisBaseUrl.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(args.accountId)}/instances/${encodeURIComponent(args.publicId)}/${args.pathSuffix}`,
    {
      method: 'POST',
      headers,
      cache: 'no-store',
      body: JSON.stringify({
        previousConfig: args.previousConfig,
        widgetType: args.instance.widgetType,
        status: args.instance.status,
        ...(args.instance.source ? { source: args.instance.source } : {}),
        ...(args.created ? { created: true } : {}),
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as AftermathPayload | null;
  if (!response.ok) {
    return { ok: false, status: response.status, payload };
  }
  if (payload?.error) {
    return { ok: false, status: response.status, payload };
  }
  return { ok: true };
}

export async function notifyParisTranslationSync(args: {
  parisBaseUrl: string;
  parisAccessToken: string;
  authzCapsule?: string | null;
  internalServiceName?: string | null;
  accountId: string;
  publicId: string;
  previousConfig: Record<string, unknown>;
  instance: AftermathInstanceContext;
  created?: boolean;
}): Promise<AftermathResult> {
  return notifyParisAftermath({ ...args, pathSuffix: 'sync-translations' });
}

export async function notifyParisPublishedSurfaceSync(args: {
  parisBaseUrl: string;
  parisAccessToken: string;
  authzCapsule?: string | null;
  internalServiceName?: string | null;
  accountId: string;
  publicId: string;
  previousConfig: Record<string, unknown>;
  instance: AftermathInstanceContext;
  created?: boolean;
}): Promise<AftermathResult> {
  return notifyParisAftermath({ ...args, pathSuffix: 'sync-published-surface' });
}

export function normalizeAftermathWarning(args: {
  status: number;
  payload: AftermathPayload | null;
}): AftermathWarning {
  return {
    status: args.status,
    error: args.payload?.error
      ? {
          kind:
            args.payload.error.kind === 'VALIDATION' ||
            args.payload.error.kind === 'AUTH' ||
            args.payload.error.kind === 'DENY' ||
            args.payload.error.kind === 'NOT_FOUND'
              ? args.payload.error.kind
              : 'UPSTREAM_UNAVAILABLE',
          reasonKey: args.payload.error.reasonKey || 'coreui.errors.db.writeFailed',
          detail: args.payload.error.detail,
          paths: args.payload.error.paths,
        }
      : {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'coreui.errors.db.writeFailed',
        },
  };
}

export function mergeAftermathWarnings(warnings: AftermathWarning[]): AftermathWarning | null {
  if (warnings.length === 0) return null;
  if (warnings.length === 1) return warnings[0] || null;

  const [first] = warnings;
  const detail = warnings
    .map((warning) => warning.error.detail || warning.error.reasonKey)
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index)
    .join('\n');

  return {
    status: first?.status ?? 200,
    error: {
      kind: first?.error.kind ?? 'UPSTREAM_UNAVAILABLE',
      reasonKey: first?.error.reasonKey || 'coreui.errors.db.writeFailed',
      detail: detail || first?.error.detail,
      paths: first?.error.paths,
    },
  };
}

export async function runParisSaveAftermath(args: {
  parisBaseUrl: string;
  parisAccessToken: string;
  authzCapsule?: string | null;
  internalServiceName?: string | null;
  accountId: string;
  publicId: string;
  previousConfig: Record<string, unknown>;
  instance: AftermathInstanceContext;
  published: boolean;
  created?: boolean;
}): Promise<AftermathWarning | null> {
  const warnings: AftermathWarning[] = [];
  const tasks: Array<Promise<AftermathResult>> = [
    notifyParisTranslationSync({
      parisBaseUrl: args.parisBaseUrl,
      parisAccessToken: args.parisAccessToken,
      authzCapsule: args.authzCapsule,
      internalServiceName: args.internalServiceName,
      accountId: args.accountId,
      publicId: args.publicId,
      previousConfig: args.previousConfig,
      instance: args.instance,
      created: args.created,
    }),
  ];

  if (args.published) {
    tasks.push(
      notifyParisPublishedSurfaceSync({
        parisBaseUrl: args.parisBaseUrl,
        parisAccessToken: args.parisAccessToken,
        authzCapsule: args.authzCapsule,
        internalServiceName: args.internalServiceName,
        accountId: args.accountId,
        publicId: args.publicId,
        previousConfig: args.previousConfig,
        instance: args.instance,
        created: args.created,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      warnings.push({
        status: 502,
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: result.reason instanceof Error ? result.reason.message : String(result.reason),
        },
      });
      return;
    }
    if (result.value.ok === false) {
      warnings.push(
        normalizeAftermathWarning({
          status: result.value.status,
          payload: result.value.payload,
        }),
      );
    }
  });

  return mergeAftermathWarnings(warnings);
}

export async function loadTokyoPreferredAccountInstance<TRow extends AccountInstanceCoreRow>(args: {
  accountId: string;
  publicId: string;
  tokyoBaseUrl: string;
  tokyoAccessToken: string;
}): Promise<DirectRouteResult<{ row: TRow; config: Record<string, unknown> }>> {
  let saved: { row: AccountInstanceCoreRow; config: Record<string, unknown> } | null = null;
  try {
    saved = await loadSavedInstanceFromTokyo({
      tokyoBaseUrl: args.tokyoBaseUrl,
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
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
  config: Record<string, unknown>;
  tokyoBaseUrl: string;
  tokyoAccessToken: string;
}): Promise<
  DirectRouteResult<{
    config: Record<string, unknown>;
    changed: boolean;
    previousConfig: Record<string, unknown>;
    instance: AftermathInstanceContext;
    published: boolean;
  }>
> {
  const current = await loadTokyoPreferredAccountInstance({
    accountId: args.accountId,
    publicId: args.publicId,
    tokyoBaseUrl: args.tokyoBaseUrl,
    tokyoAccessToken: args.tokyoAccessToken,
  });
  if (current.ok === false) {
    return {
      ok: false,
      status: current.status,
      error: current.error,
    };
  }

  const previousConfig = current.value.config;
  if (stableStringify(previousConfig) === stableStringify(args.config)) {
    return {
      ok: true,
      value: {
        config: previousConfig,
        changed: false,
        previousConfig,
        instance: {
          widgetType: current.value.row.widgetType,
          status: current.value.row.status,
          source: current.value.row.source,
        },
        published: current.value.row.status === 'published',
      },
    };
  }

  try {
    await writeSavedConfigToTokyo({
      tokyoBaseUrl: args.tokyoBaseUrl,
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      widgetType: current.value.row.widgetType,
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

  return {
    ok: true,
    value: {
      config: args.config,
      changed: true,
      previousConfig,
      instance: {
        widgetType: current.value.row.widgetType,
        status: current.value.row.status,
        source: current.value.row.source,
      },
      published: current.value.row.status === 'published',
    },
  };
}

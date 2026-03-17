import {
  classifyWidgetPublicId,
  configAssetUrlContractIssues,
  configNonPersistableUrlIssues,
} from '@clickeen/ck-contracts';
import { stableStringify } from '@clickeen/l10n';
import { buildTokyoProductHeaders } from './tokyo-product-auth';

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

function createTokyoAccountHeaders(args: {
  accountId: string;
  accountCapsule?: string | null;
  contentType?: string | null;
}): Headers {
  return buildTokyoProductHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    contentType: args.contentType,
  });
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
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<{ row: AccountInstanceCoreRow; config: Record<string, unknown> } | null> {
  const headers = createTokyoAccountHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
  });

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
  const headers = createTokyoAccountHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    contentType: 'application/json',
  });

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
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = createTokyoAccountHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
  });

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
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = createTokyoAccountHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
  });

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
  tokyoAccessToken?: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  displayName?: string | null;
  source?: 'account' | 'curated';
  meta?: Record<string, unknown> | null;
  internalServiceName?: string | null;
}): Promise<void> {
  const headers = createTokyoAccountHeaders({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    contentType: 'application/json',
  });

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

export async function loadTokyoPreferredAccountInstance<TRow extends AccountInstanceCoreRow>(args: {
  accountId: string;
  publicId: string;
  tokyoBaseUrl: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<DirectRouteResult<{ row: TRow; config: Record<string, unknown> }>> {
  let saved: { row: AccountInstanceCoreRow; config: Record<string, unknown> } | null = null;
  try {
    saved = await loadSavedInstanceFromTokyo({
      tokyoBaseUrl: args.tokyoBaseUrl,
      accountId: args.accountId,
      publicId: args.publicId,
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
  config: Record<string, unknown>;
  tokyoBaseUrl: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
}): Promise<
  DirectRouteResult<{
    config: Record<string, unknown>;
    changed: boolean;
    previousConfig: Record<string, unknown>;
    instance: {
      widgetType: string;
      status: 'published' | 'unpublished';
      source?: 'account' | 'curated';
    };
    published: boolean;
  }>
> {
  const current = await loadTokyoPreferredAccountInstance({
    accountId: args.accountId,
    publicId: args.publicId,
    tokyoBaseUrl: args.tokyoBaseUrl,
    accountCapsule: args.accountCapsule,
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
      accountId: args.accountId,
      publicId: args.publicId,
      accountCapsule: args.accountCapsule,
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

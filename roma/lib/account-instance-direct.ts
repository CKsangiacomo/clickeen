import { callTokyo, type TokyoCallContext } from './tokyo-client';
import {
  composeConfigWithInstanceContent,
  type AccountInstanceContentDocument,
} from './account-instance-source-artifacts';

// Roma's direct instance path is the server boundary for one boring product flow:
// call Tokyo's named account-instance verbs and surface their result.

export type DirectRouteError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  detail?: string;
  paths?: string[];
  current?: number;
  limit?: number;
};

type RouteFailure = {
  ok: false;
  status: number;
  error: DirectRouteError;
};

export type AccountInstanceStatusTransition = {
  instanceId: string;
  status: AccountInstanceLiveStatus;
  changed: boolean;
};

type AccountInstanceStatusTransitionFailure = RouteFailure;

export type AccountInstanceCoreRow = {
  instanceId: string;
  displayName: string | null;
  updatedAt: string;
  publishedAt: string | null;
  widgetId?: string;
  accountId: string;
  widgetType: string;
  baseLocale: string;
  publishStatus: AccountInstanceLiveStatus;
};

export type AccountInstanceLiveStatus = 'published' | 'unpublished';

export type AccountInstancePublicPackage = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type AccountWidgetInstanceListFact = {
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  publishStatus: AccountInstanceLiveStatus;
  publishedAt: string | null;
  updatedAt: string;
};

export type AccountWidgetInstanceIds = {
  accountId: string;
  instanceIds: string[];
};

export type TokyoWidgetDefinition = {
  widgetType: string;
  displayName: string;
  description: string;
};

function tokyoCallContext(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): TokyoCallContext {
  return {
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    internalServiceName: args.internalServiceName,
    requestId: args.requestId,
  };
}

type TokyoAccountInstancePayload = {
  ok: true;
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  publishStatus: AccountInstanceLiveStatus;
  publishedAt: string | null;
  updatedAt: string;
  baseLocale: string;
  source: {
    config: Record<string, unknown>;
    content: AccountInstanceContentDocument;
  };
};

function composeTokyoAccountInstance(payload: TokyoAccountInstancePayload): {
  row: AccountInstanceCoreRow;
  config: Record<string, unknown>;
  source: {
    config: Record<string, unknown>;
    content: AccountInstanceContentDocument;
  };
} {
  return {
    row: {
      instanceId: payload.instanceId,
      displayName: payload.displayName,
      updatedAt: payload.updatedAt,
      publishedAt: payload.publishedAt,
      accountId: payload.accountId,
      widgetType: payload.widgetType,
      baseLocale: payload.baseLocale,
      publishStatus: payload.publishStatus,
    },
    config: composeConfigWithInstanceContent({
      config: payload.source.config,
      content: payload.source.content,
    }),
    source: payload.source,
  };
}

async function openAccountInstanceFromTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        row: AccountInstanceCoreRow;
        config: Record<string, unknown>;
        source: {
          config: Record<string, unknown>;
          content: AccountInstanceContentDocument;
        };
      };
    }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
    method: 'GET',
    decode: (payload) => payload as TokyoAccountInstancePayload,
    errorDetail: 'tokyo_instance_open_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  return { ok: true, value: composeTokyoAccountInstance(result.value) };
}

export async function createAccountInstanceInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  instanceId: string;
  widgetType: string;
  displayName?: string | null;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  baseLocale: string;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { row: AccountInstanceCoreRow; config: Record<string, unknown> } }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: '/__internal/instances',
    method: 'POST',
    body: {
      instanceId: args.instanceId,
      widgetType: args.widgetType,
      displayName: args.displayName ?? null,
      source: {
        config: args.config,
        content: args.content,
      },
      baseLocale: args.baseLocale,
    },
    decode: (payload) => payload as TokyoAccountInstancePayload,
    errorDetail: 'tokyo_instance_create_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;

  return { ok: true, value: composeTokyoAccountInstance(result.value) };
}

export async function saveAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; updatedAt: string } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
    method: 'PUT',
    body: {
      source: {
        config: args.config,
        content: args.content,
      },
    },
    decode: (payload) => payload as { ok: true; updatedAt: string },
    errorDetail: 'tokyo_instance_save_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  return { ok: true, updatedAt: result.value.updatedAt };
}

async function postInstanceStatusTransition(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
  action: 'publish' | 'unpublish';
  body?: Record<string, unknown>;
}): Promise<
  | { ok: true; value: AccountInstanceStatusTransition }
  | AccountInstanceStatusTransitionFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/${args.action}`,
    method: 'POST',
    body: args.body ?? {},
    decode: (payload) =>
      payload as {
        instanceId: string;
        status: AccountInstanceLiveStatus;
        changed: boolean;
      },
    errorDetail: `tokyo_instance_${args.action}_http_error`,
    errorKey: 'roma.errors.proxy.tokyo_unavailable',
  });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: result.error,
    };
  }
  return { ok: true, value: result.value };
}

export async function publishAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  sourceUpdatedAt: string;
  publishedLimit: number;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
  publicPackage: AccountInstancePublicPackage;
}): Promise<
  | { ok: true; value: { instanceId: string; status: 'published'; changed: boolean } }
  | AccountInstanceStatusTransitionFailure
> {
  const result = await postInstanceStatusTransition({
    ...args,
    action: 'publish',
    body: {
      sourceUpdatedAt: args.sourceUpdatedAt,
      publishedLimit: args.publishedLimit,
      publicPackage: args.publicPackage,
    },
  });
  if (!result.ok) return result;
  return result as {
    ok: true;
    value: { instanceId: string; status: 'published'; changed: boolean };
  };
}

export async function unpublishAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { instanceId: string; status: 'unpublished'; changed: boolean } }
  | AccountInstanceStatusTransitionFailure
> {
  const result = await postInstanceStatusTransition({
    ...args,
    action: 'unpublish',
  });
  if (!result.ok) return result;
  return result as {
    ok: true;
    value: { instanceId: string; status: 'unpublished'; changed: boolean };
  };
}

export async function deleteAccountInstanceFromTokyo(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { existed: boolean } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
    method: 'DELETE',
    decode: (payload) => payload as { ok: true; existed: boolean },
    errorDetail: 'tokyo_account_instance_delete_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  return { ok: true, value: { existed: result.value.existed } };
}

export async function loadTokyoAccountInstanceDocument<TRow extends AccountInstanceCoreRow>(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | {
      ok: true;
      value: {
        row: TRow;
        config: Record<string, unknown>;
        source: {
          config: Record<string, unknown>;
          content: AccountInstanceContentDocument;
        };
      };
    }
  | RouteFailure
> {
  const saved = await openAccountInstanceFromTokyo(args);
  if (!saved.ok) return saved;
  return {
    ok: true,
    value: {
      row: saved.value.row as TRow,
      config: saved.value.config,
      source: saved.value.source,
    },
  };
}

export async function listAccountWidgetInstanceIds(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountWidgetInstanceIds } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/instances`,
    method: 'GET',
    decode: (payload) => payload as { ok: true } & AccountWidgetInstanceIds,
    errorDetail: 'tokyo_account_instance_ids_list_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  return {
    ok: true,
    value: {
      accountId: result.value.accountId,
      instanceIds: result.value.instanceIds,
    },
  };
}

export async function loadAccountWidgetInstanceListFact(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountWidgetInstanceListFact } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/list-facts`,
    method: 'GET',
    decode: (payload) => payload as { ok: true } & AccountWidgetInstanceListFact,
    errorDetail: 'tokyo_account_instance_list_fact_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  return { ok: true, value: result.value };
}

export async function loadAccountWidgetInstanceFacts(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: { accountId: string; instances: AccountWidgetInstanceListFact[] } }
  | RouteFailure
> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/instances/list-facts`,
    method: 'GET',
    decode: (payload) =>
      payload as {
        ok: true;
        accountId: string;
        instances: AccountWidgetInstanceListFact[];
      },
    errorDetail: 'tokyo_account_instance_facts_list_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      accountId: result.value.accountId,
      instances: result.value.instances,
    },
  };
}

export async function listTokyoWidgetDefinitions(args: {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { widgetDefinitions: TokyoWidgetDefinition[] } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: '/__internal/widgets/definitions',
    method: 'GET',
    decode: (payload) =>
      payload as { ok: true; widgetDefinitions: TokyoWidgetDefinition[] },
    errorDetail: 'tokyo_widget_definitions_http_error',
    errorKey: 'coreui.errors.db.readFailed',
  });
  if (!result.ok) return result;

  return { ok: true, value: { widgetDefinitions: result.value.widgetDefinitions } };
}

export async function renameAccountInstanceInTokyo(args: {
  accountId: string;
  instanceId: string;
  displayName: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { instanceId: string; displayName: string; updatedAt: string } } | RouteFailure> {
  const result = await callTokyo(tokyoCallContext(args), {
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/rename`,
    method: 'POST',
    body: {
      displayName: args.displayName,
    },
    decode: (payload) =>
      payload as { ok: true; instanceId: string; displayName: string; updatedAt: string },
    errorDetail: 'tokyo_instance_rename_http_error',
    errorKey: 'coreui.errors.db.writeFailed',
  });
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      instanceId: result.value.instanceId,
      displayName: result.value.displayName,
      updatedAt: result.value.updatedAt,
    },
  };
}

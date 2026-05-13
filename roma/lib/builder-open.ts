import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceServeStates,
  type AccountInstanceLiveStatus,
} from './account-instance-direct';

export type BuilderOpenEnvelope = {
  instanceId: string;
  displayName: string;
  widgetType: string;
  publishStatus: AccountInstanceLiveStatus;
  config: Record<string, unknown>;
  meta?: Record<string, unknown> | null;
};

export async function loadBuilderOpenEnvelope(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: BuilderOpenEnvelope }
  | {
      ok: false;
      status: number;
      error: {
        kind: 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE' | 'VALIDATION';
        reasonKey: string;
        detail?: string;
      };
    }
> {
  const instance = await loadTokyoAccountInstanceDocument({
    accountId: args.accountId,
    instanceId: args.instanceId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!instance.ok) {
    console.error(
      JSON.stringify({
        event: 'builder.open.tokyo_read_failed',
        accountId: args.accountId,
        instanceId: args.instanceId,
        status: instance.status,
        error: instance.error,
      }),
    );
    return instance;
  }

  const serveState = await loadTokyoAccountInstanceServeStates({
    accountId: args.accountId,
    instanceIds: [instance.value.row.instanceId],
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!serveState.ok) {
    console.error(
      JSON.stringify({
        event: 'builder.open.tokyo_serve_state_failed',
        accountId: args.accountId,
        instanceId: args.instanceId,
        status: serveState.status,
        error: serveState.error,
      }),
    );
    return serveState;
  }

  return {
    ok: true,
    value: {
      instanceId: instance.value.row.instanceId,
      displayName: instance.value.row.displayName || 'Untitled widget',
      widgetType: instance.value.row.widgetType,
      publishStatus: serveState.value.serveStates[instance.value.row.instanceId],
      config: instance.value.config,
      meta: instance.value.row.meta,
    },
  };
}

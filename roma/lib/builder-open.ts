import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceServeStates,
  type AccountInstanceLiveStatus,
} from './account-instance-direct';

export type BuilderOpenEnvelope = {
  instanceId: string;
  displayName: string;
  widgetType: string;
  config: Record<string, unknown>;
  publishStatus: AccountInstanceLiveStatus;
  meta?: Record<string, unknown> | null;
};

export async function loadBuilderOpenEnvelope(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
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
  });
  if (!instance.ok) {
    return instance;
  }
  const serveState = await loadTokyoAccountInstanceServeStates({
    accountId: args.accountId,
    instanceIds: [args.instanceId],
    accountCapsule: args.accountCapsule,
  });
  if (!serveState.ok) {
    return serveState;
  }

  return {
    ok: true,
    value: {
      instanceId: instance.value.row.instanceId,
      displayName: instance.value.row.displayName || 'Untitled widget',
      widgetType: instance.value.row.widgetType,
      config: instance.value.config,
      publishStatus: serveState.value.serveStates[instance.value.row.instanceId] ?? 'unpublished',
      meta: instance.value.row.meta,
    },
  };
}

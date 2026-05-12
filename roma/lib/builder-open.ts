import {
  loadTokyoAccountInstanceDocument,
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

  const publishStatus = instance.value.row.publishStatus;
  if (publishStatus !== 'published' && publishStatus !== 'unpublished') {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'Tokyo saved instance payload is missing publishStatus.',
      },
    };
  }

  return {
    ok: true,
    value: {
      instanceId: instance.value.row.instanceId,
      displayName: instance.value.row.displayName || 'Untitled widget',
      widgetType: instance.value.row.widgetType,
      config: instance.value.config,
      publishStatus,
      meta: instance.value.row.meta,
    },
  };
}

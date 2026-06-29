import {
  loadTokyoAccountInstanceDocument,
} from './account-instance-direct';
import {
  loadAccountWidgetDefaultsInTokyo,
  type AccountWidgetDefaultsDocument,
} from './account-widget-defaults-direct';

export type BuilderOpenEnvelope = {
  instanceId: string;
  displayName: string;
  widgetType: string;
  config: Record<string, unknown>;
  fontLibrary: AccountWidgetDefaultsDocument['fontLibrary'];
  publishStatus?: 'published' | 'unpublished';
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

  const widgetDefaults = await loadAccountWidgetDefaultsInTokyo({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!widgetDefaults.ok) {
    console.error(
      JSON.stringify({
        event: 'builder.open.widget_defaults_read_failed',
        accountId: args.accountId,
        instanceId: args.instanceId,
        status: widgetDefaults.status,
        error: widgetDefaults.error,
      }),
    );
    return widgetDefaults;
  }

  return {
    ok: true,
    value: {
      instanceId: instance.value.row.instanceId,
      displayName: instance.value.row.displayName || 'Untitled widget',
      widgetType: instance.value.row.widgetType,
      config: instance.value.config,
      fontLibrary: widgetDefaults.value.widgetDefaults.fontLibrary,
      publishStatus: instance.value.row.publishStatus,
    },
  };
}

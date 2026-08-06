import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstancePublicPackage,
  type AccountInstancePublicPackage,
} from './account-instance-direct';
import {
  loadAccountWidgetDefaultsInTokyo,
  type AccountWidgetDefaultsDocument,
} from './account-widget-defaults-direct';

export type BuilderOpenEnvelope = {
  instanceId: string;
  displayName: string;
  widgetType: string;
  isTemplate: boolean;
  config: Record<string, unknown>;
  publicPackage: AccountInstancePublicPackage;
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
  const [instance, publicPackage, widgetDefaults] = await Promise.all([
    loadTokyoAccountInstanceDocument({
      accountId: args.accountId,
      instanceId: args.instanceId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    }),
    loadTokyoAccountInstancePublicPackage({
      accountId: args.accountId,
      instanceId: args.instanceId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    }),
    loadAccountWidgetDefaultsInTokyo({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    }),
  ]);
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

  if (!publicPackage.ok) {
    console.error(
      JSON.stringify({
        event: 'builder.open.public_package_read_failed',
        accountId: args.accountId,
        instanceId: args.instanceId,
        status: publicPackage.status,
        error: publicPackage.error,
      }),
    );
    return publicPackage;
  }

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
      isTemplate: instance.value.row.isTemplate,
      config: instance.value.config,
      publicPackage: publicPackage.value.publicPackage,
      fontLibrary: widgetDefaults.value.widgetDefaults.fontLibrary,
      publishStatus: instance.value.row.publishStatus,
    },
  };
}

import { readWidgetMaterializerArtifact } from '@roma/generated/widget-materializer-artifacts';
import { loadTokyoAccountInstanceDocument } from './account-instance-direct';
import {
  loadAccountWidgetDefaultsInTokyo,
  type AccountWidgetDefaultsDocument,
} from './account-widget-defaults-direct';

export type BuilderOpenEnvelope = {
  instanceId: string;
  displayName: string | null;
  widgetType: string;
  baseLocale: string;
  config: Record<string, unknown>;
  fontLibrary: AccountWidgetDefaultsDocument['fontLibrary'];
  publishStatus: 'published' | 'unpublished';
  publishedAt: string | null;
  sourceUpdatedAt: string | null;
};

export type NewBuilderOpenEnvelope = {
  instanceId: null;
  displayName: null;
  widgetType: string;
  baseLocale: string;
  config: Record<string, unknown>;
  fontLibrary: AccountWidgetDefaultsDocument['fontLibrary'];
  publishStatus: null;
  publishedAt: null;
  sourceUpdatedAt: null;
};

function mergeDefaultsInto(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      mergeDefaultsInto(existing as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }
    target[key] = structuredClone(value);
  }
}

function composeNewInstanceConfig(args: {
  common: Record<string, unknown>;
  core: Record<string, unknown>;
}): Record<string, unknown> {
  const config = structuredClone(args.common);
  mergeDefaultsInto(config, args.core);
  return config;
}

export async function loadNewBuilderOpenEnvelope(args: {
  accountId: string;
  widgetType: string;
  baseLocale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: NewBuilderOpenEnvelope }
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
  const [materializer, widgetDefaults] = await Promise.all([
    readWidgetMaterializerArtifact(args.widgetType),
    loadAccountWidgetDefaultsInTokyo({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    }),
  ]);
  if (!widgetDefaults.ok) return widgetDefaults;

  if (!materializer) {
    return {
      ok: false,
      status: 404,
      error: {
        kind: 'NOT_FOUND',
        reasonKey: 'coreui.errors.instance.widgetMissing',
      },
    };
  }

  return {
    ok: true,
    value: {
      instanceId: null,
      displayName: null,
      widgetType: materializer.widgetname,
      baseLocale: args.baseLocale,
      config: composeNewInstanceConfig({
        common: widgetDefaults.value.widgetDefaults.common,
        core: Object.prototype.hasOwnProperty.call(
          widgetDefaults.value.widgetDefaults.widgets,
          args.widgetType,
        )
          ? widgetDefaults.value.widgetDefaults.widgets[args.widgetType]!.core
          : materializer.coreDefaults,
      }),
      fontLibrary: widgetDefaults.value.widgetDefaults.fontLibrary,
      publishStatus: null,
      publishedAt: null,
      sourceUpdatedAt: null,
    },
  };
}

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
  const [instance, widgetDefaults] = await Promise.all([
    loadTokyoAccountInstanceDocument({
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
      displayName: instance.value.row.displayName,
      widgetType: instance.value.row.widgetType,
      baseLocale: instance.value.row.baseLocale,
      config: instance.value.config,
      fontLibrary: widgetDefaults.value.widgetDefaults.fontLibrary,
      publishStatus: instance.value.row.publishStatus,
      publishedAt: instance.value.row.publishedAt,
      sourceUpdatedAt: instance.value.row.updatedAt,
    },
  };
}

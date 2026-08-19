import {
  listTokyoWidgetDefinitions,
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
  baseLocale: string;
  config: Record<string, unknown>;
  fontLibrary: AccountWidgetDefaultsDocument['fontLibrary'];
  publishStatus: 'published' | 'unpublished';
  publishedAt: string | null;
  sourceUpdatedAt: string | null;
};

export type NewBuilderOpenEnvelope = {
  instanceId: null;
  displayName: string;
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
  const [definitions, widgetDefaults] = await Promise.all([
    listTokyoWidgetDefinitions({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    }),
    loadAccountWidgetDefaultsInTokyo({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    }),
  ]);
  if (!definitions.ok) return definitions;
  if (!widgetDefaults.ok) return widgetDefaults;

  const definition = definitions.value.widgetDefinitions.find(
    (entry) => entry.widgetType === args.widgetType,
  );
  const defaults = widgetDefaults.value.widgetDefaults.widgets[args.widgetType];
  if (!definition || !defaults) {
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
      displayName: 'Untitled widget',
      widgetType: definition.widgetType,
      baseLocale: args.baseLocale,
      config: composeNewInstanceConfig({
        common: widgetDefaults.value.widgetDefaults.common,
        core: defaults.core,
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
      displayName: instance.value.row.displayName || 'Untitled widget',
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

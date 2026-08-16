import { isRecord } from '@clickeen/ck-contracts';
import {
  createDefaultAccountFontLibrary,
  COMMON_WIDGET_FACTORY_DEFAULTS,
} from '@clickeen/widget-foundation';
import {
  readWidgetForInstancePackage,
  type InstancePackageFailure,
} from './account-instance-public-package';
import type { AccountWidgetDefaultsDocument } from './account-widget-defaults-direct';

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function validationFailure(reasonKey: string, detail?: string): InstancePackageFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey,
      ...(detail ? { detail } : {}),
    },
  };
}

export async function materializeInitialAccountWidgetDefaults(args: {
  accountId: string;
  widgetTypes: string[];
  now?: string;
}): Promise<{ ok: true; widgetDefaults: AccountWidgetDefaultsDocument } | InstancePackageFailure> {
  const now = args.now ?? new Date().toISOString();
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const widgetType of args.widgetTypes) {
    const compiled = readWidgetForInstancePackage(widgetType);
    if (!compiled.ok) return compiled;
    const defaults = compiled.value.coreDefaults;
    if (!isRecord(defaults)) {
      return validationFailure(
        'coreui.errors.widget.compiled.invalid',
        `missing resolved product widget defaults for ${widgetType}`,
      );
    }
    try {
      widgets[widgetType] = { core: cloneRecord(defaults) };
    } catch (error) {
      return validationFailure(
        'coreui.errors.widget.compiled.invalid',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const widgetDefaults: AccountWidgetDefaultsDocument = {
    accountId: args.accountId,
    fontLibrary: createDefaultAccountFontLibrary(),
    common: cloneRecord(COMMON_WIDGET_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
    widgets,
    seededAt: now,
    updatedAt: now,
  };
  return {
    ok: true,
    widgetDefaults,
  };
}

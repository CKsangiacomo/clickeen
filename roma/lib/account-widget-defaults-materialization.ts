import {
  createDefaultAccountFontLibrary,
  COMMON_WIDGET_FACTORY_DEFAULTS,
} from '@clickeen/widget-foundation';
import type { AccountWidgetDefaultsDocument } from './account-widget-defaults-direct';

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value);
}

export async function materializeInitialAccountWidgetDefaults(args: {
  accountId: string;
  now?: string;
}): Promise<{ ok: true; widgetDefaults: AccountWidgetDefaultsDocument }> {
  const now = args.now ?? new Date().toISOString();

  const widgetDefaults: AccountWidgetDefaultsDocument = {
    accountId: args.accountId,
    fontLibrary: createDefaultAccountFontLibrary(),
    common: cloneRecord(COMMON_WIDGET_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
    widgets: {},
    seededAt: now,
    updatedAt: now,
  };
  return {
    ok: true,
    widgetDefaults,
  };
}

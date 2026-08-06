import {
  createDefaultAccountFontLibrary,
  WIDGET_SHELL_FACTORY_DEFAULTS,
} from '@clickeen/widget-shell';
import type { NextRequest } from 'next/server';
import type { TokyoWidgetDefinition } from './account-instance-direct';
import { validateAccountWidgetDefaultsContract } from './account-widget-defaults-contract';
import type { InstancePackageFailure } from './account-widget-defaults-contract';
import type { AccountWidgetDefaultsDocument } from './account-widget-defaults-direct';

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export async function materializeInitialAccountWidgetDefaults(args: {
  request: NextRequest;
  accountId: string;
  widgetDefinitions: TokyoWidgetDefinition[];
  now?: string;
}): Promise<{ ok: true; widgetDefaults: AccountWidgetDefaultsDocument } | InstancePackageFailure> {
  const now = args.now ?? new Date().toISOString();
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const definition of args.widgetDefinitions) {
    widgets[definition.widgetType] = { core: cloneRecord(definition.defaults) };
  }

  const widgetDefaults: AccountWidgetDefaultsDocument = {
    accountId: args.accountId,
    fontLibrary: createDefaultAccountFontLibrary(),
    shell: cloneRecord(WIDGET_SHELL_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
    widgets,
    seededAt: now,
    updatedAt: now,
  };
  const contract = await validateAccountWidgetDefaultsContract({
    request: args.request,
    widgetDefaults,
    widgetDefinitions: args.widgetDefinitions,
  });
  if (!contract.ok) return contract;
  return {
    ok: true,
    widgetDefaults,
  };
}

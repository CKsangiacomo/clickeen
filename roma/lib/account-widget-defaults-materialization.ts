import { isRecord } from '@clickeen/ck-contracts';
import { WIDGET_SHELL_FACTORY_DEFAULTS } from '@clickeen/widget-shell';
import type { NextRequest } from 'next/server';
import {
  compileWidgetForInstancePackage,
  type InstancePackageFailure,
} from './account-instance-public-package';
import { validateAccountWidgetDefaultsContract } from './account-widget-defaults-contract';
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

function readCompiledSpecDefaults(args: {
  widgetType: string;
  specSource: string;
}): Record<string, unknown> | null {
  const spec = JSON.parse(args.specSource) as unknown;
  if (!isRecord(spec) || spec.widgetname !== args.widgetType || !isRecord(spec.defaults)) return null;
  return spec.defaults;
}

export async function materializeInitialAccountWidgetDefaults(args: {
  request: NextRequest;
  accountId: string;
  widgetTypes: string[];
  now?: string;
}): Promise<{ ok: true; widgetDefaults: AccountWidgetDefaultsDocument } | InstancePackageFailure> {
  const now = args.now ?? new Date().toISOString();
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const widgetType of args.widgetTypes) {
    const compiled = await compileWidgetForInstancePackage(args.request, widgetType);
    if (!compiled.ok) return compiled;
    const specSource = compiled.value.widgetPackage?.files['spec.json']?.source;
    if (typeof specSource !== 'string' || !specSource.trim()) {
      return validationFailure(
        'coreui.errors.widget.compiled.invalid',
        `missing product widget spec source for ${widgetType}`,
      );
    }
    try {
      const defaults = readCompiledSpecDefaults({ widgetType, specSource });
      if (!defaults) {
        return validationFailure(
          'coreui.errors.widget.compiled.invalid',
          `invalid product widget defaults for ${widgetType}`,
        );
      }
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
    shell: cloneRecord(WIDGET_SHELL_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
    widgets,
    seededAt: now,
    updatedAt: now,
  };
  const contract = await validateAccountWidgetDefaultsContract({
    request: args.request,
    widgetDefaults,
    widgetTypes: args.widgetTypes,
  });
  if (!contract.ok) return contract;
  return {
    ok: true,
    widgetDefaults,
  };
}

import { isRecord } from '@clickeen/ck-contracts';
import {
  ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY,
  listWidgetShellAccountDefaultMetadataPaths,
  listWidgetShellControlPaths,
  normalizeAccountFontLibrary,
  validateAccountTypographyFontSelections,
} from '@clickeen/widget-shell';
import type { NextRequest } from 'next/server';
import type { TokyoWidgetDefinition } from './account-instance-direct';
import type { AccountWidgetDefaultsDocument } from './account-widget-defaults-direct';

export type InstancePackageFailure = {
  ok: false;
  status: 422;
  error: {
    kind: 'VALIDATION';
    reasonKey: string;
    detail?: string;
    paths?: string[];
  };
};

function collectDefaultPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return prefix ? [prefix] : [];
  if (!isRecord(value)) return prefix ? [prefix] : [];
  const paths = Object.entries(value).flatMap(([key, child]) =>
    collectDefaultPaths(child, prefix ? `${prefix}.${key}` : key),
  );
  return paths.length > 0 ? paths : prefix ? [prefix] : [];
}

function pathIsCovered(path: string, allowedRoots: readonly string[]): boolean {
  return allowedRoots.some((allowed) => path === allowed || path.startsWith(`${allowed}.`));
}

function validationFailure(paths: string[]): InstancePackageFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.widgetDefaults.unmappedPaths',
      paths,
    },
  };
}

function typographyValidationFailure(paths: string[]): InstancePackageFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY,
      paths,
    },
  };
}

export async function validateAccountWidgetDefaultsContract(args: {
  request: NextRequest;
  widgetDefaults: AccountWidgetDefaultsDocument;
  widgetDefinitions: TokyoWidgetDefinition[];
}): Promise<{ ok: true } | InstancePackageFailure> {
  const fontLibrary = normalizeAccountFontLibrary(args.widgetDefaults.fontLibrary);
  if (!fontLibrary) {
    return validationFailure(['fontLibrary']);
  }
  const widgetTypes = Object.keys(args.widgetDefaults.widgets);
  const definitionsByType = new Map(args.widgetDefinitions.map((entry) => [entry.widgetType, entry]));
  const invalidTypographyPaths = validateAccountTypographyFontSelections({
    fontLibrary,
    typography: args.widgetDefaults.shell.typography,
    required: true,
  }).map((path) => `shell:${path}`);
  const unmappedPaths: string[] = collectDefaultPaths(args.widgetDefaults.shell)
    .filter((path) => !pathIsCovered(path, listWidgetShellControlPaths()))
    .filter((path) => !pathIsCovered(path, listWidgetShellAccountDefaultMetadataPaths()))
    .map((path) => `shell:${path}`);

  for (const widgetType of widgetTypes) {
    const widgetDefaults = args.widgetDefaults.widgets[widgetType];
    if (!widgetDefaults || !isRecord(widgetDefaults.core)) {
      unmappedPaths.push(`${widgetType}:core`);
      continue;
    }
    const definition = definitionsByType.get(widgetType);
    if (!definition) {
      unmappedPaths.push(`${widgetType}:definition`);
      continue;
    }
    const allowedCorePaths = collectDefaultPaths(definition.defaults);
    invalidTypographyPaths.push(
      ...validateAccountTypographyFontSelections({
        fontLibrary,
        typography: widgetDefaults.core.typography,
      }).map((path) => `${widgetType}:${path}`),
    );
    unmappedPaths.push(
      ...collectDefaultPaths(widgetDefaults.core)
        .filter((path) => !pathIsCovered(path, allowedCorePaths))
        .map((path) => `${widgetType}:${path}`),
    );
  }

  if (invalidTypographyPaths.length) {
    return typographyValidationFailure(invalidTypographyPaths);
  }
  if (unmappedPaths.length) return validationFailure(unmappedPaths);
  return { ok: true };
}

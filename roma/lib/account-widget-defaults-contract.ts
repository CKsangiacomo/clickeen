import { isRecord } from '@clickeen/ck-contracts';
import {
  listWidgetShellAccountDefaultMetadataPaths,
  listWidgetShellControlPaths,
  pathBelongsToShell,
} from '@clickeen/widget-shell';
import type { NextRequest } from 'next/server';
import {
  compileWidgetForInstancePackage,
  type InstancePackageFailure,
} from './account-instance-public-package';
import type { AccountWidgetDefaultsDocument } from './account-widget-defaults-direct';

const CORE_SOFTWARE_METADATA_PATHS = ['uiLabels.core', 'typography.roleScales'] as const;

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

function compiledCoreDefaultControlPaths(controls: Array<{ path?: string }> | undefined): string[] {
  return (controls ?? [])
    .map((control) => (typeof control.path === 'string' ? control.path.trim() : ''))
    .filter((path) => path && !pathBelongsToShell(path))
    .sort((left, right) => left.localeCompare(right));
}

export async function validateAccountWidgetDefaultsContract(args: {
  request: NextRequest;
  widgetDefaults: AccountWidgetDefaultsDocument;
  widgetTypes?: string[];
}): Promise<{ ok: true } | InstancePackageFailure> {
  const widgetTypes = args.widgetTypes ?? Object.keys(args.widgetDefaults.widgets);
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
    const compiled = await compileWidgetForInstancePackage(args.request, widgetType);
    if (!compiled.ok) return compiled;
    const controlPaths = compiledCoreDefaultControlPaths(compiled.value.controls);
    unmappedPaths.push(
      ...collectDefaultPaths(widgetDefaults.core)
        .filter((path) => !pathIsCovered(path, controlPaths))
        .filter((path) => !pathIsCovered(path, CORE_SOFTWARE_METADATA_PATHS))
        .map((path) => `${widgetType}:${path}`),
    );
  }

  return unmappedPaths.length ? validationFailure(unmappedPaths) : { ok: true };
}

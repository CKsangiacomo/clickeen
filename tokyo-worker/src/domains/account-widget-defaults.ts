import { isRecord } from '@clickeen/ck-contracts';
import {
  WIDGET_SHELL_FACTORY_DEFAULTS,
  listWidgetShellAccountDefaultMetadataPaths,
  listWidgetShellControlPaths,
} from '@clickeen/widget-shell';
import type { Env } from '../types';
import { putJson } from './storage';
import {
  listWidgetAccountDefaultContracts,
} from './widget-definitions';

export type AccountWidgetDefaultsDocument = {
  v: 1;
  accountId: string;
  shell: Record<string, unknown>;
  widgets: Record<
    string,
    {
      core: Record<string, unknown>;
    }
  >;
  seededAt: string;
  updatedAt: string;
};

export function accountWidgetDefaultsKey(accountId: string): string {
  return `accounts/${accountId}/widget-defaults.json`;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

async function loadStoredAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<{ exists: true; value: unknown } | { exists: false }> {
  const obj = await args.env.TOKYO_R2.get(accountWidgetDefaultsKey(args.accountId));
  if (!obj) return { exists: false };
  try {
    return { exists: true, value: await obj.json() };
  } catch {
    throw new Error('tokyo.widgetDefaults.invalid');
  }
}

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

function validateDefaultPaths(args: {
  owner: string;
  value: Record<string, unknown>;
  controlPaths: readonly string[];
  metadataPaths: readonly string[];
}): string[] {
  return collectDefaultPaths(args.value)
    .filter((path) => !pathIsCovered(path, args.controlPaths))
    .filter((path) => !pathIsCovered(path, args.metadataPaths))
    .map((path) => `${args.owner}:${path}`);
}

function assertNoUnmappedDefaultPaths(paths: string[]): void {
  if (paths.length > 0) {
    throw new Error(
      `tokyo.widgetDefaults.unmappedPaths:${paths.sort((left, right) => left.localeCompare(right)).join(',')}`,
    );
  }
}

export function createAccountWidgetDefaultsSeed(args: {
  accountId: string;
  now?: string;
}): AccountWidgetDefaultsDocument {
  const now = args.now ?? new Date().toISOString();
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const entry of listWidgetAccountDefaultContracts()) {
    widgets[entry.widgetType] = {
      core: cloneRecord(entry.coreFactoryDefaults),
    };
  }
  const seeded = normalizeAccountWidgetDefaultsDocument(
    {
      v: 1,
      accountId: args.accountId,
      shell: cloneRecord(WIDGET_SHELL_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
      widgets,
      seededAt: now,
      updatedAt: now,
    },
    args.accountId,
  );
  if (!seeded) throw new Error('tokyo.widgetDefaults.invalid');
  return seeded;
}

export function normalizeAccountWidgetDefaultsDocument(
  value: unknown,
  accountId: string,
): AccountWidgetDefaultsDocument | null {
  if (!isRecord(value) || value.v !== 1 || value.accountId !== accountId) return null;
  if (!isRecord(value.shell) || !isRecord(value.widgets)) return null;
  if (typeof value.seededAt !== 'string' || !value.seededAt.trim()) return null;
  if (typeof value.updatedAt !== 'string' || !value.updatedAt.trim()) return null;

  const shell = cloneRecord(value.shell);
  const shellMetadataPaths = listWidgetShellAccountDefaultMetadataPaths();

  const contracts = listWidgetAccountDefaultContracts();
  const contractByWidgetType = new Map(
    contracts.map((contract) => [contract.widgetType, contract]),
  );
  const unknownWidgetTypes = Object.keys(value.widgets).filter(
    (widgetType) => !contractByWidgetType.has(widgetType),
  );
  if (unknownWidgetTypes.length > 0) {
    throw new Error(
      `tokyo.widgetDefaults.unknownWidget:${unknownWidgetTypes.sort((left, right) => left.localeCompare(right)).join(',')}`,
    );
  }

  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  const unmappedPaths: string[] = validateDefaultPaths({
    owner: 'shell',
    value: shell,
    controlPaths: listWidgetShellControlPaths(),
    metadataPaths: shellMetadataPaths,
  });

  for (const contract of contracts) {
    const widgetDefaults = value.widgets[contract.widgetType];
    if (!isRecord(widgetDefaults) || !isRecord(widgetDefaults.core)) return null;
    const core = cloneRecord(widgetDefaults.core);
    unmappedPaths.push(
      ...validateDefaultPaths({
        owner: contract.widgetType,
        value: core,
        controlPaths: contract.coreControlPaths,
        metadataPaths: contract.coreMetadataPaths,
      }),
    );
    widgets[contract.widgetType] = {
      core,
    };
  }
  assertNoUnmappedDefaultPaths(unmappedPaths);

  return {
    v: 1,
    accountId,
    shell,
    widgets,
    seededAt: value.seededAt,
    updatedAt: value.updatedAt,
  };
}

export async function readAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<AccountWidgetDefaultsDocument | null> {
  const loaded = await loadStoredAccountWidgetDefaults(args);
  if (!loaded.exists) throw new Error('tokyo.widgetDefaults.missing');
  const normalized = normalizeAccountWidgetDefaultsDocument(loaded.value, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  return normalized;
}

export async function createInitialAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<AccountWidgetDefaultsDocument> {
  const existing = await loadStoredAccountWidgetDefaults(args);
  if (existing.exists) {
    const normalized = normalizeAccountWidgetDefaultsDocument(existing.value, args.accountId);
    throw new Error(normalized ? 'tokyo.widgetDefaults.exists' : 'tokyo.widgetDefaults.invalid');
  }
  const seeded = createAccountWidgetDefaultsSeed({ accountId: args.accountId });
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), seeded);
  return seeded;
}

export async function writeAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
}): Promise<AccountWidgetDefaultsDocument> {
  const normalized = normalizeAccountWidgetDefaultsDocument(args.widgetDefaults, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  const next: AccountWidgetDefaultsDocument = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), next);
  return next;
}

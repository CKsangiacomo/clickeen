import { isRecord } from '@clickeen/ck-contracts';
import {
  WIDGET_SHELL_FACTORY_DEFAULTS,
  listWidgetShellAccountDefaultMetadataPaths,
  listWidgetShellControlPaths,
} from '@clickeen/widget-shell';
import type { Env } from '../types';
import { loadJson, putJson } from './storage';
import {
  listWidgetAccountDefaultContracts,
  listWidgetCoreFactoryDefaults,
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

function nowIso(): string {
  return new Date().toISOString();
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function readPath(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (const part of parts) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function setPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  let cursor: Record<string, unknown> = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    if (index === parts.length - 1) {
      cursor[part] = JSON.parse(JSON.stringify(value)) as unknown;
      return;
    }
    if (!isRecord(cursor[part])) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
}

function deletePath(root: Record<string, unknown>, path: string): void {
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!isRecord(cursor)) return;
    cursor = cursor[parts[index]!];
  }
  if (isRecord(cursor)) delete cursor[parts[parts.length - 1]!];
}

function pathExists(root: Record<string, unknown>, path: string): boolean {
  return typeof readPath(root, path) !== 'undefined';
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

function canonicalizeSoftwareMetadata(args: {
  target: Record<string, unknown>;
  factory: Record<string, unknown>;
  metadataPaths: readonly string[];
}): void {
  args.metadataPaths.forEach((path) => {
    if (pathExists(args.factory, path)) {
      setPath(args.target, path, readPath(args.factory, path));
    } else {
      deletePath(args.target, path);
    }
  });
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
  const now = args.now ?? nowIso();
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const entry of listWidgetCoreFactoryDefaults()) {
    widgets[entry.widgetType] = {
      core: cloneRecord(entry.core),
    };
  }
  const seeded: AccountWidgetDefaultsDocument = {
    v: 1,
    accountId: args.accountId,
    shell: cloneRecord(WIDGET_SHELL_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
    widgets,
    seededAt: now,
    updatedAt: now,
  };
  const normalized = normalizeAccountWidgetDefaultsDocument(seeded, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  return normalized;
}

export function normalizeAccountWidgetDefaultsDocument(
  value: unknown,
  accountId: string,
): AccountWidgetDefaultsDocument | null {
  if (!isRecord(value) || value.v !== 1 || value.accountId !== accountId) return null;
  if (!isRecord(value.shell) || !isRecord(value.widgets)) return null;

  const shell = cloneRecord(value.shell);
  const shellMetadataPaths = listWidgetShellAccountDefaultMetadataPaths();
  canonicalizeSoftwareMetadata({
    target: shell,
    factory: WIDGET_SHELL_FACTORY_DEFAULTS as unknown as Record<string, unknown>,
    metadataPaths: shellMetadataPaths,
  });

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
    const core =
      isRecord(widgetDefaults) && isRecord(widgetDefaults.core)
        ? cloneRecord(widgetDefaults.core)
        : cloneRecord(contract.coreFactoryDefaults);
    canonicalizeSoftwareMetadata({
      target: core,
      factory: contract.coreFactoryDefaults,
      metadataPaths: contract.coreMetadataPaths,
    });
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

  const seededAt =
    typeof value.seededAt === 'string' && value.seededAt.trim() ? value.seededAt : nowIso();
  const updatedAt =
    typeof value.updatedAt === 'string' && value.updatedAt.trim() ? value.updatedAt : seededAt;
  return {
    v: 1,
    accountId,
    shell,
    widgets,
    seededAt,
    updatedAt,
  };
}

export async function readAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<AccountWidgetDefaultsDocument | null> {
  const loaded = await loadJson<unknown>(args.env, accountWidgetDefaultsKey(args.accountId));
  if (loaded == null) return null;
  const normalized = normalizeAccountWidgetDefaultsDocument(loaded, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  return normalized;
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
    updatedAt: nowIso(),
  };
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), next);
  return next;
}

export async function readOrSeedAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<AccountWidgetDefaultsDocument> {
  const loaded = await loadJson<unknown>(args.env, accountWidgetDefaultsKey(args.accountId));
  if (loaded != null) {
    const existing = normalizeAccountWidgetDefaultsDocument(loaded, args.accountId);
    if (!existing) throw new Error('tokyo.widgetDefaults.invalid');
    if (stableJson(existing) !== stableJson(loaded)) {
      await putJson(args.env, accountWidgetDefaultsKey(args.accountId), existing);
    }
    return existing;
  }
  const seeded = createAccountWidgetDefaultsSeed({ accountId: args.accountId });
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), seeded);
  return seeded;
}
